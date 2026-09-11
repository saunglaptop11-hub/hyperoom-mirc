import { useEffect, useMemo, useRef, useState } from "react";
import "./notification-center.css";

type NotificationRow = {
  id: string; type: string; title: string; body: string; created_at: string; read_at: string | null;
  room_id: string | null; message_id: string | null; payload: Record<string, unknown> | null;
};
type Preferences = { push_enabled: boolean; sound_enabled: boolean; dm_enabled: boolean; mention_enabled: boolean; reply_enabled: boolean; room_activity_enabled: boolean; moderation_enabled: boolean; system_enabled: boolean };

type Props = { client: any; profileId: string };

function keyBytes(s: string): Uint8Array {
  const normalized = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
}

const defaultPrefs: Preferences = { push_enabled: true, sound_enabled: true, dm_enabled: true, mention_enabled: true, reply_enabled: true, room_activity_enabled: false, moderation_enabled: true, system_enabled: true };

export function NotificationCenter({ client, profileId }: Props): React.JSX.Element {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const unread = useMemo(() => rows.filter((x) => !x.read_at).length, [rows]);

  function playSound(): void {
    if (!prefs.sound_enabled || document.visibilityState !== "visible") return;
    try {
      const audio = audioRef.current ?? new AudioContext();
      audioRef.current = audio;
      if (audio.state !== "running") void audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.035;
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(); oscillator.stop(audio.currentTime + 0.09);
    } catch { /* browser autoplay policy */ }
  }

  function mergeNotification(next: NotificationRow): void {
    setRows((current) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, 100));
  }

  async function load(): Promise<void> {
    const [{ data: notifications, error: notificationError }, { data: preference, error: preferenceError }] = await Promise.all([
      client.from("notifications").select("id,type,title,body,created_at,read_at,room_id,message_id,payload").order("created_at", { ascending: false }).limit(100),
      client.from("notification_preferences").select("push_enabled,sound_enabled,dm_enabled,mention_enabled,reply_enabled,room_activity_enabled,moderation_enabled,system_enabled").eq("user_id", profileId).maybeSingle(),
    ]);
    if (!notificationError) setRows(notifications ?? []);
    if (!preferenceError && preference) setPrefs({ ...defaultPrefs, ...preference });
    if (!preference) await client.from("notification_preferences").upsert({ user_id: profileId, ...defaultPrefs }, { onConflict: "user_id" });
  }

  useEffect(() => {
    let dead = false;
    void load();
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const channel = client.channel(`notifications:${profileId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${profileId}` }, (event: any) => {
      if (dead) return;
      mergeNotification(event.new as NotificationRow);
      playSound();
      if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
        void navigator.serviceWorker?.ready.then((registration) => registration.showNotification((event.new as NotificationRow).title, { body: (event.new as NotificationRow).body, icon: "/favicon.ico", tag: (event.new as NotificationRow).id }));
      }
    }).subscribe();
    const pushEventHandler = async (event: Event) => { const detail = (event as CustomEvent<{ messageId?: string }>).detail; if (!detail?.messageId) return; try { const { data } = await client.auth.getSession(); const token = data.session?.access_token; if (token) await fetch("/api/notifications-push", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ messageId: detail.messageId }) }); } catch { /* side effect only */ } }; window.addEventListener("hyperoom-push-notifications", pushEventHandler);
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type !== "OPEN_NOTIFICATION_CONTEXT") return;
      const payload = event.data.payload ?? {};
      if (payload.roomId) window.dispatchEvent(new CustomEvent("hyperoom-open-room", { detail: payload.roomId }));
    };
    navigator.serviceWorker?.addEventListener("message", messageHandler);
    return () => { dead = true; void client.removeChannel(channel); navigator.serviceWorker?.removeEventListener("message", messageHandler); window.removeEventListener("hyperoom-push-notifications", pushEventHandler); };
  }, [client, profileId]);

  async function enablePush(): Promise<void> {
    setBusy(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("Browser ini tidak mendukung Web Push.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Izin notifikasi tidak diberikan.");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const config = await fetch("/api/notifications-config", { cache: "no-store" }).then((response) => response.json());
      if (!config.publicKey) throw new Error("Push configuration tidak tersedia.");
      const old = await registration.pushManager.getSubscription();
      const subscription = old ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) as any });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Push subscription tidak lengkap.");
      const { error } = await client.from("push_subscriptions").upsert({ user_id: profileId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent, disabled_at: null, updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
      if (error) throw error;
      await client.from("notification_preferences").upsert({ user_id: profileId, push_enabled: true, sound_enabled: prefs.sound_enabled }, { onConflict: "user_id" });
      setPrefs((current) => ({ ...current, push_enabled: true }));
      audioRef.current = audioRef.current ?? new AudioContext();
      void audioRef.current.resume();
    } catch (error) { window.alert(error instanceof Error ? error.message : "Gagal mengaktifkan notifikasi."); }
    finally { setBusy(false); }
  }

  async function disablePush(): Promise<void> {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker?.ready;
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;
      if (subscription) await subscription.unsubscribe();
      if (endpoint) await client.from("push_subscriptions").update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", profileId).eq("endpoint", endpoint);
      await client.from("notification_preferences").upsert({ user_id: profileId, push_enabled: false, sound_enabled: prefs.sound_enabled }, { onConflict: "user_id" });
      setPrefs((current) => ({ ...current, push_enabled: false }));
    } finally { setBusy(false); }
  }

  async function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<void> {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await client.from("notification_preferences").upsert({ user_id: profileId, ...next }, { onConflict: "user_id" });
  }

  async function markRead(id: string): Promise<void> {
    const now = new Date().toISOString();
    setRows((current) => current.map((row) => row.id === id ? { ...row, read_at: now } : row));
    await client.from("notifications").update({ read_at: now }).eq("id", id).eq("recipient_user_id", profileId);
  }

  async function markAllRead(): Promise<void> {
    const now = new Date().toISOString();
    setRows((current) => current.map((row) => ({ ...row, read_at: row.read_at ?? now })));
    await client.from("notifications").update({ read_at: now }).eq("recipient_user_id", profileId).is("read_at", null);
  }

  async function openNotification(row: NotificationRow): Promise<void> {
    await markRead(row.id);
    setOpen(false);
    const roomId = row.room_id ?? (typeof row.payload?.roomId === "string" ? row.payload.roomId : null);
    if (roomId) window.dispatchEvent(new CustomEvent("hyperoom-open-room", { detail: roomId }));
  }

  return <div className="notification-center">
    <button className="notification-trigger" type="button" onClick={() => { setOpen((value) => !value); if (!open) playSound(); }} aria-label="Notifications" title="Notifications">🔔{unread > 0 && <span className="notification-badge">{unread > 99 ? "99+" : unread}</span>}</button>
    {open && <div className="notification-panel" role="dialog" aria-label="Notifications">
      <div className="notification-panel-head"><strong>🔔 Notifications</strong><span><button type="button" onClick={() => void updatePreference("sound_enabled", !prefs.sound_enabled)}>{prefs.sound_enabled ? "🔊" : "🔇"}</button><button type="button" disabled={!unread} onClick={() => void markAllRead()}>Read all</button></span></div>
      <div className="notification-settings"><button type="button" disabled={busy} onClick={() => void (prefs.push_enabled ? disablePush() : enablePush())}>{busy ? "Working..." : prefs.push_enabled ? "✓ Device notifications" : "Enable device notifications"}</button><small>DM {prefs.dm_enabled ? "on" : "off"} · Mentions {prefs.mention_enabled ? "on" : "off"} · Replies {prefs.reply_enabled ? "on" : "off"}</small></div>
      <div className="notification-list">{rows.length === 0 && <div className="notification-empty">No notifications yet.</div>}{rows.map((row) => <button className={`notification-item ${row.read_at ? "read" : "unread"}`} key={row.id} type="button" onClick={() => void openNotification(row)}><span className="notification-dot">●</span><span><strong>{row.title}</strong><em>{row.body}</em><small>{new Date(row.created_at).toLocaleString()}</small></span></button>)}</div>
    </div>}
  </div>;
}
