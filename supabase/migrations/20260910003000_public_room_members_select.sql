-- Allow authenticated users to inspect memberships in public rooms.
-- This is required for public-room join/upsert responses and member lists.
drop policy if exists room_members_select_members on public.room_members;

create policy room_members_select_members
on public.room_members for select
to authenticated
using (
  public.is_room_member(room_id)
  or exists (
    select 1
    from public.rooms r
    where r.id = room_id
      and r.type = 'public'
  )
);
