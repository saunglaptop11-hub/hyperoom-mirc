import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { HyperoomSupabaseClient } from "./client";

export interface AuthApi {
  getSession(): Promise<Session | null>;
  signIn(phone: string, password: string): Promise<Session>;
  signUp(phone: string, password: string, username: string, displayName: string): Promise<Session>;
  signOut(): Promise<void>;
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void;
}

function normalizePhone(value: string): string {
  const raw = value.trim().replace(/[\s().-]/g, "");
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("08")) return `+62${raw.slice(1)}`;
  if (raw.startsWith("8")) return `+62${raw}`;
  throw new Error("Enter a valid Indonesian phone number, for example +62812... or 0812...");
}

export function createAuthApi(client: HyperoomSupabaseClient): AuthApi {
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    async signIn(phone, password) {
      const { data, error } = await client.auth.signInWithPassword({ phone: normalizePhone(phone), password });
      if (error) throw error;
      if (!data.session) throw new Error("Supabase sign-in returned no session.");
      return data.session;
    },
    async signUp(phone, password, username, _displayName) {
      const normalizedPhone = normalizePhone(phone);
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, password, username }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Account creation failed.");
      const { data, error } = await client.auth.signInWithPassword({ phone: normalizedPhone, password });
      if (error) throw error;
      if (!data.session) throw new Error("Account created but sign-in returned no session.");
      return data.session;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    onAuthStateChange(callback) {
      const { data } = client.auth.onAuthStateChange(callback);
      return () => data.subscription.unsubscribe();
    },
  };
}
