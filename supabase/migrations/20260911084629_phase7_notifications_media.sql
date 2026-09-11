-- Phase 7: notification hardening + real private media attachments.

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  bucket_id text not null default 'hyperoom-media',
  path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width integer,
  height integer,
  duration_ms integer,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists message_attachments_message_idx on public.message_attachments(message_id, created_at);
create index if not exists message_attachments_room_idx on public.message_attachments(room_id, created_at);

alter table public.message_attachments enable row level security;
grant select, insert, update, delete on public.message_attachments to authenticated;

drop policy if exists message_attachments_select_access on public.message_attachments;
create policy message_attachments_select_access on public.message_attachments
  for select to authenticated using (
    exists (select 1 from public.room_members rm where rm.room_id = message_attachments.room_id and rm.user_id = auth.uid())
  );
drop policy if exists message_attachments_insert_own on public.message_attachments;
create policy message_attachments_insert_own on public.message_attachments
  for insert to authenticated with check (
    uploader_id = auth.uid() and exists (select 1 from public.room_members rm where rm.room_id = message_attachments.room_id and rm.user_id = auth.uid())
    and exists (select 1 from public.messages m where m.id = message_attachments.message_id and m.room_id = message_attachments.room_id and m.sender_id = auth.uid())
  );
drop policy if exists message_attachments_update_own on public.message_attachments;
create policy message_attachments_update_own on public.message_attachments
  for update to authenticated using (uploader_id = auth.uid()) with check (uploader_id = auth.uid());
drop policy if exists message_attachments_delete_own on public.message_attachments;
create policy message_attachments_delete_own on public.message_attachments
  for delete to authenticated using (uploader_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hyperoom-media', 'hyperoom-media', false, 52428800,
  array['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','audio/webm','audio/ogg','audio/mpeg','application/pdf','text/plain','application/zip','application/octet-stream']::text[])
on conflict (id) do update set public=false, file_size_limit=52428800,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists hyperoom_media_insert on storage.objects;
create policy hyperoom_media_insert on storage.objects
  for insert to authenticated with check (
    bucket_id='hyperoom-media' and (storage.foldername(name))[2]=(select auth.uid()::text)
    and exists (select 1 from public.room_members rm where rm.room_id=(((storage.foldername(name))[1])::uuid) and rm.user_id=(select auth.uid()))
  );
drop policy if exists hyperoom_media_select on storage.objects;
create policy hyperoom_media_select on storage.objects
  for select to authenticated using (
    bucket_id='hyperoom-media' and ((storage.foldername(name))[2]=(select auth.uid()::text) or exists (
      select 1 from public.message_attachments a
      join public.room_members rm on rm.room_id=a.room_id
      where a.bucket_id=storage.objects.bucket_id and a.path=storage.objects.name and rm.user_id=(select auth.uid()) and a.deleted_at is null
    ))
  );
drop policy if exists hyperoom_media_update_own on storage.objects;
create policy hyperoom_media_update_own on storage.objects
  for update to authenticated using (bucket_id='hyperoom-media' and owner_id=(select auth.uid()::text))
  with check (bucket_id='hyperoom-media' and owner_id=(select auth.uid()::text));
drop policy if exists hyperoom_media_delete_own on storage.objects;
create policy hyperoom_media_delete_own on storage.objects
  for delete to authenticated using (bucket_id='hyperoom-media' and owner_id=(select auth.uid()::text));

create or replace function public.create_message_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
declare r record; ntype text; ntitle text; nbody text; ekey text; enabled boolean;
begin
  if NEW.sender_id is null or NEW.deleted_at is not null then return NEW; end if;
  for r in select rm.user_id, ro.type room_type, ro.name room_name from public.room_members rm join public.rooms ro on ro.id=rm.room_id where rm.room_id=NEW.room_id and rm.user_id<>NEW.sender_id loop
    ntype:=null; ntitle:=null; nbody:=left(NEW.content,180); enabled:=true;
    if r.room_type='dm' then ntype:='dm'; ntitle:='New message';
    elsif NEW.reply_to_message_id is not null and exists(select 1 from public.messages m where m.id=NEW.reply_to_message_id and m.sender_id=r.user_id) then ntype:='reply'; ntitle:='Reply to your message in #'||r.room_name;
    elsif exists(select 1 from public.profiles mp where mp.id=r.user_id and lower(NEW.content) like '%'||lower('@'||mp.username)||'%') then ntype:='mention'; ntitle:='You were mentioned in #'||r.room_name; end if;
    if ntype='dm' then select coalesce(dm_enabled,true) into enabled from public.notification_preferences where user_id=r.user_id;
    elsif ntype='reply' then select coalesce(reply_enabled,true) into enabled from public.notification_preferences where user_id=r.user_id;
    elsif ntype='mention' then select coalesce(mention_enabled,true) into enabled from public.notification_preferences where user_id=r.user_id; end if;
    if ntype is not null and enabled then
      ekey:='message:'||ntype||':'||NEW.id::text||':'||r.user_id::text;
      insert into public.notifications(recipient_user_id,actor_user_id,type,entity_type,entity_id,room_id,message_id,title,body,payload,event_key)
      values(r.user_id,NEW.sender_id,ntype,'message',NEW.id,NEW.room_id,NEW.id,ntitle,nbody,jsonb_build_object('roomId',NEW.room_id,'messageId',NEW.id,'roomName',r.room_name),'message:'||ntype||':'||NEW.id::text||':'||r.user_id::text)
      on conflict(event_key) do nothing;
    end if;
  end loop; return NEW;
end $$;

create or replace function public.create_invitation_notification() returns trigger language plpgsql security definer set search_path=public as $$
declare rn text; enabled boolean:=true;
begin
  select name into rn from public.rooms where id=NEW.room_id;
  select coalesce(system_enabled,true) into enabled from public.notification_preferences where user_id=NEW.invitee_id;
  if enabled then insert into public.notifications(recipient_user_id,actor_user_id,type,entity_type,entity_id,room_id,title,body,payload,event_key)
    values(NEW.invitee_id,NEW.inviter_id,'invitation','room_invitation',NEW.id,NEW.room_id,'Room invitation','You were invited to #'||coalesce(rn,'room'),jsonb_build_object('roomId',NEW.room_id,'invitationId',NEW.id),'invitation:'||NEW.id::text) on conflict(event_key) do nothing; end if;
  return NEW;
end $$;

create or replace function public.create_role_notification() returns trigger language plpgsql security definer set search_path=public as $$
declare rn text; enabled boolean:=true; actor uuid:=auth.uid();
begin
  if NEW.role is distinct from OLD.role and NEW.user_id<>coalesce(actor,'00000000-0000-0000-0000-000000000000'::uuid) then
    select name into rn from public.rooms where id=NEW.room_id;
    select coalesce(moderation_enabled,true) into enabled from public.notification_preferences where user_id=NEW.user_id;
    if enabled then insert into public.notifications(recipient_user_id,actor_user_id,type,entity_type,entity_id,room_id,title,body,payload,event_key)
      values(NEW.user_id,actor,'role_change','room_member',NEW.user_id,NEW.room_id,'Room role changed','Your role in #'||coalesce(rn,'room')||' is now '||upper(NEW.role::text),jsonb_build_object('roomId',NEW.room_id,'role',NEW.role),'role:'||NEW.room_id::text||':'||NEW.user_id::text||':'||OLD.role::text||':'||NEW.role::text) on conflict(event_key) do nothing; end if;
  end if;
  return NEW;
end $$;

create or replace function public.create_moderation_notification() returns trigger language plpgsql security definer set search_path=public as $$
declare target_username text; target_id uuid; enabled boolean:=true; action_name text;
begin
  if NEW.event_type::text not in ('kick','ban') then return NEW; end if;
  action_name:=upper(NEW.event_type::text);
  target_username:=substring(NEW.content from '(?:kicked|banned) ([A-Za-z0-9_]+)');
  select id into target_id from public.profiles where lower(username)=lower(target_username) limit 1;
  if target_id is null then return NEW; end if;
  select coalesce(moderation_enabled,true) into enabled from public.notification_preferences where user_id=target_id;
  if enabled then insert into public.notifications(recipient_user_id,actor_user_id,type,entity_type,entity_id,room_id,message_id,title,body,payload,event_key)
    values(target_id,NEW.sender_id,'moderation','message',NEW.id,NEW.room_id,NEW.id,'Moderation: '||action_name,left(NEW.content,180),jsonb_build_object('roomId',NEW.room_id,'messageId',NEW.id),'moderation:'||NEW.id::text||':'||target_id::text) on conflict(event_key) do nothing; end if;
  return NEW;
end $$;

drop trigger if exists trg_moderation_notifications on public.messages;
create trigger trg_moderation_notifications after insert on public.messages for each row execute function public.create_moderation_notification();

-- Keep the existing message, invitation and role triggers; only replace their functions above.
