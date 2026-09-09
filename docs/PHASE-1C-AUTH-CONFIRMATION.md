# Phase 1C — Hyperoom Authentication

## Product flow

Hyperoom registration is intentionally simple:

- Nickname / nama panggilan
- Nomor HP
- Password
- No email field
- No OTP at this stage

The browser never receives a Supabase secret key.

## Auth architecture

The public Supabase Phone provider is not used for self-service signup because
hosted Supabase currently requires an SMS provider configuration when Phone Auth
is enabled. Hyperoom therefore uses a server-only signup function.

1. Browser sends phone, nickname, and password to `/api/auth/signup`.
2. The Vercel Function uses `SUPABASE_SECRET_KEY` server-side only.
3. Supabase Admin API creates the user with `phone_confirm: true`.
4. The function creates the matching public profile and rolls back the Auth user
   if the profile insert fails.
5. Browser signs in with Supabase `signInWithPassword({ phone, password })`.

This keeps the user-facing credential model as phone + password without OTP.

## Required Vercel setting

Add `SUPABASE_SECRET_KEY` as a Production and Preview environment variable.
Use a newly generated Supabase secret key; never reuse a secret that was exposed
in source, chat, screenshots, or browser code.

## Supabase dashboard

- Phone provider: leave disabled for this server-mediated signup flow.
- Email provider: may remain enabled, but Hyperoom does not collect email.
- Confirm email: irrelevant to the Hyperoom UI because signup is server-mediated.
- Do not configure Twilio or another SMS provider yet.

## Security roadmap

The first release uses server-side confirmed phone credentials to avoid OTP cost.
As usage grows, add rate limits/CAPTCHA and phone verification or MFA before
relaxing the server-mediated flow. Supabase specifically recommends stronger
protection for phone-based credentials because phone numbers can be recycled.
