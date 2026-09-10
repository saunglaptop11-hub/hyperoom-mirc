begin;

drop function if exists public.open_direct_message(text);

delete from public.messages
where room_id in (select id from public.rooms where type = 'dm');

delete from public.room_members
where room_id in (select id from public.rooms where type = 'dm');
delete from public.rooms where type = 'dm';

commit;
