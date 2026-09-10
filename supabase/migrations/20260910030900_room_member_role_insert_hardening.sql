drop policy if exists room_members_insert_self_public on public.room_members;
create policy room_members_insert_self_public on public.room_members
for insert to authenticated
with check (
  user_id=(select auth.uid())
  and role='member'
  and not public.is_room_banned(room_id,(select auth.uid()))
  and exists(select 1 from public.rooms r where r.id=room_id and r.type='public' and not r.is_locked)
);
