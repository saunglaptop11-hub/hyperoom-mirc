export type HyperoomRoomType = "public" | "private" | "dm" | "group";
export type HyperoomPlatformRole = "owner" | "admin" | "moderator" | "member";
export type HyperoomMemberRole = "owner" | "admin" | "operator" | "voice" | "member";
export type MessageKind = "text" | "action" | "system";

export interface HyperoomProfile {
  id: string;
  systemRole: HyperoomPlatformRole;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  statusText: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HyperoomRoom {
  id: string;
  name: string;
  type: HyperoomRoomType;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HyperoomRoomMember {
  roomId: string;
  userId: string;
  role: HyperoomMemberRole;
  joinedAt: string;
}

export interface HyperoomRoomMemberProfile extends HyperoomRoomMember {
  profile: HyperoomProfile;
}

export interface HyperoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  kind: MessageKind;
  content: string;
  replyToMessageId: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface HyperoomReaction {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export type HyperoomPresenceStatus = "online" | "offline";

export interface HyperoomPresence {
  userId: string;
  status: HyperoomPresenceStatus;
  lastSeenAt: string | null;
  typingRoomId?: string;
}

export type HyperoomEvent =
  | { type: "room.created"; room: HyperoomRoom }
  | { type: "room.member.joined"; member: HyperoomRoomMember }
  | { type: "room.member.left"; member: HyperoomRoomMember }
  | { type: "message.created"; message: HyperoomMessage }
  | { type: "message.updated"; message: HyperoomMessage }
  | { type: "message.reaction.created"; reaction: HyperoomReaction }
  | { type: "message.reaction.deleted"; reaction: HyperoomReaction };
