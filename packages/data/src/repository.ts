import type { RealtimeChannel } from "@supabase/supabase-js";
import type { HyperoomMessage, HyperoomProfile, HyperoomReaction, HyperoomRoom, HyperoomRoomMember, HyperoomRoomMemberProfile } from "@hyperoom/shared";
import type { HyperoomSupabaseClient } from "./client";
import type { Database } from "./database.types";

export interface CreateRoomInput { name: string; type?: Database["public"]["Enums"]["room_type"]; description?: string | null }
export interface SendMessageInput { roomId: string; content: string; kind?: Database["public"]["Enums"]["message_kind"]; replyToMessageId?: string | null }
export interface RealtimeHandlers { onMessage?: (message: HyperoomMessage) => void; onMessageUpdated?: (message: HyperoomMessage) => void; onReaction?: (reaction: HyperoomReaction, removed: boolean) => void; onMemberChange?: (member: HyperoomRoomMember, removed: boolean) => void }

function profile(row: Database["public"]["Tables"]["profiles"]["Row"]): HyperoomProfile {
  return { id: row.id, systemRole: row.system_role, username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url, bio: row.bio, statusText: row.status_text, lastSeenAt: row.last_seen_at, createdAt: row.created_at, updatedAt: row.updated_at };
}
function room(row: Database["public"]["Tables"]["rooms"]["Row"]): HyperoomRoom {
  return { id: row.id, name: row.name, type: row.type, description: row.description, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at };
}
function member(row: Database["public"]["Tables"]["room_members"]["Row"]): HyperoomRoomMember {
  return { roomId: row.room_id, userId: row.user_id, role: row.role, joinedAt: row.joined_at };
}
function message(row: Database["public"]["Tables"]["messages"]["Row"]): HyperoomMessage {
  return { id: row.id, roomId: row.room_id, senderId: row.sender_id, kind: row.kind, content: row.content, replyToMessageId: row.reply_to_message_id, createdAt: row.created_at, editedAt: row.edited_at, deletedAt: row.deleted_at };
}
function reaction(row: Database["public"]["Tables"]["message_reactions"]["Row"]): HyperoomReaction {
  return { messageId: row.message_id, userId: row.user_id, emoji: row.emoji, createdAt: row.created_at };
}
export interface HyperoomRepository {
  getProfile(userId?: string): Promise<HyperoomProfile | null>;
  upsertProfile(input: { id: string; username: string; displayName: string; avatarUrl?: string | null; bio?: string | null; statusText?: string | null }): Promise<HyperoomProfile>;
  listPublicRooms(): Promise<HyperoomRoom[]>;
  createRoom(input: CreateRoomInput, userId?: string): Promise<HyperoomRoom>;
  getRoomByName(name: string): Promise<HyperoomRoom | null>;
  joinRoom(roomId: string, userId?: string): Promise<HyperoomRoomMember>;
  leaveRoom(roomId: string, userId?: string): Promise<void>;
  listMembers(roomId: string): Promise<HyperoomRoomMember[]>;
  listMemberProfiles(roomId: string): Promise<HyperoomRoomMemberProfile[]>;
  listMessages(roomId: string, limit?: number): Promise<HyperoomMessage[]>;
  sendMessage(input: SendMessageInput, userId?: string): Promise<HyperoomMessage>;
  editMessage(messageId: string, content: string): Promise<HyperoomMessage>;
  deleteMessage(messageId: string): Promise<void>;
  addReaction(messageId: string, emoji: string, userId?: string): Promise<HyperoomReaction>;
  removeReaction(messageId: string, emoji: string, userId?: string): Promise<void>;
  subscribeRoom(roomId: string, handlers: RealtimeHandlers): RealtimeChannel;
}

async function requireUserId(client: HyperoomSupabaseClient, userId?: string): Promise<string> {
  if (userId) return userId;
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Authentication required.");
  return data.user.id;
}

export function createHyperoomRepository(client: HyperoomSupabaseClient): HyperoomRepository {
  return {
    async getProfile(userId) {
      const id = await requireUserId(client, userId);
      const { data, error } = await client.from("profiles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? profile(data) : null;
    },
    async upsertProfile(input) {
      const id = await requireUserId(client, input.id);
      if (id !== input.id) throw new Error("A profile may only be written for the authenticated user.");
      const { data, error } = await client.from("profiles").upsert({
        id: input.id,
        username: input.username,
        display_name: input.displayName,
        avatar_url: input.avatarUrl,
        bio: input.bio,
        status_text: input.statusText,
      }).select("*").single();
      if (error) throw error;
      return profile(data);
    },
    async listPublicRooms() {
      const { data, error } = await client.from("rooms").select("*").eq("type", "public").order("name");
      if (error) throw error;
      return data.map(room);
    },
    async createRoom(input, userId) {
      const id = await requireUserId(client, userId);
      const { data, error } = await client.from("rooms").insert({ name: input.name, type: input.type ?? "public", description: input.description ?? null, created_by: id }).select("*").single();
      if (error) throw error;
      return room(data);
    },
    async getRoomByName(name) {
      const normalized = name.trim().replace(/^#/, "");
      const { data, error } = await client.from("rooms").select("*").ilike("name", normalized).maybeSingle();
      if (error) throw error;
      return data ? room(data) : null;
    },
    async joinRoom(roomId, userId) {
      const id = await requireUserId(client, userId);
      const { data, error } = await client.from("room_members").upsert(
        { room_id: roomId, user_id: id, role: "member" },
        { onConflict: "room_id,user_id", ignoreDuplicates: true },
      ).select("*").maybeSingle();
      if (error) throw error;
      if (data) return member(data);
      const { data: existing, error: readError } = await client.from("room_members").select("*").eq("room_id", roomId).eq("user_id", id).single();
      if (readError) throw readError;
      return member(existing);
    },
    async leaveRoom(roomId, userId) {
      const id = await requireUserId(client, userId);
      const { error } = await client.from("room_members").delete().eq("room_id", roomId).eq("user_id", id);
      if (error) throw error;
    },
    async listMembers(roomId) {
      const { data, error } = await client.from("room_members").select("*").eq("room_id", roomId).order("joined_at");
      if (error) throw error;
      return data.map(member);
    },
    async listMemberProfiles(roomId) {
      const members = await this.listMembers(roomId);
      const ids = members.map((item) => item.userId);
      if (!ids.length) return [];
      const { data, error } = await client.from("profiles").select("*").in("id", ids);
      if (error) throw error;
      const profiles = new Map(data.map((row) => [row.id, profile(row)]));
      return members.flatMap((item) => {
        const current = profiles.get(item.userId);
        return current ? [{ ...item, profile: current }] : [];
      });
    },
    async listMessages(roomId, limit = 50) {
      const safeLimit = Math.max(1, Math.min(limit, 100));
      const { data, error } = await client.from("messages").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(safeLimit);
      if (error) throw error;
      return data.reverse().map(message);
    },
    async sendMessage(input, userId) {
      const id = await requireUserId(client, userId);
      const content = input.content.trim();
      if (!content) throw new Error("Message content cannot be empty.");
      const { data, error } = await client.from("messages").insert({
        room_id: input.roomId,
        sender_id: id,
        kind: input.kind ?? "text",
        content,
        reply_to_message_id: input.replyToMessageId ?? null,
      }).select("*").single();
      if (error) throw error;
      return message(data);
    },
    async editMessage(messageId, content) {
      const next = content.trim();
      if (!next) throw new Error("Message content cannot be empty.");
      const { data, error } = await client.from("messages").update({ content: next, edited_at: new Date().toISOString() }).eq("id", messageId).select("*").single();
      if (error) throw error;
      return message(data);
    },
    async deleteMessage(messageId) {
      const { error } = await client.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", messageId);
      if (error) throw error;
    },
    async addReaction(messageId, emoji, userId) {
      const id = await requireUserId(client, userId);
      const value = emoji.trim();
      if (!value) throw new Error("Reaction emoji cannot be empty.");
      const { data, error } = await client.from("message_reactions").upsert({ message_id: messageId, user_id: id, emoji: value }, { onConflict: "message_id,user_id,emoji" }).select("*").single();
      if (error) throw error;
      return reaction(data);
    },
    async removeReaction(messageId, emoji, userId) {
      const id = await requireUserId(client, userId);
      const { error } = await client.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", id).eq("emoji", emoji);
      if (error) throw error;
    },
    subscribeRoom(roomId, handlers) {
      const channel = client.channel(`room:${roomId}`);
      if (handlers.onMessage) {
        channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, payload => handlers.onMessage?.(message(payload.new as Database["public"]["Tables"]["messages"]["Row"])));
      }
      if (handlers.onMessageUpdated) {
        channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, payload => handlers.onMessageUpdated?.(message(payload.new as Database["public"]["Tables"]["messages"]["Row"])));
      }
      if (handlers.onReaction) {
        channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions" }, payload => handlers.onReaction?.(reaction(payload.new as Database["public"]["Tables"]["message_reactions"]["Row"]), false));
        channel.on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, payload => handlers.onReaction?.(reaction(payload.old as Database["public"]["Tables"]["message_reactions"]["Row"]), true));
      }
      if (handlers.onMemberChange) {
        channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, payload => handlers.onMemberChange?.(member(payload.new as Database["public"]["Tables"]["room_members"]["Row"]), false));
        channel.on("postgres_changes", { event: "DELETE", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, payload => handlers.onMemberChange?.(member(payload.old as Database["public"]["Tables"]["room_members"]["Row"]), true));
      }
      void channel.subscribe();
      return channel;
    },
  };
}
