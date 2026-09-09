import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { HyperoomSupabaseClient } from "./client";

export interface AuthApi {
  getSession(): Promise<Session | null>;
  signIn(phone: string, password: string): Promise<Session>;
  signUp(phone: string, password: string, username: string, displayName: string): Promise<Session | null>;
  signOut(): Promise<void>;
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void;
}

export function createAuthApi(client: HyperoomSupabaseClient): AuthApi {
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    async signIn(phone, password) {
      const { data, error } = await client.auth.signInWithPassword({ phone, password });
      if (error) throw error;
      if (!data.session) throw new Error("Supabase sign-in returned no session.");
      return data.session;
    },
    async signUp(phone, password, username, displayName) {
      const { data, error } = await client.auth.signUp({
        phone,
        password,
        options: { data: { username, display_name: displayName } },
      });
      if (error) throw error;
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
