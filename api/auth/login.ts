import { createClient } from "@supabase/supabase-js";

declare const process: { env: Record<string, string | undefined> };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (/^08\d+$/.test(compact)) return `+62${compact.slice(1)}`;
  if (/^62\d+$/.test(compact)) return `+${compact}`;
  if (/^\+\d+$/.test(compact)) return compact;
  throw new Error("Use an Indonesian phone number such as 0812... or +62812...");
}

function usernameFromNickname(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24);
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const url = process.env.VITE_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return json({ error: "Auth server is not configured." }, 500);
  let body: { identifier?: string; password?: string };
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON body." }, 400); }
  const identifier = body.identifier?.trim();
  const password = body.password ?? "";
  if (!identifier || password.length < 8) return json({ error: "Nickname/phone and password are required." }, 400);
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const phone = /^\+?\d[\d\s().-]{7,}$/.test(identifier) ? normalizePhone(identifier) : null;
  if (phone) {
    const { data, error } = await admin.auth.signInWithPassword({ phone, password });
    if (error || !data.session) return json({ error: "Invalid nickname or password." }, 401);
    return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  }
  const username = usernameFromNickname(identifier);
  if (!username) return json({ error: "Invalid nickname or password." }, 401);
  const { data: profile, error: profileError } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (profileError) return json({ error: "Authentication is temporarily unavailable." }, 500);
  if (!profile) return json({ error: "Invalid nickname or password." }, 401);
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
  if (userError || !userData.user?.phone) return json({ error: "Invalid nickname or password." }, 401);
  const { data, error } = await admin.auth.signInWithPassword({ phone: userData.user.phone, password });
  if (error || !data.session) return json({ error: "Invalid nickname or password." }, 401);
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
}
