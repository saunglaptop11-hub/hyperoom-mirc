import type {
  HyperoomMessage,
  HyperoomReaction,
  HyperoomRoomMember,
} from "@hyperoom/shared/dist/hyperoom.js";

export interface ChatRepositoryPort {
  joinRoom(roomId: string): Promise<HyperoomRoomMember>;
  leaveRoom(roomId: string): Promise<void>;
  sendMessage(input: SendMessageInput): Promise<HyperoomMessage>;
  editMessage(messageId: string, content: string): Promise<HyperoomMessage>;
  deleteMessage(messageId: string): Promise<void>;
  addReaction(messageId: string, emoji: string): Promise<HyperoomReaction>;
  removeReaction(messageId: string, emoji: string): Promise<void>;
}

export interface SendMessageInput {
  roomId: string;
  content: string;
  id?: string;
  kind?: "text" | "action" | "system";
  replyToMessageId?: string | null;
}

export function normalizeMessageContent(content: string): string {
  return content.trim();
}

export function assertMessageContent(content: string): string {
  const normalized = normalizeMessageContent(content);
  if (!normalized) throw new Error("Message content cannot be empty.");
  if (normalized.length > 4000) throw new Error("Message content cannot exceed 4000 characters.");
  return normalized;
}

export class HyperoomChatEngine {
  constructor(private readonly repository: ChatRepositoryPort) {}

  joinRoom(roomId: string): Promise<HyperoomRoomMember> {
    return this.repository.joinRoom(roomId);
  }

  leaveRoom(roomId: string): Promise<void> {
    return this.repository.leaveRoom(roomId);
  }

  async sendMessage(input: SendMessageInput): Promise<HyperoomMessage> {
    return this.repository.sendMessage({
      ...input,
      content: assertMessageContent(input.content),
    });
  }

  editMessage(messageId: string, content: string): Promise<HyperoomMessage> {
    return this.repository.editMessage(messageId, assertMessageContent(content));
  }

  deleteMessage(messageId: string): Promise<void> {
    return this.repository.deleteMessage(messageId);
  }

  addReaction(messageId: string, emoji: string): Promise<HyperoomReaction> {
    const value = emoji.trim();
    if (!value) throw new Error("Reaction emoji cannot be empty.");
    return this.repository.addReaction(messageId, value);
  }

  removeReaction(messageId: string, emoji: string): Promise<void> {
    const value = emoji.trim();
    if (!value) throw new Error("Reaction emoji cannot be empty.");
    return this.repository.removeReaction(messageId, value);
  }
}

export function createHyperoomChatEngine(repository: ChatRepositoryPort): HyperoomChatEngine {
  return new HyperoomChatEngine(repository);
}
