create or replace function public.room_target_action_allowed(p_room_id uuid,p_target_user_id uuid,p_action text,p_actor_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public
as $$
select case
  when p_actor_id is null or p_actor_id=p_target_user_id then false
  when public.current_platform_role(p_actor_id)='owner' then public.current_platform_role(p_target_user_id)<>'owner'
  when public.current_platform_role(p_actor_id)='admin' then public.current_platform_role(p_target_user_id) in ('moderator','member')
  when public.current_platform_role(p_actor_id)='moderator' then public.current_platform_role(p_target_user_id)='member'
  else case when p_action='kick' then exists(
    select 1 from public.room_members actor join public.room_members target on target.room_id=actor.room_id
    where actor.room_id=p_room_id and actor.user_id=p_actor_id and target.user_id=p_target_user_id
      and actor.role in ('owner','operator') and target.role<>'owner'
      and public.current_platform_role(p_target_user_id)='member'
      and public.room_role_level(actor.role)>public.room_role_level(target.role)
  ) else exists(
    select 1 from public.room_members actor where actor.room_id=p_room_id and actor.user_id=p_actor_id and actor.role in ('owner','operator')
  ) and public.current_platform_role(p_target_user_id)='member'
    and not exists(select 1 from public.room_members target where target.room_id=p_room_id and target.user_id=p_target_user_id and target.role='owner') end
end;
$$;
revoke all on function public.room_target_action_allowed(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.room_target_action_allowed(uuid,uuid,text,uuid) to authenticated;
