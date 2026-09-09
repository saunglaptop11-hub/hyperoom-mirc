-- Hyperoom Auth — phone is an application identifier, not Supabase Phone Auth.
-- No SMS, OTP, or phone provider is required by the application auth flow.

create table public.account_identifiers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null,
  created_at timestamptz not null default now(),
  constraint account_identifiers_phone_length check (char_length(phone) between 8 and 20)
);

create unique index account_identifiers_phone_unique_idx
  on public.account_identifiers (phone);

alter table public.account_identifiers enable row level security;
revoke all on public.account_identifiers from anon, authenticated;
grant select, insert, update, delete on public.account_identifiers to service_role;

insert into public.account_identifiers (user_id, phone)
select p.id, u.phone
from public.profiles p
join auth.users u on u.id = p.id
where u.phone is not null;
