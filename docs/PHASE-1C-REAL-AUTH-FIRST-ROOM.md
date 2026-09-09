# Phase 1C — Real Auth + Bootstrap Profile + First Room

## Goal

Connect the application shell to the real Hyperoom Supabase data layer. No fake authentication, fake rooms, or mock chat state is used.

## Implemented

- `@hyperoom/data` is wired into the desktop renderer.
- Supabase session is restored on startup and auth state changes are subscribed to.
- Real email/password sign-in and sign-up are available.
- Missing profiles are bootstrapped from authenticated user metadata/email.
- Public rooms are loaded from PostgreSQL.
- Users can create a real public room and become its member through the repository API.
- Users can join existing public rooms.
- Real room messages are loaded from PostgreSQL.
- Messages are sent through the real `messages` table.
- Room message inserts/updates are received through Supabase Realtime.
- Sign-out uses Supabase Auth.
- Missing browser-safe environment variables produce a configuration screen instead of silently falling back to demo data.

## Browser configuration

Use only these browser-safe variables:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never place a Supabase service-role or secret key in the renderer, `.env.local`, source control, or a Vite bundle.

## Live database requirement

The SQL migrations under `supabase/migrations/` still need to be executed against the live Supabase project. Phase 1C does not claim that the live database has been migrated automatically.

Recommended manual order:

1. `20260909210000_hyperoom_core.sql`
2. `20260909210500_hyperoom_role_hardening.sql`
3. `20260909211000_realtime_delete_payloads.sql`
4. `20260909211500_room_membership_hardening.sql`

Run them one at a time in Supabase SQL Editor and verify each succeeds before running the next.

## Real-flow acceptance test

After the live migrations are applied and the two browser-safe variables are configured:

1. Start the app with `npm run dev` from the workspace or the desktop package.
2. Create a new account.
3. If email confirmation is enabled, confirm the account and sign in.
4. Verify a profile row exists for the authenticated user.
5. Create a public room from the Rooms sidebar.
6. Verify the room and owner membership exist in Supabase.
7. Send a message.
8. Open a second authenticated client and verify the message arrives through Realtime.
9. Sign out and verify the session is removed.

## Not in Phase 1C

- Final mIRC-style visual design.
- Full command execution.
- DM/presence/typing UX.
- Moderation/operator workflows.
- File/media handling.
- External IRC connectivity.
- Production Realtime authorization hardening for presence/broadcast.
