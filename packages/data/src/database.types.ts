import type { HyperoomMemberRole, HyperoomMessageEventType, HyperoomPlatformRole, HyperoomRoomType, MessageKind } from "@hyperoom/shared";

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
        Row: { id: string; name: string; type: HyperoomRoomType; description: string | null; topic: string | null; created_by: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; type?: HyperoomRoomType; description?: string | null; topic?: string | null; created_by: string };
        Update: { name?: string; type?: HyperoomRoomType; description?: string | null; topic?: string | null };
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
      message_reactions: {
        Row: { message_id: string; user_id: string; emoji: string; created_at: string };
        Insert: { message_id: string; user_id: string; emoji: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { room_type: HyperoomRoomType; platform_role: HyperoomPlatformRole; member_role: HyperoomMemberRole; message_kind: MessageKind; message_event_type: HyperoomMessageEventType };
    CompositeTypes: Record<string, never>;
  };
}
