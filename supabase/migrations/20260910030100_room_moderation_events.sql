-- Moderation lifecycle events are first-class room events.
alter type public.message_event_type add value if not exists 'kick';
alter type public.message_event_type add value if not exists 'ban';
alter type public.message_event_type add value if not exists 'unban';
