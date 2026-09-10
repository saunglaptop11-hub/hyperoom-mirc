-- Phase 3–4 UX: account-scoped last accessible room.
-- Profile existence remains the first-time signal; new profiles begin with NULL.

alter table public.profiles
  add column if not exists last_room_id uuid references public.rooms(id) on delete set null;

create index if not exists profiles_last_room_idx
  on public.profiles(last_room_id);

-- Do not treat existing accounts as first-time users after this migration.
-- New profile rows retain NULL and are recognized by the existing bootstrap flow.
