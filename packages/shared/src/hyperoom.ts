export type HyperoomRoomType = "public" | "private" | "dm" | "group";
export type HyperoomRoomLifecycle = "active" | "archived" | "permanent";
export type HyperoomPlatformRole = "owner" | "admin" | "moderator" | "member";
export type HyperoomMemberRole = "owner" | "operator" | "voice" | "member";
export type MessageKind = "text" | "action" | "system";
export type HyperoomMessageEventType = "create" | "join" | "part" | "quit" | "topic" | "nick" | "action" | "lock" | "unlock" | "kick" | "ban" | "unban" | "invite" | "op" | "deop" | "owner";
export type HyperoomRoomInvitationStatus = "pending" | "accepted" | "declined" | "revoked";

export interface HyperoomProfile {
  id: string; systemRole: HyperoomPlatformRole; username: string; displayName: string;
  avatarUrl: string | null; bio: string | null; statusText: string | null; lastSeenAt: string | null; lastRoomId: string | null;
  createdAt: string; updatedAt: string;
}
export interface HyperoomRoom {
  id: string; name: string; type: HyperoomRoomType; description: string | null; topic: string | null;
  isLocked: boolean; lifecycle: HyperoomRoomLifecycle; lastActivityAt: string; createdBy: string; createdAt: string; updatedAt: string;
}
export interface HyperoomRoomMember { roomId: string; userId: string; role: HyperoomMemberRole; joinedAt: string; }
export interface HyperoomRoomMemberProfile extends HyperoomRoomMember { profile: HyperoomProfile; }
export interface HyperoomRoomInvitation { id: string; roomId: string; inviterId: string; inviteeId: string; status: HyperoomRoomInvitationStatus; createdAt: string; respondedAt: string | null; room?: HyperoomRoom; inviter?: HyperoomProfile; invitee?: HyperoomProfile; }
export interface HyperoomRoomBan { id: string; roomId: string; userId: string; username: string; bannedBy: string; reason: string | null; createdAt: string; }
export interface HyperoomMessage {
  id: string; roomId: string; senderId: string; kind: MessageKind; eventType: HyperoomMessageEventType | null;
  content: string; replyToMessageId: string | null; createdAt: string; editedAt: string | null; deletedAt: string | null;
}
export interface HyperoomReaction { messageId: string; userId: string; emoji: string; createdAt: string; }
export type HyperoomPresenceStatus = "online" | "offline";
export interface HyperoomPresence { userId: string; status: HyperoomPresenceStatus; lastSeenAt: string | null; typingRoomId?: string; activeRoomId?: string | null; }
export interface HyperoomPresenceSnapshot { globalCount: number; roomCounts: Record<string, number>; }
export type HyperoomEvent =
  | { type: "room.created"; room: HyperoomRoom }
  | { type: "room.member.joined"; member: HyperoomRoomMember }
  | { type: "room.member.left"; member: HyperoomRoomMember }
  | { type: "message.created"; message: HyperoomMessage }
  | { type: "message.updated"; message: HyperoomMessage }
  | { type: "message.reaction.created"; reaction: HyperoomReaction }
  | { type: "message.reaction.deleted"; reaction: HyperoomReaction };
