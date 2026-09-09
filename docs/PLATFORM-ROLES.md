# Hyperoom Platform Roles

## One login door

Every account uses the same login screen. The client never asks the user to choose a role.

Registration always creates `member`.

Login resolves the nickname on the trusted server, authenticates the account with Supabase Auth, then loads the platform role from `profiles.system_role`.

## Platform hierarchy

```text
OWNER
  └─ ADMIN
      └─ MODERATOR
          └─ MEMBER
```

`VOICE` is not a platform role. It is a per-room mIRC-style privilege stored in `room_members.role`.

## Owner

The Owner is a platform identity, not a room operator. Owner authority applies across every room and does not require OP in that room.

The Owner can manage platform roles, channels, moderation, and future system controls. The Owner role is never selectable from public registration.

## Admin and Moderator

Admins are below Owner and may manage roles below Admin, including Moderators and channel privileges. They cannot create or take the Owner role.

Moderators provide moderation authority. They cannot promote themselves or others to Admin/Owner.

## Security boundary

Platform role changes are validated in PostgreSQL through `set_platform_role()` and a protected profile trigger. Client UI is never trusted for authorization.

The first Owner is created only by the secure `scripts/bootstrap-owner.mjs` setup flow using the server-only Supabase secret. Public signup explicitly writes `member`.
