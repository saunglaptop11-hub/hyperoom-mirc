-- Moderators can remove members from rooms; members can still leave themselves.

drop policy if exists room_members_delete_self on public.room_members;
create policy room_members_delete_self
on public.room_members for delete to authenticated
using (
  (user_id = auth.uid() and role <> 'owner')
  or public.is_platform_moderator()
  or public.has_room_role(
    room_id,
    array['owner','admin','operator']::public.member_role[]
  )
);

-- Global roles can update rooms without first joining them.
drop policy if exists rooms_update_moderator on public.rooms;
create policy rooms_update_moderator
on public.rooms for update to authenticated
using (public.is_room_moderator(id))
with check (public.is_room_moderator(id));
