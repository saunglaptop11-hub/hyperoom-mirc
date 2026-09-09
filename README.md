# Hyperoom mIRC

Modern real-time chat platform inspired by the classic mIRC experience.

Hyperoom is **Hyperoom-native first**. IRC is the product inspiration and a
compatibility layer, not a required external server dependency.

## Product direction

- mIRC-style channels, nick lists, commands, roles, moderation, and events.
- Modern DM, profiles, reactions, replies, media, notifications, search, and PWA UX.
- Supabase provides the native application backend: Auth, PostgreSQL, Realtime,
and Storage where appropriate.
- The browser/PWA is the primary product target.
- The existing Electron workspace is retained temporarily as a development shell
until the PWA application workspace is implemented.

## Architecture

- `apps/desktop` — current development shell; not the long-term product boundary.
- `packages/shared` — Hyperoom domain contracts and transport-independent events.
- `packages/irc-engine` — mIRC/IRC protocol compatibility layer; optional for
native Hyperoom operation.
- `docs` — architecture, phase plans, and QC records.

## Core principle

IRC concepts are mapped onto Hyperoom-native entities. For example, `/join`
joins a Hyperoom room, `/msg` sends a native message/DM, and `/mode` invokes
the Hyperoom permission engine. These commands must execute real backend/state
operations rather than only changing UI text.

## Backend source of truth

For native Hyperoom features:

`PWA -> Hyperoom application API/realtime layer -> Supabase -> persisted state/events`

The UI never fabricates authoritative user, room, membership, message, role,
presence, moderation, or delivery state.

## Optional IRC compatibility

Future IRC bridging may expose external IRC networks without making them a
requirement for normal Hyperoom use. The IRC protocol engine remains isolated so
native Hyperoom architecture does not depend on IRC transport.

## Non-negotiable rule

Every visible feature must be backed by real state and real execution.
No fake success, mock connection state, placeholder functionality, or demo-only
feature may be marked complete.

## Current phase

**Phase 0.1 — Architecture Reset**: align the repository with the Hyperoom-native
product model before implementing the real application core.
