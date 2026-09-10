-- Phase 4 platform-owner room controls: rename any room and delete any room at any time.

create or replace function public.delete_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.rooms;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if public.current_platform_role() <> 'owner' then raise exception 'Only Platform Owner can delete rooms.'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  delete from public.rooms where id = p_room_id;
end;
$$;

revoke all on function public.delete_room(uuid) from public, anon;
grant execute on function public.delete_room(uuid) to authenticated;

-- Platform Owner explicitly retains room-settings authority across every lifecycle state.
drop policy if exists rooms_update_moderator on public.rooms;
create policy rooms_update_moderator on public.rooms
for update to authenticated
using (
  (select public.current_platform_role()) in ('owner','admin','moderator')
  or (select public.has_room_role(id, array['owner']::public.member_role[]))
)
with check (
  (select public.current_platform_role()) in ('owner','admin','moderator')
  or (select public.has_room_role(id, array['owner']::public.member_role[]))
);
