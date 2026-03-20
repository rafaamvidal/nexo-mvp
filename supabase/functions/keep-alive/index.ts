import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Insert a record
  const { data, error: insertError } = await supabase
    .from("keep_alive")
    .insert({})
    .select("id")
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
  }

  // Delete it right away
  await supabase.from("keep_alive").delete().eq("id", data.id);

  return new Response(JSON.stringify({ ok: true, timestamp: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" },
  });
});
