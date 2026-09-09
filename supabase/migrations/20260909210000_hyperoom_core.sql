-- Hyperoom Core — Phase 1
-- Native Hyperoom state. IRC is compatibility syntax only.

create type public.room_type as enum ('public', 'private', 'dm', 'group');
create type public.member_role as enum ('owner', 'admin', 'operator', 'voice', 'member');
create type public.message_kind as enum ('text', 'action', 'system');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  bio text,
  status_text text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 1 and 32),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 80)
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.room_type not null default 'public',
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_name_length check (char_length(name) between 1 and 120)
);

create unique index rooms_name_lower_idx on public.rooms (lower(name)) where type <> 'dm';
create index rooms_created_by_idx on public.rooms (created_by);
create index rooms_type_idx on public.rooms (type);

create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_members_user_id_idx on public.room_members (user_id);
create index room_members_room_role_idx on public.room_members (room_id, role);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  kind public.message_kind not null default 'text',
  content text not null,
  reply_to_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint messages_content_length check (char_length(content) between 1 and 4000)
);

create index messages_room_created_idx on public.messages (room_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);
create index messages_reply_idx on public.messages (reply_to_message_id);

create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji),
  constraint reactions_emoji_length check (char_length(emoji) between 1 and 32)
);

create index message_reactions_message_idx on public.message_reactions (message_id);
create index message_reactions_user_idx on public.message_reactions (user_id);

-- Keep updated_at authoritative on server.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

-- A room creator becomes its owner atomically after room creation.
create or replace function public.add_room_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.room_members (room_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger rooms_add_owner
after insert on public.rooms
for each row execute function public.add_room_owner();

-- RLS helper functions avoid recursive room_members policies.
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.user_id = p_user_id
  );
$$;

create or replace function public.has_room_role(
  p_room_id uuid,
  p_roles public.member_role[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = p_user_id
      and rm.role = any(p_roles)
  );
$$;

create or replace function public.is_room_moderator(
  p_room_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_room_role(
    p_room_id,
    array['owner','admin','operator']::public.member_role[],
    p_user_id
  );
$$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;

create policy profiles_select_authenticated
on public.profiles for select
to authenticated using (true);

create policy profiles_insert_self
on public.profiles for insert
to authenticated with check (id = auth.uid());

create policy profiles_update_self
on public.profiles for update
to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy rooms_select_accessible
on public.rooms for select
to authenticated
using (type = 'public' or public.is_room_member(id));

create policy rooms_insert_self
on public.rooms for insert
to authenticated
with check (created_by = auth.uid());

create policy rooms_update_moderator
on public.rooms for update
to authenticated
using (public.is_room_moderator(id))
with check (public.is_room_moderator(id));

create policy rooms_delete_owner
on public.rooms for delete
to authenticated
using (public.has_room_role(id, array['owner']::public.member_role[]));

create policy room_members_select_members
on public.room_members for select
to authenticated
using (public.is_room_member(room_id));

create policy room_members_insert_self_public
on public.room_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.rooms r
    where r.id = room_id and r.type = 'public'
  )
);

create policy room_members_insert_moderator
on public.room_members for insert
to authenticated
with check (public.is_room_moderator(room_id));

create policy room_members_update_moderator
on public.room_members for update
to authenticated
using (public.is_room_moderator(room_id))
with check (public.is_room_moderator(room_id));

create policy room_members_delete_self
on public.room_members for delete
to authenticated
using (user_id = auth.uid());

create policy messages_select_members
on public.messages for select
to authenticated
using (public.is_room_member(room_id));

create policy messages_insert_members
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_room_member(room_id)
);

create policy messages_update_author_or_moderator
on public.messages for update
to authenticated
using (sender_id = auth.uid() or public.is_room_moderator(room_id))
with check (sender_id = auth.uid() or public.is_room_moderator(room_id));

create policy messages_delete_author_or_moderator
on public.messages for delete
to authenticated
using (sender_id = auth.uid() or public.is_room_moderator(room_id));

create policy reactions_select_members
on public.message_reactions for select
to authenticated
using (
  exists (
    select 1 from public.messages m
    where m.id = message_id and public.is_room_member(m.room_id)
  )
);

create policy reactions_insert_self
on public.message_reactions for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.messages m
    where m.id = message_id and public.is_room_member(m.room_id)
  )
);

create policy reactions_delete_self
on public.message_reactions for delete
to authenticated
using (user_id = auth.uid());

-- Realtime delivers authoritative room/message changes. Presence/typing remain ephemeral.
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reactions;
