-- Phase 3/4 addition: room lock, room settings hardening, and real online presence.

alter table public.rooms add column if not exists is_locked boolean not null default false;
alter table public.rooms drop constraint if exists rooms_name_length;
alter table public.rooms add constraint rooms_name_length check (char_length(name) between 1 and 32);
alter table public.rooms drop constraint if exists rooms_description_length;
alter table public.rooms add constraint rooms_description_length check (description is null or char_length(description) <= 500);
alter table public.rooms drop constraint if exists rooms_topic_length;
alter table public.rooms add constraint rooms_topic_length check (topic is null or char_length(topic) <= 200);
create index if not exists rooms_locked_idx on public.rooms (is_locked, updated_at desc);

drop policy if exists rooms_select_accessible on public.rooms;
create policy rooms_select_accessible on public.rooms for select to authenticated using ((select public.is_platform_moderator()) or (select public.is_room_member(id)) or (type = 'public' and not is_locked));
drop policy if exists rooms_insert_self on public.rooms;
create policy rooms_insert_self on public.rooms for insert to authenticated with check (created_by = (select auth.uid()) and type = 'public');
drop policy if exists room_members_insert_self_public on public.room_members;
create policy room_members_insert_self_public on public.room_members for insert to authenticated with check ((user_id = (select auth.uid())) and exists (select 1 from public.rooms r where r.id = room_id and r.type = 'public' and not r.is_locked));

drop policy if exists hyperoom_global_presence_select on realtime.messages;
drop policy if exists hyperoom_global_presence_insert on realtime.messages;
create policy hyperoom_global_presence_select on realtime.messages for select to authenticated using (realtime.topic() = 'hyperoom:presence' and realtime.messages.extension = 'presence');
create policy hyperoom_global_presence_insert on realtime.messages for insert to authenticated with check (realtime.topic() = 'hyperoom:presence' and realtime.messages.extension = 'presence');

drop policy if exists hyperoom_room_presence_select on realtime.messages;
create policy hyperoom_room_presence_select on realtime.messages for select to authenticated using (realtime.topic() like 'hyperoom:room:%:presence' and realtime.messages.extension = 'presence' and exists (select 1 from public.rooms r where ('hyperoom:room:' || r.id::text || ':presence') = realtime.topic() and ((r.type = 'public' and not r.is_locked) or public.is_platform_moderator() or public.is_room_member(r.id))));
drop policy if exists hyperoom_room_presence_insert on realtime.messages;
create policy hyperoom_room_presence_insert on realtime.messages for insert to authenticated with check (realtime.topic() like 'hyperoom:room:%:presence' and realtime.messages.extension = 'presence' and exists (select 1 from public.rooms r where ('hyperoom:room:' || r.id::text || ':presence') = realtime.topic() and ((r.type = 'public' and not r.is_locked) or public.is_platform_moderator() or public.is_room_member(r.id))));

alter type public.message_event_type add value if not exists 'create';
alter type public.message_event_type add value if not exists 'lock';
alter type public.message_event_type add value if not exists 'unlock';

drop policy if exists room_members_select on public.room_members;
drop policy if exists room_members_select_members on public.room_members;
create policy room_members_select_accessible on public.room_members for select to authenticated using (public.is_platform_moderator() or public.is_room_member(room_id) or exists (select 1 from public.rooms r where r.id = room_id and r.type = 'public' and not r.is_locked));
