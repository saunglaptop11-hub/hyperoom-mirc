create or replace function public.set_room_operator(p_room_id uuid, p_target_username text, p_enabled boolean)
returns public.room_members
language plpgsql security definer set search_path = public
as $$
declare v_target public.profiles; v_target_member public.room_members; v_actor_role public.platform_role; v_next public.member_role;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  v_actor_role := public.current_platform_role();
  if v_actor_role <> 'owner' and not public.has_room_role(p_room_id, array['owner']::public.member_role[]) then raise exception 'Only room owner or platform owner can manage room operators'; end if;
  select * into v_target from public.profiles where lower(username)=lower(trim(p_target_username)) limit 1;
  if not found then raise exception 'User not found: %', p_target_username; end if;
  select * into v_target_member from public.room_members rm where rm.room_id=p_room_id and rm.user_id=v_target.id for update;
  if not found then raise exception 'User not found in room'; end if;
  if v_target_member.role='owner' then raise exception 'The Room Owner cannot be changed to operator.'; end if;
  if p_enabled then if v_target_member.role='operator' then raise exception 'User is already an operator'; end if; v_next:='operator'; else if v_target_member.role<>'operator' then raise exception 'User is not an operator'; end if; v_next:='member'; end if;
  update public.room_members set role=v_next where room_id=p_room_id and user_id=v_target.id returning * into v_target_member;
  insert into public.messages(room_id,sender_id,kind,event_type,content) values(p_room_id,auth.uid(),'system',(case when p_enabled then 'op' else 'deop' end)::public.message_event_type,format('*** %s %s %s in #%s',(select username from public.profiles where id=auth.uid()),case when p_enabled then 'granted operator to' else 'revoked operator from' end,v_target.username,(select name from public.rooms where id=p_room_id)));
  return v_target_member;
end;
$$;
revoke all on function public.set_room_operator(uuid,text,boolean) from public,anon;
grant execute on function public.set_room_operator(uuid,text,boolean) to authenticated;
