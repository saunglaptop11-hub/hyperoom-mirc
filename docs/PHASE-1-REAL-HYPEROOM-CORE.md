# Phase 1 — REAL HYPEROOM CORE

## Goal

Build the authoritative Hyperoom-native domain foundation. Supabase is the
planned source of truth; IRC syntax is only a compatibility/interaction layer.

## Implemented locally

- Profiles with identity, display name, bio, status, and last-seen metadata.
- Rooms with public/private/DM/group types and creator ownership.
- Room membership with owner/admin/operator/voice/member roles.
- Messages with text/action/system kinds, replies, edit/delete timestamps.
- Message reactions with per-user/per-emoji uniqueness.
- Server-side timestamps and room-owner creation trigger.
- RLS policies for profiles, rooms, memberships, messages, and reactions.
- Role-management hardening preventing users from self-assigning elevated roles.
- Realtime publication for rooms, memberships, messages, and reactions.
- Presence/typing represented as ephemeral realtime state; last_seen is persisted.
- Native mIRC-style command parser groundwork for join, part, msg, me, nick,
  whois, mode, kick, and ban.

## Migration files

1. `supabase/migrations/20260909210000_hyperoom_core.sql`
2. `supabase/migrations/20260909210500_hyperoom_role_hardening.sql`

These files are prepared for the Hyperoom Supabase project. They have **not**
been claimed as deployed to production because the ChatGPT Supabase connector
has not provided a working live database session in this turn.

## Command boundary

Parsing a command is implemented locally. Execution remains a backend/domain
operation and must not mutate fake client state. Later phases will connect each
parsed command to authenticated Supabase operations and authoritative realtime
results.

## Explicit non-goals

- No IRC TCP/WebSocket gateway as native transport.
- No fake in-memory database presented as production state.
- No PWA redesign in this backend/core phase.
- No claim that the production Supabase database has been migrated.

## Exit evidence

Local TypeScript typecheck, production build, and test suites pass after the
Phase 1 changes. Live migration verification remains blocked by the connector.
