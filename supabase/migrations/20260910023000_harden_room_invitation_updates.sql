-- Invitation responses are performed by the authenticated RPC only.
-- Do not allow clients to mutate invitation status/ownership directly.
drop policy if exists room_invitations_update on public.room_invitations;