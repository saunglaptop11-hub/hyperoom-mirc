create or replace function public.transfer_room_ownership(p_room_id uuid,p_target_username text)
returns public.room_members language plpgsql security definer set search_path=public
as $$
declare v_room public.rooms; v_target public.profiles; v_current public.room_members; v_result public.room_members; v_actor_role public.platform_role;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_room from public.rooms where id=p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  v_actor_role:=public.current_platform_role();
  if v_actor_role<>'owner' and not public.has_room_role(p_room_id,array['owner']::public.member_role[]) then raise exception 'Only room owner or platform owner can transfer ownership'; end if;
  select * into v_target from public.profiles where lower(username)=lower(trim(p_target_username)) limit 1;
  if not found then raise exception 'User not found: %',p_target_username; end if;
  if not public.is_room_member(p_room_id,v_target.id) then raise exception 'Target user is not a member of this room.'; end if;
  if public.is_room_banned(p_room_id,v_target.id) then raise exception 'Cannot transfer ownership to a banned user.'; end if;
  if v_target.id=auth.uid() and v_actor_role<>'owner' then raise exception 'You are already the Room Owner.'; end if;
  select * into v_current from public.room_members where room_id=p_room_id and role='owner' for update;
  if not found then raise exception 'Room owner is missing.'; end if;
  if v_current.user_id=v_target.id then return v_current; end if;
  update public.room_members set role='member' where room_id=p_room_id and user_id=v_current.user_id;
  update public.room_members set role='owner' where room_id=p_room_id and user_id=v_target.id returning * into v_result;
  insert into public.messages(room_id,sender_id,kind,event_type,content) values(p_room_id,auth.uid(),'system','owner',format('*** %s transferred Room Ownership of #%s to %s',(select username from public.profiles where id=auth.uid()),v_room.name,v_target.username));
  return v_result;
end;
$$;
revoke all on function public.transfer_room_ownership(uuid,text) from public,anon;
grant execute on function public.transfer_room_ownership(uuid,text) to authenticated;
