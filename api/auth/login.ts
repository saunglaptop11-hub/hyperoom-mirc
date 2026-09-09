import { createClient } from "@supabase/supabase-js";

declare const process: { env: Record<string, string | undefined> };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function usernameFromNickname(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24) || "user";
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const url = process.env.VITE_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return json({ error: "Auth server is not configured." }, 500);
  let body: { nickname?: string; password?: string };
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON body." }, 400); }
  const nickname = body.nickname?.trim();
  const password = body.password ?? "";
  if (!nickname || password.length < 8) return json({ error: "Nickname and password are required." }, 400);
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const username = usernameFromNickname(nickname);
  const { data: profile, error: profileError } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (profileError) return json({ error: "Authentication is temporarily unavailable." }, 500);
  if (!profile) return json({ error: "Invalid nickname or password." }, 401);
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
  if (userError || !userData.user?.phone) return json({ error: "Invalid nickname or password." }, 401);
  const { data, error } = await admin.auth.signInWithPassword({ phone: userData.user.phone, password });
  if (error || !data.session) return json({ error: "Invalid nickname or password." }, 401);
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
}
