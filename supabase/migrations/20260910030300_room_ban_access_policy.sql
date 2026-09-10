-- A ban removes room visibility/access for the banned user.
drop policy if exists rooms_select_accessible on public.rooms;
create policy rooms_select_accessible on public.rooms
for select to authenticated
using (
  (select public.is_platform_moderator())
  or (select public.is_room_member(id))
  or (type = 'public' and not is_locked and not public.is_room_banned(id, (select auth.uid())))
);

-- Presence follows the same ban boundary as room access.
drop policy if exists hyperoom_room_presence_select on realtime.messages;
create policy hyperoom_room_presence_select on realtime.messages
for select to authenticated
using (
  realtime.topic() like 'hyperoom:room:%:presence'
  and realtime.messages.extension = 'presence'
  and exists (
    select 1 from public.rooms r
    where ('hyperoom:room:' || r.id::text || ':presence') = realtime.topic()
      and not public.is_room_banned(r.id, (select auth.uid()))
      and ((r.type = 'public' and not r.is_locked) or public.is_platform_moderator() or public.is_room_member(r.id))
  )
);

drop policy if exists hyperoom_room_presence_insert on realtime.messages;
create policy hyperoom_room_presence_insert on realtime.messages
for insert to authenticated
with check (
  realtime.topic() like 'hyperoom:room:%:presence'
  and realtime.messages.extension = 'presence'
  and exists (
    select 1 from public.rooms r
    where ('hyperoom:room:' || r.id::text || ':presence') = realtime.topic()
      and not public.is_room_banned(r.id, (select auth.uid()))
      and ((r.type = 'public' and not r.is_locked) or public.is_platform_moderator() or public.is_room_member(r.id))
  )
);
