# Phase 0.1 — Architecture Reset

## Objective

Correct the project direction from an IRC-client-first architecture to a
Hyperoom-native chat platform inspired by mIRC.

## Decisions

1. Hyperoom does not require an external IRC server.
2. Supabase is the planned native backend foundation.
3. PWA is the long-term primary client target.
4. Classic mIRC commands remain a first-class interaction model.
5. IRC protocol code is isolated as compatibility infrastructure.
6. Native Hyperoom state is authoritative for native rooms and messages.
7. IRC bridging is optional and must not be a dependency of core chat.
8. No UI feature may be marked complete without real state and execution.

## Command mapping principle

Classic syntax is translated into native domain operations:

- `/join #room` -> room membership operation.
- `/part #room` -> room leave operation.
- `/msg user text` -> DM message operation.
- `/me action` -> action-style message operation.
- `/mode` -> role/permission operation.
- `/kick` and `/ban` -> moderation operations.
- `/topic` -> room metadata operation.

The exact command catalog will be implemented in a later phase.

## Repository state

- `packages/shared` now contains transport-independent Hyperoom domain contracts.
- `packages/irc-engine` remains available for protocol compatibility.
- `apps/desktop` remains temporarily for development and is not the product
architecture target.
- Documentation now defines Hyperoom-native state and optional IRC bridging.

## Explicitly not implemented in this phase

- Supabase schema deployment.
- Authentication UI.
- Real channel persistence.
- Realtime messaging.
- PWA shell migration.
- Full command execution.
- IRC gateway/IRC server connectivity.

Those belong to later implementation phases and must not be represented as
working features yet.

## Exit criteria

Phase 0.1 is complete when the codebase and documentation no longer describe
external IRC connectivity as the required core product architecture, while the
existing IRC protocol work remains reusable and isolated.
