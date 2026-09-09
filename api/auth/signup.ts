import { createClient } from "@supabase/supabase-js";

declare const process: { env: Record<string, string | undefined> };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (/^08\d+$/.test(compact)) return `+62${compact.slice(1)}`;
  if (/^62\d+$/.test(compact)) return `+${compact}`;
  if (/^\+\d+$/.test(compact)) return compact;
  throw new Error("Use an Indonesian phone number such as 0812... or +62812...");
}

function usernameFromNickname(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24) || "user";
}

function authEmailFromPhone(phone: string): string {
  return `hp_${phone.replace(/\D/g, "")}@auth.hyperoom.local`;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const url = process.env.VITE_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return json({ error: "Auth server is not configured." }, 500);
  let body: { phone?: string; password?: string; username?: string; displayName?: string };
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const nickname = body.username?.trim() ?? "";
  const displayName = body.displayName?.trim() || nickname;
  const password = body.password ?? "";
  if (!body.phone || !nickname || password.length < 8) return json({ error: "Phone, nickname, and an 8+ character password are required." }, 400);
  if (nickname.length < 2 || nickname.length > 24) return json({ error: "Nickname must be 2-24 characters." }, 400);
  const username = usernameFromNickname(nickname);
  let phone: string;
  try { phone = normalizePhone(body.phone); } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid phone number." }, 400); }
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: existingName } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
  const { data: existingPhone } = await admin.from("account_identifiers").select("user_id").eq("phone", phone).maybeSingle();
  if (existingName || existingPhone) return json({ error: "That nickname or phone number is already registered." }, 409);
  const email = authEmailFromPhone(phone);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: displayName, phone } });
  if (error) return json({ error: error.message }, 400);
  const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, username, display_name: displayName, system_role: "member" });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return json({ error: profileError.code === "23505" ? "That nickname is already taken." : profileError.message }, 409);
  }
  const { error: identifierError } = await admin.from("account_identifiers").insert({ user_id: data.user.id, phone });
  if (identifierError) {
    await admin.from("profiles").delete().eq("id", data.user.id);
    await admin.auth.admin.deleteUser(data.user.id);
    return json({ error: identifierError.code === "23505" ? "That phone number is already registered." : identifierError.message }, 409);
  }
  return json({ ok: true, userId: data.user.id });
}
