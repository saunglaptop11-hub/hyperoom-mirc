create or replace function public.open_direct_message(p_target_username text)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target public.profiles;
  v_room public.rooms;
  v_existing uuid;
  v_lock_key bigint;
  v_member_count integer;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  select * into v_target from public.profiles
    where lower(username)=lower(trim(p_target_username)) limit 1;
  if not found then raise exception 'User not found: %', p_target_username; end if;
  if v_target.id = v_actor then raise exception 'You cannot message yourself.'; end if;
  v_lock_key := hashtextextended(
    least(v_actor::text, v_target.id::text) || ':' ||
    greatest(v_actor::text, v_target.id::text), 0
  );
  perform pg_advisory_xact_lock(v_lock_key);
  select r.id into v_existing from public.rooms r
  where r.type='dm'
    and (
      ((select count(*) from public.room_members rm where rm.room_id=r.id)=2
       and exists (select 1 from public.room_members rm where rm.room_id=r.id and rm.user_id=v_actor)
       and exists (select 1 from public.room_members rm where rm.room_id=r.id and rm.user_id=v_target.id))
      or
      ((select count(*) from public.room_members rm where rm.room_id=r.id)=1
       and exists (select 1 from public.room_members rm where rm.room_id=r.id and rm.user_id=v_target.id))
    )
  limit 1;
  if v_existing is not null then
    select * into v_room from public.rooms where id=v_existing;
    select count(*) into v_member_count from public.room_members where room_id=v_room.id;
    if v_member_count=1 then
      insert into public.room_members(room_id,user_id,role) values (v_room.id,v_actor,'member');
    end if;
    return v_room;
  end if;
  insert into public.rooms(name,type,description,created_by)
  values ('dm-' || substr(gen_random_uuid()::text,1,12), 'dm', 'Private conversation', v_actor)
  returning * into v_room;
  update public.room_members set role='member'
    where room_id=v_room.id and user_id=v_actor;
  insert into public.room_members(room_id,user_id,role)
    values (v_room.id,v_target.id,'member');
  return v_room;
end;
$$;

grant execute on function public.open_direct_message(text) to authenticated;
