import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { HyperoomSupabaseClient } from "./client";

export interface AuthApi {
  getSession(): Promise<Session | null>;
  signIn(nickname: string, password: string): Promise<Session>;
  signUp(phone: string, password: string, username: string, displayName: string): Promise<Session>;
  signOut(): Promise<void>;
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void;
}

function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (/^08\d+$/.test(compact)) return `+62${compact.slice(1)}`;
  if (/^62\d+$/.test(compact)) return `+${compact}`;
  if (/^\+\d+$/.test(compact)) return compact;
  throw new Error("Use an Indonesian phone number such as 0812... or +62812...");
}

async function parseResponse(response: Response): Promise<Record<string, unknown>> {
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Authentication failed.");
  return payload;
}
export function createAuthApi(client: HyperoomSupabaseClient): AuthApi {
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    async signIn(nickname, password) {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), password }),
      });
      const payload = await parseResponse(response);
      const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
      const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : "";
      if (!accessToken || !refreshToken) throw new Error("Authentication server returned an invalid session.");
      const { data, error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw error;
      if (!data.session) throw new Error("Authentication returned no session.");
      return data.session;
    },
    async signUp(phone, password, username, displayName) {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: normalizePhone(phone), password, username, displayName }),
      });
      await parseResponse(response);
      return this.signIn(username, password);
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
