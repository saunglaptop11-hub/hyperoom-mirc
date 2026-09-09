import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const nickname = process.env.OWNER_NICKNAME?.trim();
const password = process.env.OWNER_PASSWORD ?? "";
const phoneInput = process.env.OWNER_PHONE?.trim();

if (!url || !secret || !nickname || !phoneInput || password.length < 8) {
  throw new Error("Set VITE_SUPABASE_URL, SUPABASE_SECRET_KEY, OWNER_NICKNAME, OWNER_PHONE, and OWNER_PASSWORD (8+ chars).");
}

function normalizePhone(value) {
  const compact = value.replace(/[\s().-]/g, "");
  if (/^08\d+$/.test(compact)) return `+62${compact.slice(1)}`;
  if (/^62\d+$/.test(compact)) return `+${compact}`;
  if (/^\+\d+$/.test(compact)) return compact;
  throw new Error("OWNER_PHONE must be an Indonesian number such as 0812... or +62812...");
}

const phone = normalizePhone(phoneInput);
const username = nickname.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24);
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const { count, error: ownerError } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("system_role", "owner");
if (ownerError) throw ownerError;
if (count) throw new Error("An Owner already exists. Use the role-management workflow instead.");

const { data, error } = await admin.auth.admin.createUser({
  phone,
  password,
  phone_confirm: true,
  user_metadata: { username, display_name: nickname },
});
if (error) throw error;

const { error: profileError } = await admin.from("profiles").insert({
  id: data.user.id,
  username,
  display_name: nickname,
  system_role: "owner",
});
if (profileError) {
  await admin.auth.admin.deleteUser(data.user.id);
  throw profileError;
}

console.log(`Owner created: ${nickname} (${data.user.id})`);
