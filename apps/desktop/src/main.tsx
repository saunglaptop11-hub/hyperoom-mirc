import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createAuthApi,
  createHyperoomClientFromEnv,
  createHyperoomRepository,
  type AuthApi,
  type HyperoomRepository,
} from "@hyperoom/data";
import type { HyperoomMessage, HyperoomProfile, HyperoomRoom } from "@hyperoom/shared";
import "./styles.css";

const supabaseConfig = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
};

function friendlyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

function createServices(): { auth: AuthApi; repository: HyperoomRepository } | null {
  if (!supabaseConfig.VITE_SUPABASE_URL || !supabaseConfig.VITE_SUPABASE_PUBLISHABLE_KEY) return null;
  const client = createHyperoomClientFromEnv(supabaseConfig);
  return { auth: createAuthApi(client), repository: createHyperoomRepository(client) };
}

const services = createServices();

type Session = Awaited<ReturnType<AuthApi["getSession"]>>;

type AuthMode = "sign-in" | "sign-up";

function AuthScreen({ auth }: { auth: AuthApi }): React.JSX.Element {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "sign-in") {
        await auth.signIn(email, password);
      } else {
        const redirectTo = window.location.origin;
        const session = await auth.signUp(email, password, redirectTo);
        if (!session) {
          setConfirmationPending(true);
          setNotice("Account created. Open the confirmation email, then return here. The link will finish sign-in automatically.");
        }
      }
    } catch (submitError) {
      setError(friendlyError(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    setBusy(true);
    setError(null);
    try {
      await auth.resendSignupConfirmation(email, window.location.origin);
      setNotice("Confirmation email sent again. Check your inbox and spam folder.");
    } catch (resendError) {
      setError(friendlyError(resendError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">H</div>
        <p className="eyebrow">HYPEROOM · REAL CORE</p>
        <h1>{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">Native Hyperoom authentication powered by Supabase.</p>
        <form onSubmit={submit} className="stack">
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} /></label>
          {error && <div className="error-box">{error}</div>}
          {notice && <div className="notice-box">{notice}</div>}
          {confirmationPending && mode === "sign-up" && <button type="button" className="ghost-button" onClick={() => void resendConfirmation()} disabled={busy}>Resend confirmation email</button>}
          <button className="primary-button" disabled={busy}>{busy ? "Connecting…" : mode === "sign-in" ? "Sign in" : "Create account"}</button>
        </form>
        <button className="link-button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(null); setNotice(null); setConfirmationPending(false); }}>
          {mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}

function ProfileBootstrap({ repository, session, onReady }: { repository: HyperoomRepository; session: NonNullable<Session>; onReady: (profile: HyperoomProfile) => void }): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const existing = await repository.getProfile(session.user.id);
        if (existing) { if (!cancelled) onReady(existing); return; }
        const metadata = session.user.user_metadata as Record<string, unknown> | undefined;
        const metadataUsername = typeof metadata?.username === "string" ? metadata.username : "";
        const emailPrefix = session.user.email?.split("@")[0] ?? "user";
        const base = (metadataUsername || emailPrefix).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24) || "user";
        if (!cancelled) {
          setSaving(true);
          const created = await repository.upsertProfile({ id: session.user.id, username: base, displayName: metadata?.display_name as string || emailPrefix || base });
          onReady(created);
        }
      } catch (bootstrapError) {
        if (!cancelled) setError(friendlyError(bootstrapError));
      } finally {
        if (!cancelled) setSaving(false);
      }
    })();
    return () => { cancelled = true; };
  }, [onReady, repository, session.user.email, session.user.id, session.user.user_metadata]);

  return <main className="center-shell"><section className="status-card"><div className="spinner" /><h2>{saving ? "Creating your profile…" : "Loading your profile…"}</h2>{error && <div className="error-box">{error}</div>}</section></main>;
}

function RoomSidebar({ repository, rooms, activeRoom, onSelect, onRooms }: { repository: HyperoomRepository; rooms: HyperoomRoom[]; activeRoom: HyperoomRoom | null; onSelect: (room: HyperoomRoom) => void; onRooms: (rooms: HyperoomRoom[]) => void }): React.JSX.Element {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom(event: React.FormEvent) {
    event.preventDefault();
    const normalized = name.trim().replace(/^#/, "");
    if (!normalized) return;
    setBusy(true); setError(null);
    try {
      const room = await repository.createRoom({ name: normalized, type: "public" });
      const joined = await repository.joinRoom(room.id);
      onRooms([...rooms.filter((item) => item.id !== room.id), room].sort((a, b) => a.name.localeCompare(b.name)));
      onSelect(room);
      void joined;
      setName("");
    } catch (createError) { setError(friendlyError(createError)); }
    finally { setBusy(false); }
  }

  async function selectRoom(room: HyperoomRoom) {
    setError(null);
    try { await repository.joinRoom(room.id); onSelect(room); }
    catch (joinError) { setError(friendlyError(joinError)); }
  }

  return <aside className="room-sidebar">
    <div className="sidebar-heading"><div><span className="eyebrow">CHANNELS</span><h2>Rooms</h2></div><span className="room-count">{rooms.length}</span></div>
    <form className="create-room" onSubmit={createRoom}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="# new-room" aria-label="New room name" /><button disabled={busy} title="Create room">+</button></form>
    {error && <div className="sidebar-error">{error}</div>}
    <div className="room-list">{rooms.map((room) => <button key={room.id} className={`room-item ${activeRoom?.id === room.id ? "active" : ""}`} onClick={() => void selectRoom(room)}><span>#</span>{room.name}</button>)}</div>
  </aside>;
}

function ChatRoom({ repository, room, profile }: { repository: HyperoomRepository; room: HyperoomRoom; profile: HyperoomProfile }): React.JSX.Element {
  const [messages, setMessages] = useState<HyperoomMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setMessages([]);
    void repository.listMessages(room.id).then((items) => { if (!cancelled) setMessages(items); }).catch((loadError) => { if (!cancelled) setError(friendlyError(loadError)); }).finally(() => { if (!cancelled) setLoading(false); });
    const channel = repository.subscribeRoom(room.id, {
      onMessage: (message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]),
      onMessageUpdated: (message) => setMessages((current) => current.map((item) => item.id === message.id ? message : item)),
    });
    return () => { cancelled = true; channel.unsubscribe(); };
  }, [repository, room.id]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true); setError(null);
    try {
      const created = await repository.sendMessage({ roomId: room.id, content }, profile.id);
      setMessages((current) => current.some((item) => item.id === created.id) ? current : [...current, created]);
      setDraft("");
    } catch (sendError) { setError(friendlyError(sendError)); }
    finally { setSending(false); }
  }

  return <section className="chat-room">
    <header className="chat-header"><div><div className="room-title"># {room.name}</div><div className="muted">{room.description || "Public Hyperoom room"}</div></div><div className="connection-pill"><span /> LIVE</div></header>
    <div className="message-list">{loading && <div className="empty-state">Loading messages…</div>}{!loading && !messages.length && <div className="empty-state"><strong>Room is empty.</strong><span>Send the first message.</span></div>}{messages.map((message) => <article className={`message ${message.senderId === profile.id ? "mine" : ""}`} key={message.id}><div className="message-avatar">{message.senderId === profile.id ? profile.displayName.slice(0, 1).toUpperCase() : "•"}</div><div><div className="message-meta"><strong>{message.senderId === profile.id ? profile.displayName : message.senderId.slice(0, 8)}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><div className="message-body">{message.deletedAt ? <em>message deleted</em> : message.content}{message.editedAt && !message.deletedAt && <small> (edited)</small>}</div></div></article>)}</div>
    <form className="composer" onSubmit={send}><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message #${room.name}`} disabled={sending} aria-label="Message" /><button className="send-button" disabled={sending || !draft.trim()}>{sending ? "…" : "Send"}</button></form>
    {error && <div className="chat-error">{error}</div>}
  </section>;
}

function Workspace({ auth, repository, session }: { auth: AuthApi; repository: HyperoomRepository; session: NonNullable<Session> }): React.JSX.Element {
  const [profile, setProfile] = useState<HyperoomProfile | null>(null);
  const [rooms, setRooms] = useState<HyperoomRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<HyperoomRoom | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onProfileReady = useMemo(() => (next: HyperoomProfile) => setProfile(next), []);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoadingRooms(true); setError(null);
    void repository.listPublicRooms().then((items) => {
      if (!cancelled) { setRooms(items); setActiveRoom((current) => current && items.some((item) => item.id === current.id) ? current : items[0] ?? null); }
    }).catch((loadError) => { if (!cancelled) setError(friendlyError(loadError)); }).finally(() => { if (!cancelled) setLoadingRooms(false); });
    return () => { cancelled = true; };
  }, [profile, repository]);

  if (!profile) return <ProfileBootstrap repository={repository} session={session} onReady={onProfileReady} />;

  async function signOut() {
    try { await auth.signOut(); } catch (signOutError) { setError(friendlyError(signOutError)); }
  }

  return <main className="workspace">
    <header className="topbar"><div className="brand"><div className="brand-mark small">H</div><div><strong>Hyperoom</strong><span>mIRC DNA · native core</span></div></div><div className="user-area"><div className="user-avatar">{profile.displayName.slice(0, 1).toUpperCase()}</div><div className="user-copy"><strong>{profile.displayName}</strong><span>@{profile.username}</span></div><button className="ghost-button" onClick={() => void signOut()}>Sign out</button></div></header>
    <div className="workspace-body"><RoomSidebar repository={repository} rooms={rooms} activeRoom={activeRoom} onSelect={setActiveRoom} onRooms={setRooms} /><section className="main-panel">{error && <div className="global-error">{error}</div>}{loadingRooms ? <div className="empty-panel">Loading rooms…</div> : activeRoom ? <ChatRoom repository={repository} room={activeRoom} profile={profile} /> : <div className="empty-panel"><div className="empty-icon">#</div><h2>No room yet</h2><p>Create a public room from the sidebar to start chatting.</p></div>}</section></div>
  </main>;
}

function App(): React.JSX.Element {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(Boolean(services));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!services) return;
    let mounted = true;
    void services.auth.getSession().then((next) => { if (mounted) setSession(next); }).catch((loadError) => { if (mounted) setError(friendlyError(loadError)); }).finally(() => { if (mounted) setLoading(false); });
    const unsubscribe = services.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { mounted = false; unsubscribe(); };
  }, []);

  if (!services) return <main className="config-shell"><section className="config-card"><p className="eyebrow">HYPEROOM CONFIGURATION</p><h1>Connect Supabase</h1><p>Real authentication and chat are enabled, but this build has no browser-safe Supabase environment variables.</p><pre>VITE_SUPABASE_URL=…{`\n`}VITE_SUPABASE_PUBLISHABLE_KEY=…</pre><p className="muted">Copy <code>.env.example</code> to <code>.env.local</code>, fill these two values, then restart Vite.</p></section></main>;
  if (loading) return <main className="center-shell"><section className="status-card"><div className="spinner" /><h2>Connecting to Hyperoom…</h2><p className="muted">Restoring your real Supabase session.</p></section></main>;
  if (error) return <main className="center-shell"><section className="status-card"><h2>Connection error</h2><div className="error-box">{error}</div><p className="muted">Check your Supabase URL/key and browser network access.</p></section></main>;
  if (!session) return <AuthScreen auth={services.auth} />;
  return <Workspace auth={services.auth} repository={services.repository} session={session} />;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
