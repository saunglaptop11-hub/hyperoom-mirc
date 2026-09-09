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
  let body: { phone?: string; password?: string; username?: string };
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON body." }, 400); }
  const phone = body.phone?.trim();
  const password = body.password ?? "";
  const nickname = body.username?.trim();
  if (!phone || !nickname || password.length < 8) {
    return json({ error: "Phone, nickname, and an 8+ character password are required." }, 400);
  }
  if (nickname.length < 2 || nickname.length > 24) {
    return json({ error: "Nickname must be 2-24 characters." }, 400);
  }
  const username = usernameFromNickname(nickname);
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    phone, password, phone_confirm: true,
    user_metadata: { username, display_name: nickname },
  });
  if (error) return json({ error: error.message }, 400);
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    username,
    display_name: nickname,
    system_role: "member",
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return json({ error: profileError.code === "23505" ? "That nickname is already taken." : profileError.message }, 409);
  }
  return json({ ok: true, userId: data.user.id });
}
