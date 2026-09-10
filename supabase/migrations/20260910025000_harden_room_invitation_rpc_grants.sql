revoke execute on function public.join_room_by_name(text) from public, anon;
revoke execute on function public.list_my_room_invitations() from public, anon;
revoke execute on function public.respond_room_invitation(uuid, boolean) from public, anon;
grant execute on function public.join_room_by_name(text) to authenticated;
grant execute on function public.list_my_room_invitations() to authenticated;
grant execute on function public.respond_room_invitation(uuid, boolean) to authenticated;