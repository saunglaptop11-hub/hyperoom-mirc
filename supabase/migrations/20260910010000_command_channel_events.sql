-- Phase 3/4: channel topics and structured IRC-style message events.
create type public.message_event_type as enum ('join', 'part', 'quit', 'topic', 'nick', 'action');

alter table public.rooms add column if not exists topic text;

alter table public.messages add column if not exists event_type public.message_event_type;

create index if not exists messages_room_event_created_idx
  on public.messages (room_id, event_type, created_at desc);
