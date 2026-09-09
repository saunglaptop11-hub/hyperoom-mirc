-- Realtime delete events need the deleted row's fields for typed client events.
alter table public.room_members replica identity full;
alter table public.messages replica identity full;
alter table public.message_reactions replica identity full;
