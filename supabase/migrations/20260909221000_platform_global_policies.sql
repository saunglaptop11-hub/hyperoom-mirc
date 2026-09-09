-- Global roles have authority across rooms.

drop policy if exists rooms_select_accessible on public.rooms;
create policy rooms_select_accessible
on public.rooms for select to authenticated
using (
  public.is_platform_moderator()
  or type = 'public'
  or public.is_room_member(id)
);

drop policy if exists rooms_insert_self on public.rooms;
create policy rooms_insert_self
on public.rooms for insert to authenticated
with check (
  created_by = auth.uid()
  and (type = 'public' or public.is_platform_moderator())
);

drop policy if exists rooms_delete_owner on public.rooms;
create policy rooms_delete_owner
on public.rooms for delete to authenticated
using (
  public.current_platform_role() = 'owner'
  or public.has_room_role(id, array['owner']::public.member_role[])
);

drop policy if exists room_members_select_members on public.room_members;
create policy room_members_select_members
on public.room_members for select to authenticated
using (public.is_platform_moderator() or public.is_room_member(room_id));
