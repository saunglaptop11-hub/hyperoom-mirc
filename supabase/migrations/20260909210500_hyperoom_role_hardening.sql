-- Phase 1 hardening: members may only manage roles below their own authority.

create or replace function public.can_manage_member(
  p_room_id uuid,
  p_target_user_id uuid,
  p_target_role public.member_role,
  p_actor_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members actor
    where actor.room_id = p_room_id
      and actor.user_id = p_actor_id
      and case actor.role
        when 'owner' then 50
        when 'admin' then 40
        when 'operator' then 30
        when 'voice' then 20
        when 'member' then 10
      end > case p_target_role
        when 'owner' then 50
        when 'admin' then 40
        when 'operator' then 30
        when 'voice' then 20
        when 'member' then 10
      end
  );
$$;

-- Replace broad moderator policies from the base migration.
drop policy if exists room_members_insert_moderator on public.room_members;
drop policy if exists room_members_update_moderator on public.room_members;

create policy room_members_insert_moderator
on public.room_members for insert
to authenticated
with check (public.can_manage_member(room_id, user_id, role));

create policy room_members_update_moderator
on public.room_members for update
to authenticated
using (public.can_manage_member(room_id, user_id, role))
with check (public.can_manage_member(room_id, user_id, role));

drop policy if exists room_members_insert_self_public on public.room_members;

create policy room_members_insert_self_public
on public.room_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'member'
  and exists (
    select 1 from public.rooms r
    where r.id = room_id and r.type = 'public'
  )
);
