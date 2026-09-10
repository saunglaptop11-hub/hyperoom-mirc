-- DM conversations are not archived by the community room inactivity job.
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
    and type <> 'dm'
    and last_activity_at < p_now - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
