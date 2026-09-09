-- Harden platform role mutation and global authority policies.

create or replace function public.prevent_platform_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.system_role is distinct from old.system_role
     and auth.uid() is not null
     and coalesce(current_setting('request.hyperoom_role_change', true), '') <> 'true' then
    raise exception 'Platform role can only be changed by the authorization system';
  end if;
  return new;
end;
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
  if actor_role not in ('owner','admin') then
    raise exception 'Insufficient platform authority';
  end if;
  if actor_role <> 'owner' and public.platform_role_level(p_target_role) >= public.platform_role_level(actor_role) then
    raise exception 'A role may only be assigned below the actor role';
  end if;
  if p_target_role = 'owner' then
    raise exception 'Owner is assigned only by secure system bootstrap';
  end if;
  if target_role = 'owner' then
    raise exception 'The Owner role cannot be changed from this workflow';
  end if;
  perform set_config('request.hyperoom_role_change', 'true', true);
  update public.profiles set system_role = p_target_role where id = p_target_user_id;
  if not found then raise exception 'Target user does not exist'; end if;
  return p_target_role;
end;
$$;
