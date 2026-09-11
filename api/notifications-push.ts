import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
webpush.setVapidDetails("mailto:admin@hyperoom-mirc.app", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const auth = String(req.headers.authorization ?? "");
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "missing_auth" });
  const token = auth.slice(7);
  const userClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return res.status(401).json({ error: "invalid_auth" });
  const actorId = authData.user.id;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
  const messageId = typeof body.messageId === "string" ? body.messageId : null;
  const notificationIds = Array.isArray(body.notificationIds) ? body.notificationIds.filter((x: unknown): x is string => typeof x === "string") : [];
  let query = db.from("notifications").select("id,recipient_user_id,type,title,body,payload,actor_user_id,message_id").is("push_sent_at", null).eq("actor_user_id", actorId).limit(100);
  if (messageId) query = query.eq("message_id", messageId);
  else if (notificationIds.length) query = query.in("id", notificationIds);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  let sent = 0;
  let processed = 0;
  for (const n of data ?? []) {
    const { data: pref } = await db.from("notification_preferences").select("push_enabled").eq("user_id", n.recipient_user_id).maybeSingle();
    if (pref && pref.push_enabled === false) {
      await db.from("notifications").update({ push_sent_at: new Date().toISOString() }).eq("id", n.id);
      processed++;
      continue;
    }
    const { data: subs } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", n.recipient_user_id).is("disabled_at", null);
    let delivered = false;
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: n.title, body: n.body, type: n.type, notificationId: n.id, payload: n.payload }));
        sent++;
        delivered = true;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subscriptions").update({ disabled_at: new Date().toISOString() }).eq("id", sub.id);
      }
    }
    if (delivered || !(subs ?? []).length) await db.from("notifications").update({ push_sent_at: new Date().toISOString() }).eq("id", n.id);
    processed++;
  }
  return res.status(200).json({ processed, sent });
}
