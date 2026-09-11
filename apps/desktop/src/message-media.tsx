import { useEffect, useRef, useState } from "react";
import type { HyperoomRoom } from "@hyperoom/shared";
import type { HyperoomRepository } from "@hyperoom/data";

type Attachment = { id: string; message_id: string; room_id: string; path: string; file_name: string; mime_type: string; size_bytes: number; width: number | null; height: number | null; duration_ms: number | null };

export function AttachmentComposer({ repository: _repository, room: _room, onReady }: { repository: HyperoomRepository; room: HyperoomRoom; onReady: (file: File | null) => void }): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  function choose(next: File | null): void {
    setError(null);
    if (!next) { setFile(null); onReady(null); return; }
    if (next.size > 50 * 1024 * 1024) { setError("Maximum attachment size is 50 MB."); return; }
    if (!/^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm)|audio\/(webm|ogg|mpeg)|application\/(pdf|zip|octet-stream)|text\/plain)$/i.test(next.type)) { setError("This file type is not supported."); return; }
    setFile(next); onReady(next);
  }
  return <div className="attachment-picker"><input ref={inputRef} type="file" hidden accept="image/*,video/mp4,video/webm,audio/webm,audio/ogg,audio/mpeg,application/pdf,text/plain,.zip" onChange={(e) => choose(e.target.files?.[0] ?? null)} /><button type="button" className="attachment-button" title="Attach file" aria-label="Attach file" onClick={() => inputRef.current?.click()}>＋</button>{file && <span className="attachment-selected" title={file.name}>📎 {file.name}</span>}{error && <span className="attachment-error">{error}</span>}</div>;
}

export function MessageAttachment({ repository, attachment }: { repository: HyperoomRepository; attachment: Attachment }): React.JSX.Element {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let dead = false; void repository.getAttachmentUrl(attachment.path).then((next) => { if (!dead) setUrl(next); }).catch(() => { if (!dead) setUrl(null); }); return () => { dead = true; }; }, [attachment.path, repository]);
  if (!url) return <div className="attachment-loading">Loading attachment…</div>;
  if (attachment.mime_type.startsWith("image/")) return <a className="attachment-image" href={url} target="_blank" rel="noreferrer"><img src={url} alt={attachment.file_name} loading="lazy" /></a>;
  if (attachment.mime_type.startsWith("video/")) return <video className="attachment-video" controls preload="metadata" src={url} />;
  if (attachment.mime_type.startsWith("audio/")) return <audio className="attachment-audio" controls preload="metadata" src={url} />;
  return <a className="attachment-file" href={url} target="_blank" rel="noreferrer" download={attachment.file_name}>📎 <strong>{attachment.file_name}</strong><small>{formatBytes(attachment.size_bytes)}</small></a>;
}

function formatBytes(value: number): string { if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB`; }
