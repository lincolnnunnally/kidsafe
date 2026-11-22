import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser client on the shared LPL Supabase (anon key — public by design).
// The account holder is always an adult person on shared GoTrue; pets are
// owner-owned rows. RLS enforces everything server-side. This client only ever
// holds the signed-in user's own session — never a service role (that would be
// the session-poisoning trap; it lives only in server /api routes).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (typeof window === "undefined") {
    // Server render: a throwaway client with no persisted session.
    return createClient(url, anonKey, { auth: { persistSession: false } });
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}
