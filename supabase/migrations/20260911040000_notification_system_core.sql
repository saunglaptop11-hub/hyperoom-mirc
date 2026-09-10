create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('dm','mention','reply','invitation','role_change','moderation','system','missed_activity')),
  entity_type text not null,
  entity_id uuid,
  room_id uuid references public.rooms(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  event_key text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_recipient_created_idx on public.notifications(recipient_user_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications(recipient_user_id, read_at, created_at desc);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  dm_enabled boolean not null default true,
  mention_enabled boolean not null default true,
  reply_enabled boolean not null default true,
  room_activity_enabled boolean not null default false,
  moderation_enabled boolean not null default true,
  system_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id, disabled_at);

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

grant select, update, delete on public.notifications to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create policy notifications_select_own on public.notifications for select to authenticated using (recipient_user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete to authenticated using (recipient_user_id = auth.uid());
create policy notification_preferences_select_own on public.notification_preferences for select to authenticated using (user_id = auth.uid());
create policy notification_preferences_insert_own on public.notification_preferences for insert to authenticated with check (user_id = auth.uid());
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_subscriptions_insert_own on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy push_subscriptions_update_own on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.notifications;
