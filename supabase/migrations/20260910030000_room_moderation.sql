-- Hyperoom Phase 4 — room moderation (kick / ban / unban)

create table if not exists public.room_bans (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid not null references public.profiles(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint room_bans_reason_length check (reason is null or char_length(reason) between 1 and 500)
);

create unique index if not exists room_bans_active_unique
  on public.room_bans (room_id, user_id) where revoked_at is null;
create index if not exists room_bans_room_created_idx
  on public.room_bans (room_id, created_at desc);
create index if not exists room_bans_user_idx
  on public.room_bans (user_id, created_at desc);

alter table public.room_bans enable row level security;

drop policy if exists room_bans_select_moderators on public.room_bans;
create policy room_bans_select_moderators on public.room_bans
for select to authenticated
using (public.is_platform_moderator() or public.is_room_moderator(room_id));

revoke all on table public.room_bans from anon;
grant select on table public.room_bans to authenticated;

create or replace function public.is_room_banned(
  p_room_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_bans b
    where b.room_id = p_room_id
      and b.user_id = p_user_id
      and b.revoked_at is null
  );
$$;

create or replace function public.moderate_room_member(
  p_room_id uuid,
  p_target_username text,
  p_action text,
  p_reason text default null
)
returns table (
  action text,
  room_id uuid,
  room_name text,
  target_id uuid,
  target_username text,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles;
  v_room public.rooms;
  v_action text := lower(trim(p_action));
  v_reason text := nullif(trim(p_reason), '');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'Room not found.'; end if;
  if not (public.is_platform_moderator() or public.is_room_moderator(p_room_id)) then
    raise exception 'You do not have permission to moderate this room.';
  end if;
  select * into v_target from public.profiles where lower(username) = lower(trim(p_target_username)) limit 1;
  if not found then raise exception 'User not found: %', p_target_username; end if;
  if v_target.id = v_room.created_by then raise exception 'The Room Owner cannot be moderated.'; end if;
  if v_action not in ('kick','ban','unban') then raise exception 'Unsupported moderation action.'; end if;
  if v_reason is not null and char_length(v_reason) > 500 then raise exception 'Reason cannot exceed 500 characters.'; end if;

  if v_action = 'kick' then
    delete from public.room_members where room_id = p_room_id and user_id = v_target.id;
  elsif v_action = 'ban' then
    insert into public.room_bans (room_id, user_id, banned_by, reason)
    values (p_room_id, v_target.id, auth.uid(), v_reason)
    on conflict (room_id, user_id) where revoked_at is null
    do update set banned_by = excluded.banned_by, reason = excluded.reason, created_at = now(), revoked_at = null;
    delete from public.room_members where room_id = p_room_id and user_id = v_target.id;
  else
    update public.room_bans set revoked_at = now()
    where room_id = p_room_id and user_id = v_target.id and revoked_at is null;
  end if;

  return query select v_action, v_room.id, v_room.name, v_target.id, v_target.username, v_reason;
end;
$$;

grant execute on function public.moderate_room_member(uuid, text, text, text) to authenticated;

create or replace function public.list_room_bans(p_room_id uuid)
returns table (
  id uuid,
  room_id uuid,
  user_id uuid,
  username text,
  banned_by uuid,
  reason text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.room_id, b.user_id, p.username, b.banned_by, b.reason, b.created_at
  from public.room_bans b
  join public.profiles p on p.id = b.user_id
  where b.room_id = p_room_id and b.revoked_at is null
    and (public.is_platform_moderator() or public.is_room_moderator(p_room_id))
  order by b.created_at desc;
$$;

grant execute on function public.list_room_bans(uuid) to authenticated;

-- Enforce bans on self-join and invitations at the database boundary.
drop policy if exists room_members_insert_self_public on public.room_members;
create policy room_members_insert_self_public on public.room_members
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and not public.is_room_banned(room_id, (select auth.uid()))
  and exists (select 1 from public.rooms r where r.id = room_id and r.type = 'public' and not r.is_locked)
);

drop policy if exists room_invitations_insert on public.room_invitations;
create policy room_invitations_insert on public.room_invitations
for insert to authenticated
with check (
  inviter_id = (select auth.uid())
  and (public.is_platform_moderator() or public.has_room_role(room_id, array['owner','admin','operator']::public.member_role[], (select auth.uid())))
  and invitee_id <> (select auth.uid())
  and not public.is_room_banned(room_id, invitee_id)
);

-- An accepted invitation cannot bypass an active ban.
create or replace function public.respond_room_invitation(p_invitation_id uuid, p_accept boolean)
returns public.room_invitations
language plpgsql
security definer
set search_path = public
as $$
declare v_inv public.room_invitations;
begin
  select * into v_inv from public.room_invitations where id = p_invitation_id and invitee_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'Invitation not found or already resolved.'; end if;
  if p_accept then
    if public.is_room_banned(v_inv.room_id, auth.uid()) then
      raise exception 'You are banned from this room.';
    end if;
    insert into public.room_members (room_id, user_id, role)
    values (v_inv.room_id, auth.uid(), 'member')
    on conflict (room_id, user_id) do nothing;
    update public.room_invitations set status='accepted', responded_at=now() where id=v_inv.id returning * into v_inv;
  else
    update public.room_invitations set status='declined', responded_at=now() where id=v_inv.id returning * into v_inv;
  end if;
  return v_inv;
end;
$$;

grant execute on function public.respond_room_invitation(uuid, boolean) to authenticated;

-- Bans always win over public/locked access and accepted invitations.
create or replace function public.join_room_by_name(p_name text)
returns table (status text, room_id uuid, room_name text, is_locked boolean, description text, topic text, type public.room_type, created_by uuid, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare v_room public.rooms;
begin
  select r.* into v_room from public.rooms r where lower(r.name)=lower(trim(both '#' from p_name)) and r.type='public' limit 1;
  if not found then return query select 'not_found'::text, null::uuid, null::text, null::boolean, null::text, null::text, null::public.room_type, null::uuid, null::timestamptz, null::timestamptz; return; end if;
  if public.is_room_banned(v_room.id) then
    return query select 'banned'::text, v_room.id, v_room.name, true, null::text, null::text, v_room.type, null::uuid, null::timestamptz, null::timestamptz; return;
  end if;
  if public.is_room_member(v_room.id) or public.is_platform_moderator() or not v_room.is_locked or exists (select 1 from public.room_invitations i where i.room_id=v_room.id and i.invitee_id=auth.uid() and i.status='accepted') then
    return query select 'allowed'::text, v_room.id, v_room.name, v_room.is_locked, v_room.description, v_room.topic, v_room.type, v_room.created_by, v_room.created_at, v_room.updated_at; return;
  end if;
  return query select 'locked'::text, v_room.id, v_room.name, true, null::text, null::text, v_room.type, null::uuid, null::timestamptz, null::timestamptz;
end;
$$;

grant execute on function public.join_room_by_name(text) to authenticated;
