import React from "react";
import type { HyperoomRoom } from "@hyperoom/shared";

export function OnlineBadge({ count }: { count: number }): React.JSX.Element {
  return <span className="online-count"><span className="online-dot" />{count} online</span>;
}

export function RoomStateLabel({ room, count }: { room: HyperoomRoom; count: number }): React.JSX.Element {
  return <span className="room-state"><span>{room.isLocked ? "🔒" : "●"}</span><OnlineBadge count={count} /></span>;
}

export function GlobalOnline({ count }: { count: number }): React.JSX.Element {
  return <span className="global-online"><span className="online-dot" />{count} Online</span>;
}

// realtime presence source of truth
