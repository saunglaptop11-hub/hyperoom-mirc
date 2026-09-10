-- DM rooms are private conversations, not community lifecycle rooms.
create or replace function public.rooms_set_lifecycle_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'dm' then
    new.lifecycle_status := 'active';
  elsif public.current_platform_role(new.created_by) = 'owner' then
    new.lifecycle_status := 'permanent';
  else
    new.lifecycle_status := coalesce(new.lifecycle_status, 'active');
  end if;
  new.last_activity_at := coalesce(new.last_activity_at, now());
  return new;
end;
$$;

update public.rooms set lifecycle_status='active'
where type='dm' and lifecycle_status <> 'active';
