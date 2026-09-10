-- Authoritative moderation RPC. The UI never decides who may kick/ban.
create or replace function public.moderate_room_member(
  p_room_id uuid, p_target_username text, p_action text, p_reason text default null
)
returns table (action text, room_id uuid, room_name text, target_id uuid, target_username text, reason text)
language plpgsql security definer set search_path = public
as $$
declare v_target public.profiles; v_room public.rooms; v_action text := lower(trim(p_action)); v_reason text := nullif(trim(p_reason), '');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'Room not found.'; end if;
  if not (public.is_platform_moderator() or public.is_room_moderator(p_room_id)) then raise exception 'You do not have permission to moderate this room.'; end if;
  select * into v_target from public.profiles where lower(username)=lower(trim(p_target_username)) limit 1;
  if not found then raise exception 'User not found: %', p_target_username; end if;
  if v_target.id = v_room.created_by then raise exception 'The Room Owner cannot be moderated.'; end if;
  if v_action not in ('kick','ban','unban') then raise exception 'Unsupported moderation action.'; end if;
  if v_reason is not null and char_length(v_reason) > 500 then raise exception 'Reason cannot exceed 500 characters.'; end if;
  if v_action = 'kick' and not public.is_room_member(p_room_id, v_target.id) then raise exception 'User is not a member of this room.'; end if;
  if v_action = 'unban' and not exists (select 1 from public.room_bans b where b.room_id=p_room_id and b.user_id=v_target.id and b.revoked_at is null) then raise exception 'User is not banned from this room.'; end if;

  insert into public.messages (room_id, sender_id, kind, event_type, content)
  values (p_room_id, auth.uid(), 'system', v_action::public.message_event_type,
    case v_action
      when 'kick' then format('*** %s kicked %s from #%s%s', (select username from public.profiles where id=auth.uid()), v_target.username, v_room.name, case when v_reason is null then '' else ' ('||v_reason||')' end)
      when 'ban' then format('*** %s banned %s from #%s%s', (select username from public.profiles where id=auth.uid()), v_target.username, v_room.name, case when v_reason is null then '' else ' ('||v_reason||')' end)
      else format('*** %s unbanned %s from #%s', (select username from public.profiles where id=auth.uid()), v_target.username, v_room.name)
    end);

  if v_action = 'kick' then
    delete from public.room_members where room_id=p_room_id and user_id=v_target.id;
  elsif v_action = 'ban' then
    insert into public.room_bans (room_id,user_id,banned_by,reason) values (p_room_id,v_target.id,auth.uid(),v_reason)
    on conflict (room_id,user_id) where revoked_at is null
    do update set banned_by=excluded.banned_by, reason=excluded.reason, created_at=now(), revoked_at=null;
    delete from public.room_members where room_id=p_room_id and user_id=v_target.id;
  else
    update public.room_bans set revoked_at=now() where room_id=p_room_id and user_id=v_target.id and revoked_at is null;
  end if;
  return query select v_action,v_room.id,v_room.name,v_target.id,v_target.username,v_reason;
end;
$$;

grant execute on function public.moderate_room_member(uuid,text,text,text) to authenticated;
