drop function if exists public.join_room_by_name(text);
create function public.join_room_by_name(p_name text)
returns table (status text, room_id uuid, room_name text, is_locked boolean, description text, topic text, lifecycle_status public.room_lifecycle, last_activity_at timestamptz, type public.room_type, created_by uuid, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare v_room public.rooms;
begin
  select r.* into v_room from public.rooms r where lower(r.name)=lower(trim(both '#' from p_name)) and r.type='public' limit 1;
  if not found then return query select 'not_found'::text, null::uuid, null::text, null::boolean, null::text, null::text, null::public.room_lifecycle, null::timestamptz, null::public.room_type, null::uuid, null::timestamptz, null::timestamptz; return; end if;
  if public.is_room_banned(v_room.id) then return query select 'banned'::text, v_room.id, v_room.name, true, null::text, null::text, v_room.lifecycle_status, v_room.last_activity_at, v_room.type, null::uuid, null::timestamptz, null::timestamptz; return; end if;
  if v_room.lifecycle_status = 'archived' then return query select 'archived'::text, v_room.id, v_room.name, v_room.is_locked, v_room.description, v_room.topic, v_room.lifecycle_status, v_room.last_activity_at, v_room.type, v_room.created_by, v_room.created_at, v_room.updated_at; return; end if;
  if public.is_room_member(v_room.id) or public.is_platform_moderator() or not v_room.is_locked or exists (select 1 from public.room_invitations i where i.room_id=v_room.id and i.invitee_id=auth.uid() and i.status='accepted') then return query select 'allowed'::text, v_room.id, v_room.name, v_room.is_locked, v_room.description, v_room.topic, v_room.lifecycle_status, v_room.last_activity_at, v_room.type, v_room.created_by, v_room.created_at, v_room.updated_at; return; end if;
  return query select 'locked'::text, v_room.id, v_room.name, true, null::text, null::text, v_room.lifecycle_status, v_room.last_activity_at, v_room.type, null::uuid, null::timestamptz, null::timestamptz;
end;
$$;
revoke all on function public.join_room_by_name(text) from public, anon;
grant execute on function public.join_room_by_name(text) to authenticated;
