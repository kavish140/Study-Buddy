import { createClient } from "@supabase/supabase-js";
import { backendFetch, BACKEND_UNAVAILABLE } from "./backend-request";

// Ensure environment variables are populated, usually via VITE_ prefixes in a Vite app.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. " +
      "Create a .env file at the project root with these values.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: backendFetch },
  // This client restores browser sessions only. SSR must never retain a user's
  // session in a module shared between Worker requests.
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
    detectSessionInUrl: typeof window !== "undefined",
  },
});

export async function checkAuthService() {
  try {
    const response = await backendFetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (!response.ok) throw new Error(BACKEND_UNAVAILABLE);
  } catch {
    throw new Error(BACKEND_UNAVAILABLE);
  }
}
