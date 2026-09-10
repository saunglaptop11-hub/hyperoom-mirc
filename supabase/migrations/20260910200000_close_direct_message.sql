create or replace function public.close_direct_message(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_type public.room_type;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  select type into v_type from public.rooms where id = p_room_id;
  if v_type is null then raise exception 'Private conversation not found.'; end if;
  if v_type <> 'dm' then raise exception 'Only private conversations can be closed.'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_actor) then raise exception 'You are not a member of this private conversation.'; end if;
  delete from public.room_members where room_id = p_room_id and user_id = v_actor;
end;
$$;

grant execute on function public.close_direct_message(uuid) to authenticated;
