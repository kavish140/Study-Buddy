import { createClient } from "@supabase/supabase-js";

// Ensure environment variables are populated, usually via VITE_ prefixes in a Vite app.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const msg =
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. " +
    "Create a .env file at the project root with these values.";
  if (import.meta.env.PROD) {
    throw new Error(msg);
  } else {
    console.warn(msg);
  }
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder-project.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
);
