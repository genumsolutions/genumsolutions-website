# GENUM SOLUTIONS website

Next.js App Router website for GENUM SOLUTIONS PVT. LTD., covering robotics, electronics, AI, IoT, 3D printing, digital products, training, and client project delivery.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. If that port is occupied, Next.js will report the alternate port in the terminal.

## Public areas

- `/products` contains source-named inventory, a dedicated Robot Cars category, and Excel project packages.
- `/training` contains the K–5 pilot, STEM Master Package, teacher enablement, 100+ project curriculum highlights, and illustrative proposal costing.
- `/services` covers website delivery, 3D and 2D printing, robotics workshops, school packages, and lab consultation.
- `/3d-printing` includes print services and an open model browser.
- `/tools` contains open-source CAD, electronics, firmware, simulation, and media resources.
- `/contact` sends inquiries through the server-side Resend integration.

## Environment

Copy `.env.example` to `.env.local` and add the Resend key before testing contact email delivery. Never commit `.env.local`, payment secrets, Wi-Fi credentials, or private proposal files.

## Accounts

Customer accounts, saved carts, orders, and messages run on Supabase Auth with cookie sessions (`middleware.ts` refreshes sessions on every request). Password reset and Google sign-in are wired through `/auth/callback`; the Google provider activates as soon as credentials are enabled in the Supabase dashboard. Admin access is any signed-in user whose `profiles.role` is `admin` - promote via `select public.set_admin('email');` in the Supabase SQL editor.

## Validation

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
npm.cmd run build
```

Product imagery uses shared, category-specific public Unsplash image URLs in `lib/product-media.ts`; every catalog listing and detail page resolves through that map so new listings do not need duplicate binary assets.

## Supabase backend

Products, homepage content, customer accounts, carts, orders, messages, and product images live in Supabase (Postgres + Auth + Storage). Without the env vars the site still runs from the bundled catalog in `lib/catalog.ts`.

### First-time setup

1. Create a project at [supabase.com](https://supabase.com) (region: Mumbai or Singapore).
2. Run `supabase/schema.sql` in the SQL Editor (tables, RLS policies, storage bucket).
3. Copy Project URL / anon key / service_role key from Settings → API into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
4. Seed the catalog: `npm run seed`
5. Authentication → Sign In / Providers → Email: keep "Confirm email" OFF until SMTP is configured.
6. Make yourself admin: sign up through `/login`, then run
   `update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`

### Daily operations (no deploys needed)

- **Add/edit products:** `/admin` panel — saves straight to Postgres; changes are live immediately on Vercel.
- **Product images:** Upload button in `/admin` stores files in the `product-images` Storage bucket.
- **Orders:** Customers see history in `/account`; admins manage statuses in the `/admin` panel.
- **Vercel env vars:** Add the three Supabase vars in Project Settings, then redeploy once.

### Payments

All three gateways follow the same safe pattern: the order is saved as `pending` server-side, prices are re-checked against the database, and payment is only confirmed after a server-to-server verification call.

| Provider | Checkout route | Verification | Env vars |
|---|---|---|---|
| Stripe card | `/api/checkout/stripe` | `/api/orders/confirm?session_id=…` | `STRIPE_SECRET_KEY` |
| eSewa ePay v2 | `/api/checkout/esewa` (returns signed form) | `/api/orders/confirm/esewa?data=…` → status API must say `COMPLETE` | `ESEWA_SECRET_KEY`, `ESEWA_PRODUCT_CODE`, `ESEWA_BASE_URL` |
| Khalti ePayment v2 | `/api/checkout/khalti` (initiate + redirect) | `/api/orders/confirm/khalti?pidx=…` → lookup must say `Completed` and amounts must match | `KHALTI_SECRET_KEY`, `KHALTI_BASE_URL` |

Test locally with UAT/test credentials: eSewa UAT (`EPAYTEST`) from [developer.esewa.com.np](https://developer.esewa.com.np) and Khalti test keys from [dashboard.khalti.com](https://dashboard.khalti.com). Cash-on-delivery orders need no configuration.

### Going further with Supabase

- **Stripe webhooks:** For bulletproof payment confirmation, add a webhook route verifying `STRIPE_WEBHOOK_SECRET` and updating `orders.status`; the current success-page verification covers the normal flow.
- **Realtime order alerts:** Subscribe the admin panel to `postgres_changes` on `public.orders` to see new orders instantly.
- **Google login:** Enable the Google provider in Authentication settings; no code change is required for customers (role-based redirects keep working).
- **Email verification & password reset:** Configure custom SMTP (Resend) in Authentication settings and flip "Confirm email" back ON.
