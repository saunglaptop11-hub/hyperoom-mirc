import React, { useEffect, useState } from "react";
import type { HyperoomRepository } from "@hyperoom/data";
import type { HyperoomProfile } from "@hyperoom/shared";

type Props = { repository: HyperoomRepository; profile: HyperoomProfile; onUpdated: (profile: HyperoomProfile) => void; onClose: () => void };

export function ProfilePanel({ repository, profile, onUpdated, onClose }: Props): React.JSX.Element {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [statusText, setStatusText] = useState(profile.statusText ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setDisplayName(profile.displayName); setBio(profile.bio ?? ""); setStatusText(profile.statusText ?? ""); setAvatarUrl(profile.avatarUrl ?? ""); }, [profile]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const next = await repository.upsertProfile({ id: profile.id, username: profile.username, displayName: displayName.trim() || profile.username, bio: bio.trim() || null, statusText: statusText.trim() || null, avatarUrl: avatarUrl.trim() || null });
      onUpdated(next); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Profile update failed."); }
    finally { setBusy(false); }
  }
  return <div className="profile-overlay" role="dialog" aria-modal="true" aria-label="Edit profile" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <form className="profile-panel" onSubmit={save}>
      <div className="profile-panel-header"><div><span className="eyebrow">PROFILE</span><h2>Edit Profile</h2></div><button type="button" className="profile-close" onClick={onClose}>×</button></div>
      <div className="profile-preview"><div className="profile-avatar-large">{displayName.slice(0, 1).toUpperCase()}</div><div><strong>{displayName || profile.username}</strong><span>@{profile.username}</span><small>Platform role: {profile.systemRole.toUpperCase()}</small></div></div>
      <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} required /></label>
      <label>Status<input value={statusText} onChange={(event) => setStatusText(event.target.value)} maxLength={120} placeholder="What are you up to?" /></label>
      <label>Bio<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} placeholder="A short bio" /></label>
      <label>Avatar URL<input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} maxLength={500} placeholder="https://..." /></label>
      {error && <div className="error-box">{error}</div>}
      <div className="profile-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving..." : "Save Profile"}</button></div>
    </form>
  </div>;
}
