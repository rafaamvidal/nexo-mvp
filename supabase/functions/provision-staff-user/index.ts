import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Payload = {
  email: string;
  full_name?: string | null;
  role: "admin" | "staff";
  status: "active" | "inactive";
  password: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json(500, { ok: false, message: "Server misconfigured" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json(401, { ok: false, message: "Unauthorized" });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData?.user?.id) {
    return json(401, { ok: false, message: "Unauthorized" });
  }

  // Validate admin permission using the existing security-definer function.
  const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
    _user_id: authData.user.id,
    _role: "admin",
  });
  if (roleErr) return json(500, { ok: false, message: roleErr.message });
  if (!isAdmin) return json(403, { ok: false, message: "Forbidden" });

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json(400, { ok: false, message: "Invalid JSON" });
  }

  const email = String(payload.email ?? "").trim().toLowerCase();
  const full_name = payload.full_name ? String(payload.full_name).trim() : null;
  const role = payload.role;
  const status = payload.status;
  const password = String(payload.password ?? "");

  if (!email || !email.includes("@")) return json(400, { ok: false, message: "E-mail inválido" });
  if (role !== "admin" && role !== "staff") return json(400, { ok: false, message: "Cargo inválido" });
  if (status !== "active" && status !== "inactive") return json(400, { ok: false, message: "Status inválido" });
  if (!password || password.length < 8) {
    return json(400, { ok: false, message: "Senha padrão inválida (mínimo 8 caracteres)" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // 1) Create user in Supabase Auth
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr) {
    const msg = createErr.message ?? "Erro ao criar usuário";
    const lower = msg.toLowerCase();
    if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
      return json(409, { ok: false, message: "Este e-mail já possui usuário no Auth." });
    }
    return json(400, { ok: false, message: msg });
  }

  // 2) Upsert allowlist row (user_profiles)
  const { error: upsertErr } = await adminClient
    .from("user_profiles")
    .upsert(
      {
        email,
        full_name,
        role,
        status,
      } as any,
      { onConflict: "email" },
    );

  if (upsertErr) {
    // Best-effort rollback: remove Auth user to avoid orphan login.
    if (created?.user?.id) {
      await adminClient.auth.admin.deleteUser(created.user.id);
    }
    return json(400, { ok: false, message: upsertErr.message });
  }

  return json(200, { ok: true });
});
