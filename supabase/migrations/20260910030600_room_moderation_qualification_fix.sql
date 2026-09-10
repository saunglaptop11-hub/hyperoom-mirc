-- Recreate moderation with qualified row references because RETURNS TABLE names are variables.
create or replace function public.moderate_room_member(p_room_id uuid,p_target_username text,p_action text,p_reason text default null)
returns table(action text,room_id uuid,room_name text,target_id uuid,target_username text,reason text)
language plpgsql security definer set search_path=public
as $$
declare v_target public.profiles; v_room public.rooms; v_target_member public.room_members; v_action text:=lower(trim(p_action)); v_reason text:=nullif(trim(p_reason),''); v_platform_role public.platform_role;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if v_action not in ('kick','ban','unban') then raise exception 'Unsupported moderation action.'; end if;
  select * into v_room from public.rooms r where r.id=p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  select * into v_target from public.profiles p where lower(p.username)=lower(trim(p_target_username)) limit 1;
  if not found then raise exception 'User not found: %',p_target_username; end if;
  if v_target.id=auth.uid() then raise exception 'You cannot moderate yourself.'; end if;
  v_platform_role:=public.current_platform_role();
  if not public.room_target_action_allowed(p_room_id,v_target.id,v_action,auth.uid()) then
    if public.current_platform_role(v_target.id)<>'member' and v_platform_role='member' then raise exception 'Cannot moderate a higher-ranked user'; end if;
    if exists(select 1 from public.room_members rm where rm.room_id=p_room_id and rm.user_id=v_target.id and rm.role='owner') then raise exception 'Cannot moderate the room owner'; end if;
    raise exception 'Permission denied';
  end if;
  if v_reason is not null and char_length(v_reason)>500 then raise exception 'Reason cannot exceed 500 characters.'; end if;
  select * into v_target_member from public.room_members rm where rm.room_id=p_room_id and rm.user_id=v_target.id for update;
  if v_action='kick' and not found then raise exception 'User not found in room'; end if;
  if v_action='unban' and not exists(select 1 from public.room_bans b where b.room_id=p_room_id and b.user_id=v_target.id and b.revoked_at is null) then raise exception 'User is not banned'; end if;
  if v_action='ban' and exists(select 1 from public.room_bans b where b.room_id=p_room_id and b.user_id=v_target.id and b.revoked_at is null) then raise exception 'User is already banned'; end if;
  insert into public.messages(room_id,sender_id,kind,event_type,content) values(p_room_id,auth.uid(),'system',v_action::public.message_event_type,format('*** %s %s %s from #%s%s',(select p.username from public.profiles p where p.id=auth.uid()),v_action,v_target.username,v_room.name,case when v_reason is null then '' else ' ('||v_reason||')' end));
  if v_action='kick' then delete from public.room_members rm where rm.room_id=p_room_id and rm.user_id=v_target.id;
  elsif v_action='ban' then insert into public.room_bans(room_id,user_id,banned_by,reason) values(p_room_id,v_target.id,auth.uid(),v_reason); delete from public.room_members rm where rm.room_id=p_room_id and rm.user_id=v_target.id;
  else update public.room_bans b set revoked_at=now() where b.room_id=p_room_id and b.user_id=v_target.id and b.revoked_at is null; end if;
  return query select v_action,v_room.id,v_room.name,v_target.id,v_target.username,v_reason;
end;
$$;
