# Architecture — Hyperoom mIRC

## Product shape

Hyperoom is a Hyperoom-native real-time chat platform that preserves the
interaction model and spirit of classic mIRC while adding modern communication
features. An external IRC server is **not required**.

## Primary runtime

The long-term product is a browser-first Progressive Web App (PWA).
The current `apps/desktop` workspace is a temporary development shell and must
not become a hidden dependency of the product architecture.

## Native backend

Supabase is the planned backend foundation:

- Auth — identity and sessions.
- PostgreSQL — authoritative application state.
- Realtime — delivery of persisted/domain events to connected clients.
- Storage — user/media/file assets when required.

The exact service boundaries may evolve, but authoritative state belongs to the
native Hyperoom backend rather than to React component state.

## Domain model

Core entities are Hyperoom-native: users, profiles, rooms, room memberships,
roles/permissions, messages, reactions, attachments, presence, moderation
records, notifications, and future automation/bot entities.

Classic IRC terminology is an interaction layer over these entities. A command
such as `/join #room` resolves to a real room membership operation; it does not
need to open an IRC socket.

## Event flow

User action -> command/domain engine -> authorization -> persistence ->
domain event -> Realtime -> client state -> UI.

The client may optimistically render transient UI state, but authoritative
success, permissions, membership, messages, and moderation results come from the
backend/event flow.

## mIRC compatibility layer

`packages/irc-engine` is retained as an isolated compatibility layer. It owns
IRC message parsing, serialization, and classic command syntax. Native
Hyperoom operation must not import or depend on external IRC transport.

Future IRC bridging is optional:

`Hyperoom -> IRC bridge -> external IRC network`

This bridge is an adapter, not the source of truth for native Hyperoom rooms.

## Security boundary

No Supabase secret/service credential belongs in the PWA bundle or source tree.
Browser-safe credentials may be used according to Supabase's client model;
server-only credentials stay on trusted infrastructure.

## Architectural rule

No visible feature is considered complete unless its state transition, error
path, authorization, persistence/realtime behavior, and UI integration are real.
Mockups and demo-only success states are prohibited as finished functionality.
