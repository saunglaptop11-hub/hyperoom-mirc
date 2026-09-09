# Phase 1B — Native Supabase Data Layer

## Goal

Connect Hyperoom domain operations to the real Supabase client API without
introducing fake state or an IRC transport dependency.

## Delivered

- `@hyperoom/data` workspace package.
- Typed Supabase browser client using only publishable credentials.
- Auth API: session, sign-in, sign-up, sign-out, auth-state subscription.
- Repository API for profiles, rooms, memberships, messages, and reactions.
- Real Supabase Realtime subscriptions for room messages, members, reactions.
- Realtime Presence and typing helpers.
- Database types matching the Phase 1 SQL schema.
- Delete-event migration using `REPLICA IDENTITY FULL` for complete payloads.
- Tests covering authentication requirements and message validation.

## Security boundary

The data package never accepts or embeds a service-role/secret credential.
The PWA may use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` only.
Authorization is enforced by PostgreSQL RLS; client-side checks are not the
security boundary.

## Live database status

The migrations are present locally and are ready to apply. The ChatGPT
Supabase connector previously returned a permission error for database access,
so this phase does **not** claim that the live project has been migrated.

## Not complete in Phase 1B

- Production migration verification against the live project.
- Authentication UI.
- Full command execution and moderation commands.
- PWA UI integration.

Those remain explicit follow-up work rather than demo-only placeholders.
