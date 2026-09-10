-- Phase 4 patch: separate platform authority from room authority.
-- Direct room-member role writes are intentionally removed; authority changes use RPCs.

create unique index if not exists room_members_single_owner_idx
  on public.room_members (room_id) where role = 'owner';

create or replace function public.room_role_level(p_role public.member_role)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'owner' then 40
    when 'operator' then 30
    when 'voice' then 20
    when 'member' then 10
    else 0
  end;
$$;

create or replace function public.is_room_moderator(
  p_room_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_moderator(p_user_id)
    or public.has_room_role(p_room_id, array['owner','operator']::public.member_role[], p_user_id);
$$;

create or replace function public.room_target_action_allowed(
  p_room_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_actor_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_actor_id is null or p_actor_id = p_target_user_id then false
    when public.current_platform_role(p_actor_id) = 'owner' then public.current_platform_role(p_target_user_id) <> 'owner'
    when public.current_platform_role(p_actor_id) = 'admin' then public.current_platform_role(p_target_user_id) in ('moderator','member')
    when public.current_platform_role(p_actor_id) = 'moderator' then public.current_platform_role(p_target_user_id) = 'member'
    else case when p_action = 'kick' then exists (
      select 1 from public.room_members actor
      join public.room_members target on target.room_id = actor.room_id
      where actor.room_id = p_room_id and actor.user_id = p_actor_id and target.user_id = p_target_user_id
        and actor.role in ('owner','operator') and target.role <> 'owner'
        and public.current_platform_role(p_target_user_id) = 'member'
        and public.room_role_level(actor.role) > public.room_role_level(target.role)
    ) else exists (
      select 1 from public.room_members actor
      where actor.room_id = p_room_id and actor.user_id = p_actor_id and actor.role in ('owner','operator')
    ) and public.current_platform_role(p_target_user_id) = 'member'
      and not exists (select 1 from public.room_members target where target.room_id = p_room_id and target.user_id = p_target_user_id and target.role = 'owner') end
  end;
$$;

-- Operators no longer receive direct role-write or membership-delete privileges.
drop policy if exists room_members_insert_moderator on public.room_members;
drop policy if exists room_members_update_moderator on public.room_members;
drop policy if exists room_members_delete_self on public.room_members;
create policy room_members_delete_self on public.room_members
for delete to authenticated
using (user_id = (select auth.uid()) and role <> 'owner');

-- Room settings remain owner/platform controlled. Topic has a dedicated RPC so operators
-- can change topic without gaining access to other room settings.
drop policy if exists rooms_update_moderator on public.rooms;
create policy rooms_update_moderator on public.rooms
for update to authenticated
using (
  (select public.is_platform_moderator())
  or (select public.has_room_role(id, array['owner']::public.member_role[]))
)
with check (
  (select public.is_platform_moderator())
  or (select public.has_room_role(id, array['owner']::public.member_role[]))
);

-- Invitation authority follows the new room hierarchy.
drop policy if exists room_invitations_insert on public.room_invitations;
create policy room_invitations_insert on public.room_invitations
for insert to authenticated
with check (
  inviter_id = (select auth.uid())
  and (
    (select public.is_platform_moderator())
    or (select public.has_room_role(room_id, array['owner','operator']::public.member_role[]))
  )
  and invitee_id <> (select auth.uid())
  and not public.is_room_banned(room_id, invitee_id)
  and not public.is_room_member(room_id, invitee_id)
);

revoke all on function public.room_target_action_allowed(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.room_target_action_allowed(uuid, uuid, text, uuid) to authenticated;

-- Atomic topic mutation for owner/operator/platform authority.
create or replace function public.update_room_topic(p_room_id uuid, p_topic text default null)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.rooms;
v_topic text := nullif(trim(p_topic), '');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if char_length(coalesce(v_topic, '')) > 200 then raise exception 'Topic cannot exceed 200 characters.'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  if not (public.is_platform_moderator() or public.has_room_role(p_room_id, array['owner','operator']::public.member_role[])) then
    raise exception 'Permission denied';
  end if;
  update public.rooms set topic = v_topic where id = p_room_id returning * into v_room;
  return v_room;
end;
$$;

revoke all on function public.update_room_topic(uuid, text) from public, anon;
grant execute on function public.update_room_topic(uuid, text) to authenticated;

-- Atomic room ownership transfer. The partial unique index above guarantees one owner.
create or replace function public.transfer_room_ownership(p_room_id uuid, p_target_username text)
returns public.room_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_target public.profiles;
  v_current public.room_members;
  v_result public.room_members;
  v_actor_role public.platform_role;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  v_actor_role := public.current_platform_role();
  if v_actor_role <> 'owner' and not public.has_room_role(p_room_id, array['owner']::public.member_role[]) then
    raise exception 'Only room owner or platform owner can transfer ownership';
  end if;
  select * into v_target from public.profiles where lower(username) = lower(trim(p_target_username)) limit 1;
  if not found then raise exception 'User not found: %', p_target_username; end if;
  if not public.is_room_member(p_room_id, v_target.id) then raise exception 'Target user is not a member of this room.'; end if;
  if public.is_room_banned(p_room_id, v_target.id) then raise exception 'Cannot transfer ownership to a banned user.'; end if;
  if v_target.id = auth.uid() then raise exception 'You are already the Room Owner.'; end if;

  select * into v_current from public.room_members where room_id = p_room_id and role = 'owner' for update;
  if not found then raise exception 'Room owner is missing.'; end if;

  update public.room_members set role = 'member' where room_id = p_room_id and user_id = v_current.user_id;
  update public.room_members set role = 'owner' where room_id = p_room_id and user_id = v_target.id returning * into v_result;
  insert into public.messages (room_id, sender_id, kind, event_type, content)
  values (p_room_id, auth.uid(), 'system', 'owner', format('*** %s transferred Room Ownership of #%s to %s', (select username from public.profiles where id = auth.uid()), v_room.name, v_target.username));

  return v_result;
end;
$$;

revoke all on function public.transfer_room_ownership(uuid, text) from public, anon;
grant execute on function public.transfer_room_ownership(uuid, text) to authenticated;

-- Grant/revoke room operator. Only the Room Owner or Platform Owner may change it.
create or replace function public.set_room_operator(p_room_id uuid, p_target_username text, p_enabled boolean)
returns public.room_members
language plpgsql
security definer
set search_path = public
as $$
declare v_target public.profiles; v_target_member public.room_members; v_actor_role public.platform_role;
v_next public.member_role;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  v_actor_role := public.current_platform_role();
  if v_actor_role <> 'owner' and not public.has_room_role(p_room_id, array['owner']::public.member_role[]) then
    raise exception 'Only room owner or platform owner can manage room operators';
  end if;
  select * into v_target from public.profiles where lower(username) = lower(trim(p_target_username)) limit 1;
  if not found then raise exception 'User not found: %', p_target_username; end if;
  select * into v_target_member from public.room_members where room_id = p_room_id and user_id = v_target.id for update;
  if not found then raise exception 'User not found in room'; end if;
  if v_target_member.role = 'owner' then raise exception 'The Room Owner cannot be changed to operator.'; end if;
  if p_enabled then
    if v_target_member.role = 'operator' then raise exception 'User is already an operator'; end if;
    v_next := 'operator';
  else
    if v_target_member.role <> 'operator' then raise exception 'User is not an operator'; end if;
    v_next := 'member';
  end if;
  update public.room_members set role = v_next where room_id = p_room_id and user_id = v_target.id returning * into v_target_member;
  insert into public.messages (room_id, sender_id, kind, event_type, content)
  values (p_room_id, auth.uid(), 'system', (case when p_enabled then 'op' else 'deop' end)::public.message_event_type,
    format('*** %s %s %s in #%s', (select username from public.profiles where id = auth.uid()), case when p_enabled then 'granted operator to' else 'revoked operator from' end, v_target.username, (select name from public.rooms where id = p_room_id)));
  return v_target_member;
end;
$$;

revoke all on function public.set_room_operator(uuid, text, boolean) from public, anon;
grant execute on function public.set_room_operator(uuid, text, boolean) to authenticated;

-- Moderation is atomic and hierarchy-aware. Room role is never trusted from the client.
create or replace function public.moderate_room_member(
  p_room_id uuid, p_target_username text, p_action text, p_reason text default null
)
returns table (action text, room_id uuid, room_name text, target_id uuid, target_username text, reason text)
language plpgsql security definer set search_path = public
as $$
declare
  v_target public.profiles;
  v_room public.rooms;
  v_target_member public.room_members;
  v_action text := lower(trim(p_action));
  v_reason text := nullif(trim(p_reason), '');
  v_platform_role public.platform_role;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if v_action not in ('kick','ban','unban') then raise exception 'Unsupported moderation action.'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  select * into v_target from public.profiles where lower(username) = lower(trim(p_target_username)) limit 1;
  if not found then raise exception 'User not found: %', p_target_username; end if;
  if v_target.id = auth.uid() then raise exception 'You cannot moderate yourself.'; end if;
  v_platform_role := public.current_platform_role();

  if not public.room_target_action_allowed(p_room_id, v_target.id, v_action, auth.uid()) then
    if (select public.current_platform_role(v_target.id)) <> 'member' and v_platform_role = 'member' then
      raise exception 'Cannot moderate a higher-ranked user';
    end if;
    if exists (select 1 from public.room_members rm where rm.room_id = p_room_id and rm.user_id = v_target.id and rm.role = 'owner') then
      raise exception 'Cannot moderate the room owner';
    end if;
    raise exception 'Permission denied';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then raise exception 'Reason cannot exceed 500 characters.'; end if;

  select * into v_target_member from public.room_members rm where rm.room_id = p_room_id and rm.user_id = v_target.id for update;
  if v_action = 'kick' and not found then raise exception 'User not found in room'; end if;
  if v_action = 'unban' and not exists (select 1 from public.room_bans b where b.room_id=p_room_id and b.user_id=v_target.id and b.revoked_at is null) then raise exception 'User is not banned'; end if;
  if v_action = 'ban' and exists (select 1 from public.room_bans b where b.room_id=p_room_id and b.user_id=v_target.id and b.revoked_at is null) then raise exception 'User is already banned'; end if;

  insert into public.messages (room_id, sender_id, kind, event_type, content)
  values (
    p_room_id, auth.uid(), 'system', v_action::public.message_event_type,
    case v_action
      when 'kick' then format('*** %s kicked %s from #%s%s', (select username from public.profiles where id=auth.uid()), v_target.username, v_room.name, case when v_reason is null then '' else ' ('||v_reason||')' end)
      when 'ban' then format('*** %s banned %s from #%s%s', (select username from public.profiles where id=auth.uid()), v_target.username, v_room.name, case when v_reason is null then '' else ' ('||v_reason||')' end)
      else format('*** %s unbanned %s from #%s', (select username from public.profiles where id=auth.uid()), v_target.username, v_room.name)
    end
  );

  if v_action = 'kick' then
    delete from public.room_members rm where rm.room_id=p_room_id and rm.user_id=v_target.id;
  elsif v_action = 'ban' then
    insert into public.room_bans (room_id,user_id,banned_by,reason) values (p_room_id,v_target.id,auth.uid(),v_reason)
    on conflict (room_id,user_id) where revoked_at is null
    do update set banned_by=excluded.banned_by, reason=excluded.reason, created_at=now(), revoked_at=null;
    delete from public.room_members rm where rm.room_id=p_room_id and rm.user_id=v_target.id;
  else
    update public.room_bans b set revoked_at=now() where b.room_id=p_room_id and b.user_id=v_target.id and b.revoked_at is null;
  end if;

  return query select v_action, v_room.id, v_room.name, v_target.id, v_target.username, v_reason;
end;
$$;

revoke all on function public.moderate_room_member(uuid,text,text,text) from public, anon;
grant execute on function public.moderate_room_member(uuid,text,text,text) to authenticated;

alter type public.message_event_type add value if not exists 'op';
alter type public.message_event_type add value if not exists 'deop';
alter type public.message_event_type add value if not exists 'owner';
