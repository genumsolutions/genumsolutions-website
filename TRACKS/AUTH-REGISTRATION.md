# Registration + sign-in — 2026-11-12

How auth works now, in one place, because it changed direction three times in a day.
Website (`components/AuthPanel.tsx`, `app/api/auth/*`, `app/auth/callback`) and app
(`mobile/src/components/SignInSheet.tsx`, `mobile/src/services/authService.ts`,
`mobile/src/context/AppContext.tsx`) are the same flow with the same words.

## The flow

| Surface | Action                                   | Result                                                                                                                                                        |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Both    | Register, email + password               | Account created, **confirmation email sent**, no session. UI says "Registered. Check your email to confirm it, then sign in." + **Resend confirmation email** |
| Both    | Email link clicked                       | `/auth/callback` verifies, lands on `/account?welcome=1` ("Email confirmed - your registration is complete."), signed in                                      |
| Both    | Sign in, email + password                | Existing account only. An unconfirmed address is told to confirm first                                                                                        |
| Both    | **Continue with Google** (sign-in form)  | Signs in; creates the account if this Google address is new (standard behaviour, no dead end)                                                                 |
| Both    | **Register with Google** (register form) | Same call — Google is a registration path. `email_verified` is true, so never asked to confirm                                                                |
| Website | Password reset                           | `/reset-password` (unchanged)                                                                                                                                 |

Google is no longer blocked from creating accounts: `supabase/schema.sql` keeps only the
`drop trigger/function block_new_google_account` statements, so a re-provision converges
and an old database loses the guard.

## Why there is no "delete the fresh account" guard

Google sign-in previously enforced "the sign-in form must never register" by letting Supabase
create the row and then deleting it: the website callback removed a `created_at` younger than
5 minutes unless an intent cookie said signup, and the app called `/api/auth/google/fresh` to do
the same with its own token. Both are gone. That design failed in exactly the way it looks like
it should: the intent hint is best-effort (cookie dropped or blocked, a different host than
`NEXT_PUBLIC_SITE_URL`, a trip longer than the cookie's 10 minutes, a direct OAuth URL, the
website offline for the app's hand-off), so a **real sign-up was deleted moments after it was
created** and the next attempt was told to sign up again. Enforcing intent after the fact is not
recoverable; the only safe rule is that a verified Google identity signs in and registers if
needed. Do not reintroduce a delete path on `auth.users` for OAuth, and do not re-add
`block_new_google_account`.

## The switch for confirmation

`mailer_autoconfirm` is **false** in the live project (`jxgmbodzkmxanuwfaqxo`). That is what
makes a first registration send a confirmation link instead of handing out a session.

```bash
# current values
GET  https://api.supabase.com/v1/projects/jxgmbodzkmxanuwfaqxo/config/auth
# turn confirmation off again (registrations then sign in immediately)
PATCH .../config/auth -d '{"mailer_autoconfirm": true}'
```

## Known prerequisite: custom SMTP

The project has **no custom SMTP** (`smtp_host`, `smtp_user`, `smtp_admin_email`,
`smtp_sender_name` are `null`) and `rate_limit_email_sent` is **2**. Confirmation mail
therefore goes through Supabase's built-in sender: it is capped at 2 messages per hour per
project and is often filtered to spam. The Gravity Index has no SMTP-capable transactional
provider (its only Email match, Knock, explicitly does not expose SMTP credentials), so the
provider has to be chosen by the owner.

To finish this properly, set in Dashboard → Authentication → Emails (SMTP settings):

- `smtp_host`, `smtp_port` (587 STARTTLS / 465 SSL), `smtp_user`, `smtp_pass`
- `smtp_sender_name` = `GENUM Solutions`, `smtp_admin_email` = the verified sender
- then raise `rate_limit_email_sent` above 2 — the 2/hour cap cannot be raised on the
  built-in sender, only with custom SMTP

Any provider that hands out SMTP credentials works (Resend, Postmark, Brevo, Mailgun,
SendGrid, or the owner's own mailbox host). No code change is needed for the switch above —
only `.env`-free dashboard/Management-API values.

## Verification

`tests/auth-registration.test.ts` pins the behaviour: no `block_new_google_account` in
`schema.sql`, no `deleteUser`/`no_account`/intent cookie in the callback, no
`app/api/auth/google/fresh` endpoint, one `/api/auth/google` entry point, mode-specific Google
labels, "Sign up" wording, and `emailRedirectTo` + `/account?welcome=1` in the register route and
callback. The app side keeps the same rule in `mobile/src/services/authService.ts`: a returned
Google session is persisted, never discarded.
