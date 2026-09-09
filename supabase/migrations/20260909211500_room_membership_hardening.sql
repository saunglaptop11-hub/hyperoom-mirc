-- Prevent an owner from leaving a room without a transfer workflow.
drop policy if exists room_members_delete_self on public.room_members;

create policy room_members_delete_self
on public.room_members for delete
to authenticated
using (user_id = auth.uid() and role <> 'owner');
