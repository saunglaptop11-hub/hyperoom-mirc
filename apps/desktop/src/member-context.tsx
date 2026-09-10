import React, { useEffect, useState } from "react";
import type { HyperoomProfile, HyperoomRoom, HyperoomRoomMemberProfile } from "@hyperoom/shared";
import type { HyperoomRepository } from "@hyperoom/data";

type Props = {
  repository: HyperoomRepository;
  room: HyperoomRoom;
  actor: HyperoomProfile;
  target: HyperoomRoomMemberProfile;
  actorRoomRole: string | null;
  online: boolean;
  onMention: (username: string) => void;
  onChanged: () => void;
  onDirectMessage: (room: HyperoomRoom) => void;
};

function platformLevel(role: HyperoomProfile["systemRole"]): number { return role === "owner" ? 40 : role === "admin" ? 30 : role === "moderator" ? 20 : 10; }
function roomLevel(role: string | null): number { return role === "owner" ? 40 : role === "operator" ? 30 : role === "voice" ? 20 : 10; }

export function canModerateTarget(actor: HyperoomProfile, actorRoomRole: string | null, target: HyperoomRoomMemberProfile): boolean {
  if (actor.id === target.userId) return false;
  if (actor.systemRole !== "member") return platformLevel(actor.systemRole) > platformLevel(target.profile.systemRole);
  if (!actorRoomRole || target.profile.systemRole !== "member") return false;
  return ["owner", "operator"].includes(actorRoomRole) && target.role !== "owner" && roomLevel(actorRoomRole) > roomLevel(target.role);
}

export function MemberContextMenu({ repository, room, actor, target, actorRoomRole, online, onMention, onChanged, onDirectMessage }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwnerAuthority = actor.systemRole === "owner" || actorRoomRole === "owner";
  const canInvite = actor.systemRole === "owner" || actorRoomRole === "owner";
  const canModerate = canModerateTarget(actor, actorRoomRole, target);
  const canGrant = isOwnerAuthority && target.role !== "owner" && target.role !== "operator";
  const canRevoke = isOwnerAuthority && target.role === "operator";
  const canTransfer = isOwnerAuthority && target.role !== "owner";

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await action(); onChanged(); setOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
    finally { setBusy(false); }
  }

  return <div className="member-context-wrap" onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); setError(null); }}>
    <button className="member-context-trigger" onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }} aria-label={`Actions for ${target.profile.username}`}>
      â‹¯
    </button>
    {open && <div className="member-context-menu" onClick={(event) => event.stopPropagation()}>
      <button onClick={() => { setProfileOpen(true); setOpen(false); }}>View Profile</button>
      <button onClick={() => { onMention(target.profile.username); setOpen(false); }}>Mention</button>{actor.id !== target.userId && <button disabled={busy} onClick={() => void repository.openDirectMessage(target.profile.username).then((next) => { onDirectMessage(next); setOpen(false); }).catch((e) => setError(e instanceof Error ? e.message : "Could not open DM."))}>Message</button>}
      {canInvite && <button onClick={() => void run(() => repository.createInvitation(room.id, target.userId))}>Invite</button>}
      {canModerate && <button disabled={busy} onClick={() => void run(() => repository.moderateRoomMember(room.id, target.profile.username, "kick"))}>Kick</button>}
      {canModerate && <button disabled={busy} onClick={() => void run(() => repository.moderateRoomMember(room.id, target.profile.username, "ban"))}>Ban</button>}
      {canGrant && <button disabled={busy} onClick={() => void run(() => repository.setRoomOperator(room.id, target.profile.username, true))}>Grant Operator</button>}
      {canRevoke && <button disabled={busy} onClick={() => void run(() => repository.setRoomOperator(room.id, target.profile.username, false))}>Revoke Operator</button>}
      {canTransfer && <button disabled={busy} onClick={() => void run(() => repository.transferRoomOwnership(room.id, target.profile.username))}>Transfer Ownership</button>}
      {error && <span className="member-context-error">{error}</span>}
    </div>}
    {profileOpen && <div className="member-profile-popover" onClick={(event) => event.stopPropagation()}><button className="profile-close" onClick={() => setProfileOpen(false)}>Ã—</button><div className="member-avatar large">{target.profile.displayName.slice(0, 1).toUpperCase()}</div><strong>{target.profile.displayName}</strong><span>@{target.profile.username}</span><small>Room role: {target.role}</small><small>{online ? "Online now" : target.profile.lastSeenAt ? `Last seen ${new Date(target.profile.lastSeenAt).toLocaleString()}` : "Last seen unavailable"}</small>{target.profile.statusText && <small>Status: {target.profile.statusText}</small>}{target.profile.bio && <p>{target.profile.bio}</p>}</div>}
  </div>;
}
