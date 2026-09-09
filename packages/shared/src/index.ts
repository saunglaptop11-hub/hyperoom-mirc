export type EntityId = string;

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

export type RoomType = "public" | "private" | "dm" | "group";

export type MemberRole = "owner" | "admin" | "operator" | "voice" | "member";

export interface UserProfile {
  userId: EntityId;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  statusText?: string;
}

export interface Room {
  roomId: EntityId;
  name: string;
  type: RoomType;
  description?: string;
  createdBy: EntityId;
}

export interface RoomMember {
  roomId: EntityId;
  userId: EntityId;
  role: MemberRole;
  joinedAt: string;
}

export interface ChatMessage {
  messageId: EntityId;
  roomId: EntityId;
  senderId: EntityId;
  content: string;
  replyToMessageId?: EntityId;
  createdAt: string;
  editedAt?: string;
}

export type HyperoomEvent =
  | { type: "room.created"; room: Room }
  | { type: "room.member.joined"; member: RoomMember }
  | { type: "room.member.left"; member: RoomMember }
  | { type: "message.created"; message: ChatMessage }
  | { type: "message.updated"; message: ChatMessage };

export type HyperoomCommand =
  | { type: "room.join"; roomId: EntityId }
  | { type: "room.leave"; roomId: EntityId }
  | { type: "message.send"; roomId: EntityId; content: string; replyToMessageId?: EntityId };

export interface IrcServerConfig {
  host: string;
  port: number;
  tls: boolean;
  nickname: string;
  username: string;
  realname: string;
}

export interface IrcConnectionState {
  status: ConnectionStatus;
  server?: IrcServerConfig;
  error?: string;
}

export type IpcCommand =
  | { type: "connection.connect"; config: IrcServerConfig }
  | { type: "connection.disconnect" };

export type IpcEvent =
  | { type: "connection.state"; state: IrcConnectionState }
  | { type: "connection.error"; message: string };


export * from "./hyperoom";
export * from "./commands/types";
export { parseHyperoomCommand } from "./commands/parser";
export type { NativeHyperoomCommand, ParsedCommand, CommandParseError, CommandParseResult } from "./commands/types";
