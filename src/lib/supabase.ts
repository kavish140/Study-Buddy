import { createClient } from "@supabase/supabase-js";

// Ensure environment variables are populated, usually via VITE_ prefixes in a Vite app.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. " +
    "Create a .env file at the project root with these values."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
