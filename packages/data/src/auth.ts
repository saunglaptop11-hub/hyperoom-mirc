import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { HyperoomSupabaseClient } from "./client";

export interface AuthApi {
  getSession(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<Session>;
  signUp(email: string, password: string, emailRedirectTo?: string): Promise<Session | null>;
  resendSignupConfirmation(email: string, emailRedirectTo?: string): Promise<void>;
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
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error("Supabase sign-in returned no session.");
      return data.session;
    },
    async signUp(email, password, emailRedirectTo) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });
      if (error) throw error;
      return data.session;
    },
    async resendSignupConfirmation(email, emailRedirectTo) {
      const { error } = await client.auth.resend({
        type: "signup",
        email,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });
      if (error) throw error;
    },    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    onAuthStateChange(callback) {
      const { data } = client.auth.onAuthStateChange(callback);
      return () => data.subscription.unsubscribe();
    },
  };
}
