# Phase 1C — Auth Confirmation

## Real flow

Hyperoom uses Supabase Auth with email/password. When email confirmation is enabled, signup intentionally returns no session until the user confirms the email.

The desktop app now sends the browser origin as `emailRedirectTo`. After confirmation, Supabase returns to the app and the existing `detectSessionInUrl` plus auth-state listener restores the session.

## Required Supabase Auth settings

In Supabase Dashboard → Authentication → URL Configuration, allow these development origins:

- `http://127.0.0.1:5173/**`
- `http://localhost:5173/**`

Also allow the production Hyperoom origin when deployed:

- `https://hyperoom.ngulikpc.online/**`

Keep the Site URL set to the primary production origin.

## User flow

1. Create account.
2. Supabase sends the confirmation email.
3. User opens the email link.
4. Supabase redirects back to Hyperoom.
5. Hyperoom restores the authenticated session.
6. Profile bootstrap runs.
7. Public rooms load.
8. Room membership and chat continue through the real repository/RLS layer.

The auth UI also exposes a real resend-confirmation action. No fake confirmation state is used.
