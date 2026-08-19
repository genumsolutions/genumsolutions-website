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
- Repository root: `e:\GENUM SOLUTIONS PVT LTD\Website`

## 2. What is already built

- Responsive homepage
- Shared route header and footer
- Standardized homepage and inner-page shell with one navigation and footer system
- Light/dim mode saved in browser storage
- Services page
- Product catalog with search and category filters
- Source-derived robotics catalog with 23 documented builds and 138 quote-based configurations from `my_COMPANY`
- Shared category imagery for every product card and product detail page
- Open-source Tools directory and embedded 3D model library
- Product detail pages
- Local persistent cart and checkout form
- Stripe checkout server route example
- eSewa/Khalti server adapter placeholder
- Training page
- Source-backed K–5 robotics pilot, STEM Master Package, teacher enablement, 100+ project curriculum highlights, and illustrative proposal costing
- Portfolio page
- Journal page
- Contact page
- Dedicated 3D-printing page
- 3D-printing products: PLA filament and printer care kit
- AI + IoT products clearly marked as coming soon/pre-order
- Strapi content-type schemas for products, services, blog, and training
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

Never delete `app`, `components`, `lib`, `public`, or `backend`; `.next` is generated cache only.

## 4. Publish the frontend on Vercel

1. Create a GitHub repository and push this project. Do not commit `.env.local`, API keys, Stripe keys, database passwords, or private certificates.
2. Go to `https://vercel.com`, sign in, choose **Add New Project**, and import the GitHub repository.
3. Framework preset: Next.js. Build command: `next build`. Install command: `npm install`.
4. Add these Vercel environment variables:

```text
NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN.com
NEXT_PUBLIC_STRAPI_URL=https://YOUR-STRAPI-DOMAIN.com
STRIPE_SECRET_KEY=replace_with_live_or_test_key
STRIPE_WEBHOOK_SECRET=replace_with_webhook_secret
ESEWA_SECRET_KEY=replace_with_merchant_secret
KHALTI_SECRET_KEY=replace_with_merchant_secret
```

5. Deploy the project.
6. Open the Vercel deployment URL and test:
   - `/`
   - `/products`
   - `/products/esp32-car`
   - `/3d-printing`
   - `/services`
   - `/training`
   - `/portfolio`
   - `/journal`
   - `/contact`
   - `/checkout`
   - `/robots.txt`
   - `/sitemap.xml`
7. Add the real domain in Vercel **Settings > Domains** and update `NEXT_PUBLIC_SITE_URL` to that domain. Redeploy after changing it.
8. In Google Search Console, add the domain property and submit `https://YOUR-DOMAIN.com/sitemap.xml`.

## 5. Strapi and PostgreSQL production setup

The `backend` folder contains schemas and setup notes, not a complete production Strapi installation yet.

1. Create a Strapi project in a separate backend repository or deploy directory:

```powershell
npx create-strapi-app@latest genum-cms --no-run
cd genum-cms
npm install
```

2. Copy the schema directories from this project’s `backend/src/api` into the Strapi project’s `src/api`.
3. Use managed PostgreSQL on DigitalOcean, AWS RDS, or another trusted provider.
4. Configure Strapi production environment variables for PostgreSQL, application keys, API tokens, and upload storage. Generate fresh secrets; never use sample values.
5. Run locally with `npm run develop`, create the first admin user, and verify Products, Services, Blog, and Training content types.
6. Configure roles:
   - Admin: full CMS access
   - Editor: manage products, services, blog, and training content
   - Customer: frontend account and order access only
7. Enable only the public read permissions required by the storefront. Keep create, update, delete, orders, and customer data protected.
8. Deploy Strapi to DigitalOcean App Platform, AWS, or a container host behind HTTPS.
9. Set `NEXT_PUBLIC_STRAPI_URL` in Vercel to the deployed Strapi URL and redeploy.
10. Test Strapi API responses before relying on CMS data. The frontend currently falls back to the local catalog when Strapi is missing or unavailable.

## 6. Payments: launch requirements

### Stripe

- Create a Stripe account and verify the business.
- Use test keys first.
- Add a Stripe webhook endpoint on the deployed backend.
- Verify payment events server-side before marking an order paid.
- Replace test keys with live keys only after a successful test order and refund test.
- Confirm that the settlement currency and NPR support match the Stripe account configuration.

### eSewa and Khalti

The current route is an adapter placeholder because the exact signing fields, merchant account, callback URL, and environment differ by provider and merchant agreement. Before launch:

- Obtain merchant credentials directly from eSewa and Khalti.
- Implement server-side request signing.
- Implement server-side callback verification.
- Store provider transaction IDs and order status.
- Test success, failure, cancellation, duplicate callback, and timeout cases.
- Never expose provider secrets in browser code.

Do not advertise "payments live" until all callback verification paths pass.

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

The frontend is publishable as a polished brochure/catalog prototype now. It is not yet a complete production commerce system until Strapi/PostgreSQL, authentication, order persistence, inventory locking, email notifications, payment webhooks, legal policies, and the real business credentials are connected.

Do not accept live payments while the order database and webhook confirmation flow are still placeholders.

## 9. Prompt to give Copilot

Copy and paste this into Copilot after opening the project:

> I am publishing the GENUM SOLUTIONS PVT. LTD. website in `e:\GENUM SOLUTIONS PVT LTD\Website`. It is a Next.js App Router storefront with Tailwind CSS. The official company address is `Shringhkhala Galli-32, Kathmandu, Nepal`. The official logo is `public/logo.png`. Please guide me step by step to deploy the frontend to Vercel, connect a production Strapi backend with PostgreSQL, configure the environment variables, attach a custom domain, submit the sitemap to Google Search Console, and run a complete production checklist. Do not invent credentials or mark payments live. Separate actions I can do now from actions requiring a Stripe, eSewa, Khalti, Strapi, PostgreSQL, domain, email, or hosting account. Check the current files before suggesting edits.

## 10. Final launch checklist

- [ ] `npm run build` passes
- [ ] No secrets committed to Git
- [ ] Vercel deployment works on the production domain
- [ ] `NEXT_PUBLIC_SITE_URL` matches the production domain
- [ ] Logo, favicon, metadata, Open Graph preview, robots, and sitemap work
- [ ] Address and contact details are verified
- [ ] Strapi admin and Editor roles are configured
- [ ] PostgreSQL backups are enabled
- [ ] Product stock, prices, warranty, and delivery are verified
- [ ] Stripe test and refund flows pass
- [ ] eSewa and Khalti callbacks are verified server-side
- [ ] Order persistence and confirmation emails work
- [ ] Privacy, terms, refund, shipping, and warranty pages are published
- [ ] Mobile, desktop, keyboard, and accessibility checks pass
- [ ] Google Search Console and analytics are configured
