# Phase 1C — Phone Authentication

## Real registration flow

Hyperoom does not require an email address for account registration.

Registration uses exactly:

1. Nickname / nama panggilan
2. Nomor telepon
3. Password

Supabase Auth stores the phone credential. The nickname is stored in the
authenticated user's metadata and becomes the Hyperoom profile username/display name.

## Login

Login uses:

- Nomor telepon
- Password

The nickname is not used as a credential; it is the user's public identity in Hyperoom.

## Required Supabase Auth settings

1. Enable **Phone** as an Auth provider.
2. Configure an SMS provider if phone confirmation/OTP is enabled.
3. If the product requirement is instant account creation without OTP, keep phone
   confirmation disabled. This means the phone number is a login identifier, not
   proof of phone ownership.
4. Email authentication is not required by the Hyperoom client.

## Smoke test

1. Open the Hyperoom deployment.
2. Choose **Create account**.
3. Enter nickname, phone number, and password only.
4. Create the account.
5. Confirm the authenticated session is restored.
6. Confirm the profile row contains the nickname.
7. Create/join a room and send a real message.
8. Sign out, then sign back in using phone + password.

No email confirmation flow is used by the application.
