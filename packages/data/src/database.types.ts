import type { HyperoomMemberRole, HyperoomMessageEventType, HyperoomPlatformRole, HyperoomRoomInvitationStatus, HyperoomRoomType, MessageKind } from "@hyperoom/shared";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; system_role: HyperoomPlatformRole; username: string; display_name: string; avatar_url: string | null; bio: string | null; status_text: string | null; last_seen_at: string | null; created_at: string; updated_at: string };
        Insert: { id: string; system_role?: HyperoomPlatformRole; username: string; display_name: string; avatar_url?: string | null; bio?: string | null; status_text?: string | null; last_seen_at?: string | null };
        Update: { username?: string; display_name?: string; avatar_url?: string | null; bio?: string | null; status_text?: string | null; last_seen_at?: string | null };
        Relationships: [];
      };
      rooms: {
        Row: { id: string; name: string; type: HyperoomRoomType; description: string | null; topic: string | null; is_locked: boolean; lifecycle_status: "active" | "archived" | "permanent"; last_activity_at: string; created_by: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; type?: HyperoomRoomType; description?: string | null; topic?: string | null; is_locked?: boolean; lifecycle_status?: "active" | "archived" | "permanent"; last_activity_at?: string; created_by: string };
        Update: { name?: string; type?: HyperoomRoomType; description?: string | null; topic?: string | null; is_locked?: boolean; lifecycle_status?: "active" | "archived" | "permanent"; last_activity_at?: string };
        Relationships: [];
      };
      room_members: {
        Row: { room_id: string; user_id: string; role: HyperoomMemberRole; joined_at: string };
        Insert: { room_id: string; user_id: string; role?: HyperoomMemberRole };
        Update: { role?: HyperoomMemberRole };
        Relationships: [];
      };
      messages: {
        Row: { id: string; room_id: string; sender_id: string; kind: MessageKind; event_type: HyperoomMessageEventType | null; content: string; reply_to_message_id: string | null; created_at: string; edited_at: string | null; deleted_at: string | null };
        Insert: { id?: string; room_id: string; sender_id: string; kind?: MessageKind; event_type?: HyperoomMessageEventType | null; content: string; reply_to_message_id?: string | null };
        Update: { content?: string; edited_at?: string | null; deleted_at?: string | null; event_type?: HyperoomMessageEventType | null };
        Relationships: [];
      };
      room_invitations: {
        Row: { id: string; room_id: string; inviter_id: string; invitee_id: string; status: HyperoomRoomInvitationStatus; created_at: string; responded_at: string | null };
        Insert: { id?: string; room_id: string; inviter_id: string; invitee_id: string; status?: HyperoomRoomInvitationStatus; created_at?: string; responded_at?: string | null };
        Update: { status?: HyperoomRoomInvitationStatus; responded_at?: string | null };
        Relationships: [];
      };
      room_bans: {
        Row: { id: string; room_id: string; user_id: string; banned_by: string; reason: string | null; created_at: string; revoked_at: string | null };
        Insert: { id?: string; room_id: string; user_id: string; banned_by: string; reason?: string | null; created_at?: string; revoked_at?: string | null };
        Update: { reason?: string | null; revoked_at?: string | null };
        Relationships: [];
      };
      message_reactions: {
        Row: { message_id: string; user_id: string; emoji: string; created_at: string };
        Insert: { message_id: string; user_id: string; emoji: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      join_room_by_name: { Args: { p_name: string }; Returns: { status: string; room_id: string | null; room_name: string | null; is_locked: boolean | null; description: string | null; topic: string | null; lifecycle_status: "active" | "archived" | "permanent" | null; last_activity_at: string | null; type: HyperoomRoomType | null; created_by: string | null; created_at: string | null; updated_at: string | null }[] };
      list_my_room_invitations: { Args: Record<string, never>; Returns: { id: string; room_id: string; room_name: string; inviter_id: string; inviter_username: string; status: HyperoomRoomInvitationStatus; created_at: string }[] };
      respond_room_invitation: { Args: { p_invitation_id: string; p_accept: boolean }; Returns: Database["public"]["Tables"]["room_invitations"]["Row"] };
      moderate_room_member: { Args: { p_room_id: string; p_target_username: string; p_action: string; p_reason?: string | null }; Returns: { action: string; room_id: string; room_name: string; target_id: string; target_username: string; reason: string | null }[] };
      list_room_bans: { Args: { p_room_id: string }; Returns: { id: string; room_id: string; user_id: string; username: string; banned_by: string; reason: string | null; created_at: string }[] };
      update_room_topic: { Args: { p_room_id: string; p_topic?: string | null }; Returns: Database["public"]["Tables"]["rooms"]["Row"] };
      list_messages_before: { Args: { p_room_id: string; p_before: string; p_limit?: number }; Returns: Database["public"]["Tables"]["messages"]["Row"][] };
      archive_inactive_rooms: { Args: { p_now?: string }; Returns: number };
      restore_room: { Args: { p_room_id: string }; Returns: Database["public"]["Tables"]["rooms"]["Row"] };
      transfer_room_ownership: { Args: { p_room_id: string; p_target_username: string }; Returns: Database["public"]["Tables"]["room_members"]["Row"][] };
      set_room_operator: { Args: { p_room_id: string; p_target_username: string; p_enabled: boolean }; Returns: Database["public"]["Tables"]["room_members"]["Row"][] };
    };
    Enums: { room_type: HyperoomRoomType; platform_role: HyperoomPlatformRole; member_role: HyperoomMemberRole; message_kind: MessageKind; message_event_type: HyperoomMessageEventType };
    CompositeTypes: Record<string, never>;
  };
}
