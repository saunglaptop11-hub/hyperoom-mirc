import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Set VITE_SUPABASE_URL and SUPABASE_SECRET_KEY in the migration shell.");

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: identifiers, error } = await admin.from("account_identifiers").select("user_id,phone");
if (error) throw error;

for (const identifier of identifiers ?? []) {
  const phone = String(identifier.phone);
  const digits = phone.replace(/\D/g, "");
  const email = `hp_${digits}@auth.hyperoom.local`;
  const { data: current, error: userError } = await admin.auth.admin.getUserById(identifier.user_id);
  if (userError) throw userError;
  const metadata = { ...(current.user?.user_metadata ?? {}), phone };
  const { error: updateError } = await admin.auth.admin.updateUserById(identifier.user_id, {
    email,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (updateError) throw updateError;
  console.log(`Migrated ${identifier.user_id}`);
}

console.log(`Auth migration complete: ${identifiers?.length ?? 0} account(s) checked.`);
