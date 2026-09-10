import React, { useEffect, useState } from "react";
import type { HyperoomProfile, HyperoomRoom, HyperoomRoomInvitation } from "@hyperoom/shared";
import type { HyperoomRepository } from "@hyperoom/data";

type Props = { repository: HyperoomRepository; room: HyperoomRoom; profile: HyperoomProfile; members: { userId: string; role: string }[]; onRoomUpdated: (room: HyperoomRoom) => void };

function canManage(profile: HyperoomProfile, room: HyperoomRoom, members: Props["members"]): boolean {
  return profile.systemRole !== "member" || room.createdBy === profile.id || members.some((m) => m.userId === profile.id && m.role === "owner");
}

export function RoomAccessPanel({ repository, room, profile, members, onRoomUpdated }: Props): React.JSX.Element | null {
  const allowed = canManage(profile, room, members);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? "");
  const [topic, setTopic] = useState(room.topic ?? "");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<HyperoomProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { setName(room.name); setDescription(room.description ?? ""); setTopic(room.topic ?? ""); }, [room]);
  if (!allowed) return null;
  async function save() {
    setBusy(true); setNotice(null);
    try { const updated = await repository.updateRoom(room.id, { name, description, topic }); onRoomUpdated(updated); setNotice("Room settings saved."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Could not save room settings."); }
    finally { setBusy(false); }
  }
  async function toggleLock() {
    setBusy(true); setNotice(null);
    try { const locked = !room.isLocked; const updated = await repository.updateRoom(room.id, { isLocked: locked }); await repository.sendMessage({ roomId: room.id, kind: "system", eventType: locked ? "lock" : "unlock", content: `*** ${profile.username} ${locked ? "locked" : "unlocked"} #${room.name}` }); onRoomUpdated(updated); setNotice(locked ? "Room locked. Existing members remain inside; new joins require an accepted invitation." : "Room unlocked. Public access is restored."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Could not change room access."); }
    finally { setBusy(false); }
  }
  async function search() { if (!query.trim()) { setCandidates([]); return; } try { setCandidates((await repository.searchProfiles(query)).filter((item) => item.id !== profile.id)); } catch (e) { setNotice(e instanceof Error ? e.message : "Could not search members."); } }
  async function invite(target: HyperoomProfile) { setBusy(true); setNotice(null); try { await repository.createInvitation(room.id, target.id); await repository.sendMessage({ roomId: room.id, kind: "system", eventType: "invite", content: `*** ${profile.username} invited ${target.username} to #${room.name}` }); setNotice(`You invited ${target.username} to #${room.name}`); } catch (e) { setNotice(e instanceof Error ? e.message : "Could not create invitation."); } finally { setBusy(false); } }
  return <div className="room-access"><button className="ghost-button" onClick={() => setOpen(!open)}>{open ? "Close Room Controls" : "Room Controls"}</button>{open && <div className="room-access-panel">
    <div className="room-access-section"><strong>Room Settings</strong><label>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} /></label><label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} /></label><label>Topic<input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} /></label><label>Access<select value={room.isLocked ? "locked" : "public"} onChange={(e) => void (e.target.value === (room.isLocked ? "locked" : "public") || toggleLock())}><option value="public">Public</option><option value="locked">Locked / Invite Only</option></select></label><button className="primary-button" disabled={busy} onClick={() => void save()}>Save Changes</button></div>
    <div className="room-access-section"><strong>Invite Member</strong><div className="invite-search"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="username" onKeyDown={(e) => { if (e.key === "Enter") void search(); }} /><button className="ghost-button" onClick={() => void search()}>Search</button></div>{candidates.map((candidate) => <button className="invite-candidate" key={candidate.id} disabled={busy} onClick={() => void invite(candidate)}>@{candidate.username}<span>{candidate.displayName}</span><b>Invite</b></button>)}</div>
    <div className="room-access-actions"><button className="ghost-button" disabled={busy} onClick={() => void toggleLock()}>{room.isLocked ? "Unlock Room" : "Lock Room"}</button>{notice && <span className="access-notice">{notice}</span>}</div>
  </div>}</div>;
}

export function InvitationInbox({ repository, profile, onOpenRoom }: { repository: HyperoomRepository; profile: HyperoomProfile; onOpenRoom: (room: HyperoomRoom) => void }): React.JSX.Element {
  const [items, setItems] = useState<HyperoomRoomInvitation[]>([]); const [open, setOpen] = useState(false); const [busy, setBusy] = useState<string | null>(null);
  const refresh = async () => { try { setItems(await repository.listMyInvitations()); } catch { /* access errors are surfaced by the room flow */ } };
  useEffect(() => { void refresh(); const channel = repository.subscribeMyInvitations(() => void refresh()); return () => { channel.unsubscribe(); }; }, [repository, profile.id]);
  const count = items.length;
  async function respond(item: HyperoomRoomInvitation, accept: boolean) { setBusy(item.id); try { await repository.respondInvitation(item.id, accept); if (accept && item.room) { onOpenRoom(item.room); } await refresh(); } finally { setBusy(null); } }
  return <div className="invitation-inbox"><button className="ghost-button" onClick={() => setOpen(!open)}>Invites{count ? ` (${count})` : ""}</button>{open && <div className="invitation-panel"><strong>Room Invitations</strong>{!count && <div className="muted">No pending invitations.</div>}{items.map((item) => <div className="invitation-row" key={item.id}><div><strong>#{item.room?.name ?? item.roomId.slice(0, 8)}</strong><span>@{item.inviter?.username ?? item.inviterId.slice(0, 8)} invited you</span></div><div><button className="primary-button" disabled={busy === item.id} onClick={() => void respond(item, true)}>Accept</button><button className="ghost-button" disabled={busy === item.id} onClick={() => void respond(item, false)}>Decline</button></div></div>)}</div>}</div>;
}
