import type { HyperoomMessage, HyperoomProfile, HyperoomReaction, HyperoomRoom, HyperoomRoomMember, HyperoomRoomMemberProfile, HyperoomMessageEventType, HyperoomRoomInvitation, HyperoomRoomBan } from "@hyperoom/shared";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { HyperoomSupabaseClient } from "./client";
import type { Database } from "./database.types";

export interface CreateRoomInput { name: string; type?: Database["public"]["Enums"]["room_type"]; description?: string | null; topic?: string | null; isLocked?: boolean }
export interface UpdateRoomInput { name?: string; description?: string | null; topic?: string | null; isLocked?: boolean }
export interface SendMessageInput { roomId: string; content: string; kind?: Database["public"]["Enums"]["message_kind"]; eventType?: HyperoomMessageEventType | null; replyToMessageId?: string | null }
export interface RealtimeHandlers { onMessage?: (message: HyperoomMessage) => void; onMessageUpdated?: (message: HyperoomMessage) => void; onReaction?: (reaction: HyperoomReaction, removed: boolean) => void; onMemberChange?: (member: HyperoomRoomMember, removed: boolean) => void; onRoomChange?: (room: HyperoomRoom) => void; onStatus?: (status: string) => void }
function profile(row: Database["public"]["Tables"]["profiles"]["Row"]): HyperoomProfile { return { id: row.id, systemRole: row.system_role, username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url, bio: row.bio, statusText: row.status_text, lastSeenAt: row.last_seen_at, createdAt: row.created_at, updatedAt: row.updated_at }; }
function room(row: Database["public"]["Tables"]["rooms"]["Row"]): HyperoomRoom { return { id: row.id, name: row.name, type: row.type, description: row.description, topic: row.topic, isLocked: row.is_locked, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at }; }
function member(row: Database["public"]["Tables"]["room_members"]["Row"]): HyperoomRoomMember { return { roomId: row.room_id, userId: row.user_id, role: row.role, joinedAt: row.joined_at }; }
function message(row: Database["public"]["Tables"]["messages"]["Row"]): HyperoomMessage { return { id: row.id, roomId: row.room_id, senderId: row.sender_id, kind: row.kind, eventType: row.event_type, content: row.content, replyToMessageId: row.reply_to_message_id, createdAt: row.created_at, editedAt: row.edited_at, deletedAt: row.deleted_at }; }
function invitation(row: Database["public"]["Tables"]["room_invitations"]["Row"]): HyperoomRoomInvitation { return { id: row.id, roomId: row.room_id, inviterId: row.inviter_id, inviteeId: row.invitee_id, status: row.status, createdAt: row.created_at, respondedAt: row.responded_at }; }
function ban(row: Database["public"]["Functions"]["list_room_bans"]["Returns"][number]): HyperoomRoomBan { return { id: row.id, roomId: row.room_id, userId: row.user_id, username: row.username, bannedBy: row.banned_by, reason: row.reason, createdAt: row.created_at }; }
function reaction(row: Database["public"]["Tables"]["message_reactions"]["Row"]): HyperoomReaction { return { messageId: row.message_id, userId: row.user_id, emoji: row.emoji, createdAt: row.created_at }; }
async function requireUserId(client: HyperoomSupabaseClient, userId?: string): Promise<string> { if (userId) return userId; const { data, error } = await client.auth.getUser(); if (error) throw error; if (!data.user) throw new Error("Authentication required."); return data.user.id; }

export interface HyperoomRepository {
  getProfile(userId?: string): Promise<HyperoomProfile | null>;
  upsertProfile(input: { id: string; username: string; displayName: string; avatarUrl?: string | null; bio?: string | null; statusText?: string | null }): Promise<HyperoomProfile>;
  updateUsername(username: string): Promise<HyperoomProfile>;
  listPublicRooms(): Promise<HyperoomRoom[]>;
  createRoom(input: CreateRoomInput, userId?: string): Promise<HyperoomRoom>;
  getRoomByName(name: string): Promise<HyperoomRoom | null>;
  updateRoom(roomId: string, input: UpdateRoomInput): Promise<HyperoomRoom>;
  updateRoomTopic(roomId: string, topic: string | null): Promise<HyperoomRoom>;
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
  searchProfiles(username: string): Promise<HyperoomProfile[]>;
  createInvitation(roomId: string, inviteeId: string): Promise<HyperoomRoomInvitation>;
  listMyInvitations(): Promise<HyperoomRoomInvitation[]>;
  respondInvitation(invitationId: string, accept: boolean): Promise<HyperoomRoomInvitation>;
  moderateRoomMember(roomId: string, targetUsername: string, action: "kick" | "ban" | "unban", reason?: string): Promise<{ action: string; roomId: string; roomName: string; targetId: string; targetUsername: string; reason: string | null }>;
  listRoomBans(roomId: string): Promise<HyperoomRoomBan[]>;
  transferRoomOwnership(roomId: string, targetUsername: string): Promise<HyperoomRoomMember>;
  setRoomOperator(roomId: string, targetUsername: string, enabled: boolean): Promise<HyperoomRoomMember>;

  joinRoomByName(name: string): Promise<{ status: "allowed" | "locked" | "banned" | "not_found"; room: HyperoomRoom | null }>;
  subscribeMyInvitations(onChange: (items: HyperoomRoomInvitation[]) => void): RealtimeChannel;
  subscribeRoom(roomId: string, handlers: RealtimeHandlers): RealtimeChannel;
  subscribePublicRooms(onChange: (rooms: HyperoomRoom[]) => void): RealtimeChannel;
}

export function createHyperoomRepository(client: HyperoomSupabaseClient): HyperoomRepository {
  return {
    async getProfile(userId) { const id = await requireUserId(client, userId); const { data, error } = await client.from("profiles").select("*").eq("id", id).maybeSingle(); if (error) throw error; return data ? profile(data) : null; },
    async upsertProfile(input) { const id = await requireUserId(client, input.id); if (id !== input.id) throw new Error("A profile may only be written for the authenticated user."); const { data, error } = await client.from("profiles").upsert({ id: input.id, username: input.username, display_name: input.displayName, avatar_url: input.avatarUrl, bio: input.bio, status_text: input.statusText }).select("*").single(); if (error) throw error; return profile(data); },
    async updateUsername(username) { const id = await requireUserId(client); const { data, error } = await client.from("profiles").update({ username }).eq("id", id).select("*").single(); if (error) throw error; return profile(data); },
    async listPublicRooms() { const { data, error } = await client.from("rooms").select("*").eq("type", "public").order("name"); if (error) throw error; return data.map(room); },
    async createRoom(input, userId) {
      const id = await requireUserId(client, userId); const name = input.name.trim().replace(/^#/, "");
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(name)) throw new Error("Invalid room name. Use 1-32 letters, numbers, _ or -.");
      if ((input.description?.length ?? 0) > 500) throw new Error("Room description cannot exceed 500 characters.");
      if ((input.topic?.length ?? 0) > 200) throw new Error("Room topic cannot exceed 200 characters.");
      const { data, error } = await client.from("rooms").insert({ name, type: input.type ?? "public", description: input.description?.trim() || null, topic: input.topic?.trim() || null, is_locked: input.isLocked ?? false, created_by: id }).select("*").single();
      if (error) throw error; const created = room(data); const actor = await this.getProfile(id); const event = await client.from("messages").insert({ room_id: created.id, sender_id: id, kind: "system", event_type: "create", content: `*** ${actor?.username ?? id.slice(0, 8)} created #${created.name}` }); if (event.error) throw event.error; return created;
    },
    async getRoomByName(name) { const access = await this.joinRoomByName(name); return access.room; },
    async updateRoom(roomId, input) {
      const next: Database["public"]["Tables"]["rooms"]["Update"] = {};
      if (input.name !== undefined) { const name = input.name.trim().replace(/^#/, ""); if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(name)) throw new Error("Invalid room name. Use 1-32 letters, numbers, _ or -."); next.name = name; }
      if (input.description !== undefined) { if ((input.description?.length ?? 0) > 500) throw new Error("Room description cannot exceed 500 characters."); next.description = input.description?.trim() || null; }
      if (input.topic !== undefined) { if ((input.topic?.length ?? 0) > 200) throw new Error("Room topic cannot exceed 200 characters."); next.topic = input.topic?.trim() || null; }
      if (input.isLocked !== undefined) next.is_locked = input.isLocked;
      const { data, error } = await client.from("rooms").update(next).eq("id", roomId).select("*").single(); if (error) throw error; return room(data);
    },
    async updateRoomTopic(roomId, topic) {
      const { data, error } = await client.rpc("update_room_topic", { p_room_id: roomId, p_topic: topic });
      if (error) throw error;
      return room(data);
    },
    async joinRoom(roomId, userId) {
      const id = await requireUserId(client, userId);
      const { data, error } = await client.from("room_members").upsert({ room_id: roomId, user_id: id, role: "member" }, { onConflict: "room_id,user_id", ignoreDuplicates: true }).select("*").maybeSingle();
      if (error) throw error;
      if (data) { const actor = await this.getProfile(id); const event = await client.from("messages").insert({ room_id: roomId, sender_id: id, kind: "system", event_type: "join", content: `*** ${actor?.username ?? id.slice(0, 8)} joined the channel` }); if (event.error) throw event.error; return member(data); }
      const { data: existing, error: readError } = await client.from("room_members").select("*").eq("room_id", roomId).eq("user_id", id).single(); if (readError) throw readError; return member(existing);
    },
    async leaveRoom(roomId, userId) {
      const id = await requireUserId(client, userId); const current = await client.from("room_members").select("*").eq("room_id", roomId).eq("user_id", id).single(); if (current.error) throw current.error; if (current.data.role === "owner") throw new Error("Room owner cannot leave the room.");
      const actor = await this.getProfile(id); const event = await client.from("messages").insert({ room_id: roomId, sender_id: id, kind: "system", event_type: "part", content: `*** ${actor?.username ?? id.slice(0, 8)} left the channel` }); if (event.error) throw event.error;
      const { error } = await client.from("room_members").delete().eq("room_id", roomId).eq("user_id", id); if (error) throw error;
    },
    async listMembers(roomId) { const { data, error } = await client.from("room_members").select("*").eq("room_id", roomId).order("joined_at"); if (error) throw error; return data.map(member); },
    async listMemberProfiles(roomId) { const members = await this.listMembers(roomId); const ids = members.map((item) => item.userId); if (!ids.length) return []; const { data, error } = await client.from("profiles").select("*").in("id", ids); if (error) throw error; const profiles = new Map(data.map((row) => [row.id, profile(row)])); return members.flatMap((item) => { const current = profiles.get(item.userId); return current ? [{ ...item, profile: current }] : []; }); },
    async listMessages(roomId, limit = 50) { const safeLimit = Math.max(1, Math.min(limit, 100)); const { data, error } = await client.from("messages").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(safeLimit); if (error) throw error; return data.reverse().map(message); },
    async sendMessage(input, userId) { const id = await requireUserId(client, userId); const content = input.content.trim(); if (!content) throw new Error("Message content cannot be empty."); const { data, error } = await client.from("messages").insert({ room_id: input.roomId, sender_id: id, kind: input.kind ?? "text", event_type: input.eventType ?? null, content, reply_to_message_id: input.replyToMessageId ?? null }).select("*").single(); if (error) throw error; return message(data); },
    async editMessage(messageId, content) { const next = content.trim(); if (!next) throw new Error("Message content cannot be empty."); const { data, error } = await client.from("messages").update({ content: next, edited_at: new Date().toISOString() }).eq("id", messageId).select("*").single(); if (error) throw error; return message(data); },
    async deleteMessage(messageId) { const { error } = await client.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", messageId); if (error) throw error; },
    async addReaction(messageId, emoji, userId) { const id = await requireUserId(client, userId); const value = emoji.trim(); if (!value) throw new Error("Reaction emoji cannot be empty."); const { data, error } = await client.from("message_reactions").upsert({ message_id: messageId, user_id: id, emoji: value }, { onConflict: "message_id,user_id,emoji" }).select("*").single(); if (error) throw error; return reaction(data); },
    async removeReaction(messageId, emoji, userId) { const id = await requireUserId(client, userId); const { error } = await client.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", id).eq("emoji", emoji); if (error) throw error; },
    async searchProfiles(username) { const value = username.trim(); if (!value) return []; const { data, error } = await client.from("profiles").select("*").ilike("username", `%${value}%`).order("username").limit(10); if (error) throw error; return data.map(profile); },
    async createInvitation(roomId, inviteeId) { const inviterId = await requireUserId(client); if (inviterId === inviteeId) throw new Error("You cannot invite yourself."); const { data, error } = await client.from("room_invitations").insert({ room_id: roomId, inviter_id: inviterId, invitee_id: inviteeId }).select("*").single(); if (error) throw error; return invitation(data); },
    async listMyInvitations() { await requireUserId(client); const { data, error } = await client.rpc("list_my_room_invitations"); if (error) throw error; return (data ?? []).map((row) => ({ id: row.id, roomId: row.room_id, inviterId: row.inviter_id, inviteeId: "", status: row.status, createdAt: row.created_at, respondedAt: null, room: { id: row.room_id, name: row.room_name, type: "public", description: null, topic: null, isLocked: true, createdBy: "", createdAt: row.created_at, updatedAt: row.created_at }, inviter: { id: row.inviter_id, username: row.inviter_username, displayName: row.inviter_username, systemRole: "member", avatarUrl: null, bio: null, statusText: null, lastSeenAt: null, createdAt: row.created_at, updatedAt: row.created_at } })); },
    async respondInvitation(invitationId, accept) { await requireUserId(client); const { data, error } = await client.rpc("respond_room_invitation", { p_invitation_id: invitationId, p_accept: accept }); if (error) throw error; return invitation(data); },
    async moderateRoomMember(roomId, targetUsername, action, reason) { await requireUserId(client); const { data, error } = await client.rpc("moderate_room_member", { p_room_id: roomId, p_target_username: targetUsername.replace(/^@/, ""), p_action: action, p_reason: reason?.trim() || null }); if (error) throw error; const row = data?.[0]; if (!row) throw new Error("Moderation action failed."); return { action: row.action, roomId: row.room_id, roomName: row.room_name, targetId: row.target_id, targetUsername: row.target_username, reason: row.reason }; },
    async listRoomBans(roomId) { await requireUserId(client); const { data, error } = await client.rpc("list_room_bans", { p_room_id: roomId }); if (error) throw error; return (data ?? []).map(ban); },
    async transferRoomOwnership(roomId, targetUsername) {
      const { data, error } = await client.rpc("transfer_room_ownership", { p_room_id: roomId, p_target_username: targetUsername.replace(/^@/, "") });
      if (error) throw error;
      const row = data?.[0]; if (!row) throw new Error("Ownership transfer failed.");
      return member(row);
    },
    async setRoomOperator(roomId, targetUsername, enabled) {
      const { data, error } = await client.rpc("set_room_operator", { p_room_id: roomId, p_target_username: targetUsername.replace(/^@/, ""), p_enabled: enabled });
      if (error) throw error;
      const row = data?.[0]; if (!row) throw new Error("Operator change failed.");
      return member(row);
    },
    async joinRoomByName(name) { const { data, error } = await client.rpc("join_room_by_name", { p_name: name }); if (error) throw error; const row = data?.[0]; if (!row?.status || row.status === "not_found") return { status: "not_found", room: null }; if (row.status === "locked") return { status: "locked", room: null }; if (row.status === "banned") return { status: "banned", room: null }; return { status: "allowed", room: { id: row.room_id!, name: row.room_name!, type: row.type!, description: row.description, topic: row.topic, isLocked: row.is_locked!, createdBy: row.created_by!, createdAt: row.created_at!, updatedAt: row.updated_at! } }; },
    subscribeMyInvitations(onChange) { const channel = client.channel("room-invitations:mine"); const refresh = () => { void this.listMyInvitations().then(onChange); }; channel.on("postgres_changes", { event: "*", schema: "public", table: "room_invitations" }, refresh); void channel.subscribe(); return channel; },
    subscribePublicRooms(onChange) { const channel = client.channel("rooms:public"); channel.on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => { void this.listPublicRooms().then(onChange); }); void channel.subscribe(); return channel; },
    subscribeRoom(roomId, handlers) {
      const channel = client.channel(`room:${roomId}`);
      if (handlers.onMessage) channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, payload => handlers.onMessage?.(message(payload.new as Database["public"]["Tables"]["messages"]["Row"])));
      if (handlers.onMessageUpdated) channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, payload => handlers.onMessageUpdated?.(message(payload.new as Database["public"]["Tables"]["messages"]["Row"])));
      if (handlers.onReaction) { channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions" }, payload => handlers.onReaction?.(reaction(payload.new as Database["public"]["Tables"]["message_reactions"]["Row"]), false)); channel.on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, payload => handlers.onReaction?.(reaction(payload.old as Database["public"]["Tables"]["message_reactions"]["Row"]), true)); }
      if (handlers.onMemberChange) { channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, payload => handlers.onMemberChange?.(member(payload.new as Database["public"]["Tables"]["room_members"]["Row"]), false)); channel.on("postgres_changes", { event: "DELETE", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, payload => handlers.onMemberChange?.(member(payload.old as Database["public"]["Tables"]["room_members"]["Row"]), true)); }
      if (handlers.onRoomChange) channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, payload => handlers.onRoomChange?.(room(payload.new as Database["public"]["Tables"]["rooms"]["Row"])));
      void channel.subscribe((status) => handlers.onStatus?.(status)); return channel;
    },
  };
}
