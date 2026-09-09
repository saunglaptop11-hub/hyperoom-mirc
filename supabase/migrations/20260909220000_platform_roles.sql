-- Phase 1C: platform identity and authorization.
-- Platform roles are separate from per-room mIRC-style roles.

create type public.platform_role as enum ('owner', 'admin', 'moderator', 'member');

alter table public.profiles
  add column system_role public.platform_role not null default 'member';

create index profiles_system_role_idx on public.profiles (system_role);

create or replace function public.prevent_platform_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.system_role is distinct from old.system_role and auth.uid() is not null then
    raise exception 'Platform role can only be changed by the authorization system';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_platform_role_self_change
before update on public.profiles
for each row execute function public.prevent_platform_role_self_change();

create or replace function public.platform_role_level(p_role public.platform_role)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'owner' then 40
    when 'admin' then 30
    when 'moderator' then 20
    when 'member' then 10
  end;
$$;

create or replace function public.current_platform_role(p_user_id uuid default auth.uid())
returns public.platform_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select system_role from public.profiles where id = p_user_id),
    'member'::public.platform_role
  );
$$;

create or replace function public.has_platform_role(
  p_roles public.platform_role[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_platform_role(p_user_id) = any(p_roles);
$$;

create or replace function public.is_platform_moderator(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_platform_role(p_user_id) in ('owner','admin','moderator');
$$;

create or replace function public.can_manage_platform_role(
  p_target_role public.platform_role,
  p_actor_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.platform_role_level(public.current_platform_role(p_actor_id))
       > public.platform_role_level(p_target_role);
$$;

create or replace function public.set_platform_role(
  p_target_user_id uuid,
  p_target_role public.platform_role
)
returns public.platform_role
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.platform_role;
  target_role public.platform_role;
begin
  actor_role := public.current_platform_role();
  target_role := public.current_platform_role(p_target_user_id);

  if actor_role = 'member' or actor_role = 'moderator' then
    raise exception 'Insufficient platform authority';
  end if;
  if target_role = 'owner' or p_target_role = 'owner' then
    if actor_role <> 'owner' then
      raise exception 'Only the Owner can manage the Owner role';
    end if;
  end if;
  if actor_role <> 'owner' and public.platform_role_level(p_target_role) >= public.platform_role_level(actor_role) then
    raise exception 'A role may only be assigned below the actor role';
  end if;

  update public.profiles
  set system_role = p_target_role
  where id = p_target_user_id;
  if not found then raise exception 'Target user does not exist'; end if;
  return p_target_role;
end;
$$;

grant execute on function public.current_platform_role(uuid) to authenticated;
grant execute on function public.has_platform_role(public.platform_role[], uuid) to authenticated;
grant execute on function public.is_platform_moderator(uuid) to authenticated;
grant execute on function public.set_platform_role(uuid, public.platform_role) to authenticated;

-- Global platform authority works in every room without needing OP.
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
    or public.has_room_role(
      p_room_id,
      array['owner','admin','operator']::public.member_role[],
      p_user_id
    );
$$;

-- Platform Owner/Admin can manage channel roles; lower roles remain channel-scoped.
create or replace function public.can_manage_member(
  p_room_id uuid,
  p_target_user_id uuid,
  p_target_role public.member_role,
  p_actor_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case public.current_platform_role(p_actor_id)
      when 'owner' then p_target_role <> 'owner'
      when 'admin' then p_target_role in ('operator','voice','member')
      when 'moderator' then false
      else false
    end
    or exists (
      select 1 from public.room_members actor
      where actor.room_id = p_room_id
        and actor.user_id = p_actor_id
        and case actor.role
          when 'owner' then 50
          when 'admin' then 40
          when 'operator' then 30
          when 'voice' then 20
          when 'member' then 10
        end > case p_target_role
          when 'owner' then 50
          when 'admin' then 40
          when 'operator' then 30
          when 'voice' then 20
          when 'member' then 10
        end
    );
$$;

-- Public registration can never assign a platform role: the default is MEMBER.
-- Only the trusted bootstrap script or set_platform_role can create an elevated role.

create policy profiles_system_role_select
on public.profiles for select
to authenticated
using (true);

-- Replace self-profile update policy so profile editing remains self-only; the trigger
-- above blocks any authenticated attempt to alter system_role.
