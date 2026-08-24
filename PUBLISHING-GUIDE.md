# GENUM SOLUTIONS publishing guide

This document explains what exists, what is required before launch, and the exact information to give Copilot when publishing the website.

## 1. Project identity

- Company: GENUM SOLUTIONS PVT. LTD.
- Official address: Shringhkhala Galli-32, Kathmandu, Nepal
- Website type: Next.js App Router storefront and company website
- Brand asset: `public/logo.png` copied from the supplied `LOGO/final2.png`
- Primary verticals: robotics, electronics, AI, IoT, 3D printing, digital products, and training
- Currency currently shown: NPR
- Primary delivery market: Nepal
- Primary language currently implemented: English
- Repository root: `E:\GENUM SOLUTIONS PVT LTD\genumsolutions-website`

## 2. What is already built

- Responsive homepage
- Shared route header and footer
- Standardized homepage and inner-page shell with one navigation and footer system
- Light/dim mode saved in browser storage
- Services page
- Product catalog with search and category filters
- Source-backed inventory catalog with controllers, motors, sensors, power, mechanical parts, tools, printing materials, 3 distinct Robot Cars, and 20 Excel project packages from `INVENTORY`
- Shared category imagery for every product card and product detail page
- Open-source Tools directory and embedded 3D model library
- Product detail pages
- Local persistent cart and checkout form
- Stripe checkout with server-side confirmation
- eSewa ePay v2 and Khalti ePayment v2 checkout with signed requests and server-to-server verification
- Customer accounts, saved carts, order history (Supabase Auth + Postgres)
- Training page
- Source-backed K–5 robotics pilot, STEM Master Package, teacher enablement, 100+ project curriculum highlights, and illustrative proposal costing
- Services and workshop pages
- Journal page
- Contact page
- Dedicated 3D-printing page
- 3D-printing products: PLA filament and printer care kit
- Quote-only project packages clearly separated from stocked retail inventory
- Supabase backend: products, site content, profiles with roles, orders, carts, messages, product image storage
- SEO metadata, Open Graph metadata, Twitter metadata, favicon, JSON-LD organization data
- Generated `robots.txt` and `sitemap.xml` routes
- Official address centralized in `lib/company.ts`

## 3. Run locally

Install Node.js LTS first. Then open PowerShell:

```powershell
cd "e:\GENUM SOLUTIONS PVT LTD\Website"
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

Useful checks:

```powershell
npm.cmd run build
.\node_modules\.bin\tsc.cmd --noEmit
```

If Next reports `Cannot find module './787.js'` or a similar missing chunk:

```powershell
Remove-Item .next -Recurse -Force
npm.cmd run dev
```

Never delete `app`, `components`, `lib`, or `public`; `.next` is generated cache only.

## 4. Publish the frontend on Vercel

1. Create a GitHub repository and push this project. Do not commit `.env.local`, API keys, Stripe keys, database passwords, or private certificates.
2. Go to `https://vercel.com`, sign in, choose **Add New Project**, and import the GitHub repository.
3. Framework preset: Next.js. Build command: `next build`. Install command: `npm install`.
4. Add these Vercel environment variables:

```text
NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace_with_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=replace_with_service_role_key
STRIPE_SECRET_KEY=replace_with_live_or_test_key
ESEWA_SECRET_KEY=replace_with_merchant_secret
ESEWA_PRODUCT_CODE=EPAYTEST
KHALTI_SECRET_KEY=replace_with_merchant_secret
RESEND_API_KEY=replace_with_resend_api_key
RESEND_FROM_EMAIL=GENUM website <onboarding@resend.dev>
```

5. Deploy the project.
6. Open the Vercel deployment URL and test:
   - `/`
   - `/products`
   - `/products/esp32-bluetooth-robot-car`
   - `/3d-printing`
   - `/services`
   - `/training`
   - `/journal`
   - `/contact`
   - `/checkout`
   - `/robots.txt`
   - `/sitemap.xml`
7. Add the real domain in Vercel **Settings > Domains** and update `NEXT_PUBLIC_SITE_URL` to that domain. Redeploy after changing it.
8. In Google Search Console, add the domain property and submit `https://YOUR-DOMAIN.com/sitemap.xml`.

## 5. Supabase production setup

Products, homepage content, customer accounts, carts, orders, messages, and product images live in Supabase (Postgres + Auth + Storage). Without the env vars the storefront still runs from the bundled catalog in `lib/catalog.ts`.

1. Create a project at `https://supabase.com` (or use the existing one).
2. In the SQL Editor, run `supabase/schema.sql` once. It creates profiles, products, site content, orders, carts, messages, RLS policies, and storage rules. It is safe to re-run section by section.
3. Copy `Project Settings > API` values into `.env.local` locally and into Vercel environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` (bare project URL - do not append `/rest/v1/`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Seed the catalog: `npm run seed`.
5. Make yourself admin: sign up through `/login`, then run in the SQL Editor:

```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

6. Enable daily database backups (paid plans) under Database > Backups.
7. Keep email confirmation disabled or configure SMTP; the registration route expects immediate sessions.
8. Optional: enable Google login under Authentication > Providers; no code change is needed.

## 6. Payments: launch requirements

### Stripe

- Create a Stripe account and verify the business.
- Use test keys first.
- Add a Stripe webhook endpoint on the deployed backend.
- Verify payment events server-side before marking an order paid.
- Replace test keys with live keys only after a successful test order and refund test.
- Confirm that the settlement currency and NPR support match the Stripe account configuration.

### eSewa and Khalti

Both gateways are implemented: `/api/checkout/esewa` builds the signed ePay v2 form, `/api/checkout/khalti` initiates ePayment v2, and both confirm routes verify server-to-server before marking an order paid. Before launch:

- Obtain merchant credentials directly from eSewa and Khalti (UAT/test keys first).
- Set `ESEWA_SECRET_KEY`, `ESEWA_PRODUCT_CODE`, `ESEWA_BASE_URL`, `KHALTI_SECRET_KEY`, and `KHALTI_BASE_URL` locally and in Vercel.
- Test success, failure, cancellation, duplicate callback, and timeout cases.
- Switch to live credentials only after test orders pass end to end.

Never expose provider secrets in browser code. Do not advertise "payments live" until all callback verification paths pass.

## 7. Business data still required

### Contact email

The contact form sends inquiries to `genumsolutions@gmail.com` through Resend. Before local or production use:

1. Create a Resend account and generate an API key.
2. Copy `.env.example` to `.env.local` for local development.
3. Set `RESEND_API_KEY` to the key from Resend.
4. Set `RESEND_FROM_EMAIL` to a sender address verified in Resend. The example sender is suitable only for initial Resend testing.
5. Add the same variables in Vercel under **Project Settings > Environment Variables**.

The API key stays server-side. The visitor's address is used as `Reply-To`, so replies go directly back to the person who submitted the inquiry.

Replace placeholders before launch:

- Real business email instead of `hello@genumsolutions.com` if different
- Real business phone instead of `+977 9800000000`
- Verified product prices and stock
- Supplier, warranty, and return terms
- Shipping prices and delivery times by Nepal location
- Tax/VAT/PAN details if applicable
- Actual Stripe/eSewa/Khalti merchant accounts
- Real training dates, locations, seat limits, and instructors
- Portfolio images and project case-study facts
- Social media URLs for the JSON-LD `sameAs` field
- Privacy policy, terms, shipping, refund, and warranty pages

## 8. Important launch limitation

The frontend is a complete storefront: catalog, accounts, carts, orders, and three payment gateways with server-side verification. It is not fully production-ready until the real business credentials, legal policies, email notifications, inventory locking, and Stripe webhooks are connected.

Do not accept live payments while the order database and webhook confirmation flow are still placeholders.

## 9. Prompt to give Copilot

Copy and paste this into Copilot after opening the project:

> I am publishing the GENUM SOLUTIONS PVT. LTD. website in `E:\GENUM SOLUTIONS PVT LTD\genumsolutions-website`. It is a Next.js App Router storefront with Supabase (Postgres + Auth + Storage) as the backend. The official company address is `Shringhkhala Galli-32, Kathmandu, Nepal`. The official logo is `public/logo.png`. Please guide me step by step to: run `supabase/schema.sql` in the Supabase SQL Editor, seed products with `npm run seed`, create an admin account at `/login` and promote it via SQL, add the environment variables from `.env.example` in Vercel, deploy to Vercel, attach a custom domain, and submit the sitemap to Google Search Console. Do not invent credentials or mark payments live. Payments: Stripe, eSewa ePay v2, Khalti ePayment v2 - all verified server-side; I still need real merchant keys for eSewa and Khalti. Separate actions I can do now from actions requiring Stripe, eSewa, Khalti, domain, email, or hosting accounts. Check the current files before suggesting edits.

## 10. Final launch checklist

- [ ] `npm run build` passes
- [ ] No secrets committed to Git
- [ ] Vercel deployment works on the production domain
- [ ] `NEXT_PUBLIC_SITE_URL` matches the production domain
- [ ] Logo, favicon, metadata, Open Graph preview, robots, and sitemap work
- [ ] Address and contact details are verified
- [ ] Supabase schema applied and admin account promoted
- [ ] Product stock, prices, warranty, and delivery are verified
- [ ] Stripe test and refund flows pass
- [ ] eSewa and Khalti callbacks are verified server-side
- [ ] Order persistence and confirmation emails work
- [ ] Privacy, terms, refund, shipping, and warranty pages are published
- [ ] Mobile, desktop, keyboard, and accessibility checks pass
- [ ] Google Search Console and analytics are configured
