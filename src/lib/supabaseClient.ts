import { createClient } from "@supabase/supabase-js";

// NOTE: This module is intentionally tiny and evaluated early.
// A small change here also helps ensure preview rebuilds pick up updated Project Secrets.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Supabase env vars missing. Confirm VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (and non-empty) in Project Secrets, then refresh the preview.",
  );
  throw new Error("Supabase env vars missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
