import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type HyperoomSupabaseClient = SupabaseClient<Database>;

export function createHyperoomClient(url: string, publishableKey: string): HyperoomSupabaseClient {
  if (!url.trim() || !publishableKey.trim()) {
    throw new Error("Supabase URL and publishable key are required.");
  }
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

export function createHyperoomClientFromEnv(env: Record<string, string | undefined>): HyperoomSupabaseClient {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.");
  }
  return createHyperoomClient(url, key);
}
