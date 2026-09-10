-- Phase 3/4 chat-core hardening: explicit room lifecycle.
create type public.room_lifecycle as enum ('active', 'archived', 'permanent');

alter table public.rooms
  add column if not exists lifecycle_status public.room_lifecycle not null default 'active',
  add column if not exists last_activity_at timestamptz not null default now();

update public.rooms r
set lifecycle_status = 'permanent', last_activity_at = coalesce(r.updated_at, r.created_at)
where public.current_platform_role(r.created_by) = 'owner';

create index if not exists rooms_lifecycle_activity_idx
  on public.rooms (lifecycle_status, last_activity_at desc);

create or replace function public.rooms_set_lifecycle_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_platform_role(new.created_by) = 'owner' then
    new.lifecycle_status := 'permanent';
  else
    new.lifecycle_status := coalesce(new.lifecycle_status, 'active');
  end if;
  new.last_activity_at := coalesce(new.last_activity_at, now());
  return new;
end;
$$;

drop trigger if exists rooms_set_lifecycle_defaults on public.rooms;
create trigger rooms_set_lifecycle_defaults
before insert on public.rooms
for each row execute function public.rooms_set_lifecycle_defaults();

create or replace function public.rooms_touch_meaningful_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lifecycle_status is distinct from 'archived' and (
    new.name is distinct from old.name or
    new.description is distinct from old.description or
    new.topic is distinct from old.topic or
    new.is_locked is distinct from old.is_locked or
    new.type is distinct from old.type
  ) then
    new.last_activity_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists rooms_touch_meaningful_activity on public.rooms;
create trigger rooms_touch_meaningful_activity
before update on public.rooms
for each row execute function public.rooms_touch_meaningful_activity();

create or replace function public.touch_room_activity_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_type is distinct from 'join' and new.event_type is distinct from 'part' and new.event_type is distinct from 'quit' then
    update public.rooms set last_activity_at = now()
    where id = new.room_id and lifecycle_status <> 'archived';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_touch_room_activity on public.messages;
create trigger messages_touch_room_activity
after insert on public.messages
for each row execute function public.touch_room_activity_from_message();

create or replace function public.archive_inactive_rooms(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.rooms
  set lifecycle_status = 'archived'
  where lifecycle_status = 'active'
    and last_activity_at < p_now - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.archive_inactive_rooms(timestamptz) to authenticated;

create or replace function public.restore_room(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  if not (public.current_platform_role() <> 'member' or public.has_room_role(p_room_id, array['owner']::public.member_role[])) then
    raise exception 'Permission denied';
  end if;
  if v_room.lifecycle_status <> 'archived' then return v_room; end if;
  update public.rooms set lifecycle_status = (case when public.current_platform_role(v_room.created_by) = 'owner' then 'permanent'::public.room_lifecycle else 'active'::public.room_lifecycle end),
    last_activity_at = now()
  where id = p_room_id
  returning * into v_room;
  return v_room;
end;
$$;

grant execute on function public.restore_room(uuid) to authenticated;

