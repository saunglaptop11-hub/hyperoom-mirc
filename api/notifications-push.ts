import webpush from "web-push";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
webpush.setVapidDetails("mailto:admin@hyperoom-mirc.app", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: "unauthorized" });
  const { data, error } = await db.from("notifications").select("id,recipient_user_id,type,title,body,payload").is("push_sent_at", null).order("created_at", { ascending: true }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  let sent = 0;
  for (const n of data ?? []) {
    const { data: subs } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", n.recipient_user_id).is("disabled_at", null);
    for (const sub of subs ?? []) {
      try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: n.title, body: n.body, type: n.type, notificationId: n.id, payload: n.payload })); sent++; }
      catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subscriptions").update({ disabled_at: new Date().toISOString() }).eq("id", sub.id); }
    }
    await db.from("notifications").update({ push_sent_at: new Date().toISOString() }).eq("id", n.id);
  }
  return res.status(200).json({ processed: data?.length ?? 0, sent });
}
