alter table public.notifications add column if not exists push_sent_at timestamptz;
create index if not exists notifications_push_pending_idx on public.notifications(push_sent_at, created_at) where push_sent_at is null;
create or replace function public.create_message_notifications() returns trigger language plpgsql security definer set search_path=public as $$
declare r record; ntype text; ntitle text; nbody text; ekey text;
begin
 if NEW.sender_id is null or NEW.deleted_at is not null then return NEW; end if;
 for r in select rm.user_id, ro.type room_type, ro.name room_name from public.room_members rm join public.rooms ro on ro.id=rm.room_id where rm.room_id=NEW.room_id and rm.user_id<>NEW.sender_id loop
  ntype:=null; ntitle:=null; nbody:=left(NEW.content,180);
  if r.room_type='dm' then ntype:='dm'; ntitle:='New message';
  elsif NEW.reply_to_message_id is not null and exists(select 1 from public.messages m where m.id=NEW.reply_to_message_id and m.sender_id=r.user_id) then ntype:='reply'; ntitle:='Reply to your message in #'||r.room_name;
  elsif exists(select 1 from public.profiles mp where mp.id=r.user_id and lower(NEW.content) like '%'||lower('@'||mp.username)||'%') then ntype:='mention'; ntitle:='You were mentioned in #'||r.room_name; end if;
  if ntype is not null then ekey:=ntype||':'||NEW.id::text||':'||r.user_id::text; insert into public.notifications(recipient_user_id,actor_user_id,type,entity_type,entity_id,room_id,message_id,title,body,payload,event_key) values(r.user_id,NEW.sender_id,ntype,'message',NEW.id,NEW.room_id,NEW.id,ntitle,nbody,jsonb_build_object('roomId',NEW.room_id,'messageId',NEW.id,'roomName',r.room_name),'message:'||ekey) on conflict(event_key) do nothing; end if;
 end loop; return NEW; end $$;
drop trigger if exists trg_message_notifications on public.messages;
create trigger trg_message_notifications after insert on public.messages for each row execute function public.create_message_notifications();
create or replace function public.create_invitation_notification() returns trigger language plpgsql security definer set search_path=public as $$ declare rn text; begin select name into rn from public.rooms where id=NEW.room_id; insert into public.notifications(recipient_user_id,actor_user_id,type,entity_type,entity_id,room_id,title,body,payload,event_key) values(NEW.invitee_id,NEW.inviter_id,'invitation','room_invitation',NEW.id,NEW.room_id,'Room invitation','You were invited to #'||coalesce(rn,'room'),jsonb_build_object('roomId',NEW.room_id,'invitationId',NEW.id),'invitation:'||NEW.id::text) on conflict(event_key) do nothing; return NEW; end $$;
drop trigger if exists trg_invitation_notifications on public.room_invitations;
create trigger trg_invitation_notifications after insert on public.room_invitations for each row execute function public.create_invitation_notification();
create or replace function public.create_role_notification() returns trigger language plpgsql security definer set search_path=public as $$ declare rn text; begin if NEW.role is distinct from OLD.role then select name into rn from public.rooms where id=NEW.room_id; insert into public.notifications(recipient_user_id,type,entity_type,entity_id,room_id,title,body,payload,event_key) values(NEW.user_id,'role_change','room_member',NEW.user_id,NEW.room_id,'Room role changed','Your role in #'||coalesce(rn,'room')||' is now '||upper(NEW.role::text),jsonb_build_object('roomId',NEW.room_id,'role',NEW.role),'role:'||NEW.room_id::text||':'||NEW.user_id::text||':'||NEW.role::text||':'||extract(epoch from now())::text) on conflict(event_key) do nothing; end if; return NEW; end $$;
drop trigger if exists trg_role_notifications on public.room_members;
create trigger trg_role_notifications after update of role on public.room_members for each row execute function public.create_role_notification();
