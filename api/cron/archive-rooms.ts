import { createClient } from "@supabase/supabase-js";

declare const process: { env: Record<string, string | undefined> };

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = process.env.VITE_SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !supabaseSecret) return Response.json({ error: "Database server is not configured." }, { status: 500 });
  const admin = createClient(url, supabaseSecret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.rpc("archive_inactive_rooms", { p_now: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, archived: data ?? 0 });
}
