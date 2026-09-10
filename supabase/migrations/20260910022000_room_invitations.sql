create type public.room_invitation_status as enum ('pending','accepted','declined','revoked');

create table if not exists public.room_invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status public.room_invitation_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint room_invitations_not_self check (inviter_id <> invitee_id)
);
create index if not exists room_invitations_invitee_status_idx on public.room_invitations (invitee_id, status, created_at desc);
create index if not exists room_invitations_room_idx on public.room_invitations (room_id, created_at desc);
create unique index if not exists room_invitations_pending_unique on public.room_invitations (room_id, invitee_id) where status = 'pending';

alter table public.room_invitations enable row level security;

drop policy if exists room_invitations_select on public.room_invitations;
create policy room_invitations_select on public.room_invitations for select to authenticated using (
  invitee_id = (select auth.uid()) or inviter_id = (select auth.uid()) or public.is_platform_moderator() or public.is_room_moderator(room_id)
);

drop policy if exists room_invitations_insert on public.room_invitations;
create policy room_invitations_insert on public.room_invitations for insert to authenticated with check (
  inviter_id = (select auth.uid())
  and (public.is_platform_moderator() or public.has_room_role(room_id, array['owner','admin','operator']::public.member_role[], (select auth.uid())))
  and invitee_id <> (select auth.uid())
);
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

drop function if exists public.list_my_room_invitations();
create function public.list_my_room_invitations()
returns table (id uuid, room_id uuid, room_name text, inviter_id uuid, inviter_username text, status public.room_invitation_status, created_at timestamptz)
language sql security definer set search_path = public
as $$
  select i.id, i.room_id, r.name, i.inviter_id, p.username, i.status, i.created_at
  from public.room_invitations i join public.rooms r on r.id=i.room_id join public.profiles p on p.id=i.inviter_id
  where i.invitee_id=auth.uid() and i.status='pending' order by i.created_at desc;
$$;
grant execute on function public.list_my_room_invitations() to authenticated;
drop function if exists public.join_room_by_name(text);
create function public.join_room_by_name(p_name text)
returns table (status text, room_id uuid, room_name text, is_locked boolean, description text, topic text, type public.room_type, created_by uuid, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare v_room public.rooms;
begin
  select * into v_room from public.rooms where lower(name)=lower(trim(both '#' from p_name)) and type='public' limit 1;
  if not found then return query select 'not_found'::text, null::uuid, null::text, null::boolean, null::text, null::text, null::public.room_type, null::uuid, null::timestamptz, null::timestamptz; return; end if;
  if public.is_room_member(v_room.id) or public.is_platform_moderator() or not v_room.is_locked or exists (select 1 from public.room_invitations i where i.room_id=v_room.id and i.invitee_id=auth.uid() and i.status='accepted') then
    return query select 'allowed'::text, v_room.id, v_room.name, v_room.is_locked, v_room.description, v_room.topic, v_room.type, v_room.created_by, v_room.created_at, v_room.updated_at; return;
  end if;
  return query select 'locked'::text, v_room.id, v_room.name, true, null::text, null::text, 'public'::public.room_type, null::uuid, null::timestamptz, null::timestamptz;
end;
$$;
grant execute on function public.join_room_by_name(text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.room_invitations;
exception when duplicate_object then null;
end $$;