# GENUM SOLUTIONS website

Next.js 14 (App Router, TypeScript) storefront for **GENUM SOLUTIONS PVT. LTD.** — robotics kits, electronics components, robot-car projects, 3D printing, AI/IoT project packages, and STEM training programs, built and shipped from Kathmandu, Nepal.

Live: https://genumsolutions-website.vercel.app · PAN 623676190

## Project overview

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2 (App Router) + React 18 + TypeScript |
| Styling | Tailwind CSS (custom `ink/cobalt/signal/mist/line/sky` tokens) |
| Database/Auth/Storage | Supabase (Postgres + Auth + Storage, cookie sessions via `@supabase/ssr`) |
| Fonts | Manrope + Space Grotesk via `next/font` (self-hosted) |
| Payments | eSewa ePay v2 · Khalti ePayment v2 · Cash on delivery |
| Email | Resend (contact form; optional) |
| Hosting | Vercel |

### Key features
- Catalog with category filters, search, quote-only project packages, and stock-aware cart.
- Cart persisted to **localStorage** for guests and **Supabase (`carts` table)** for signed-in users; quantities are clamped to live stock server-side on every save (replace semantics — no double counting).
- Checkout with four payment flows; every payment event is written to an append-only **`transactions`** ledger.
- Admin dashboard at `/admin` (session + `profiles.role = 'admin'` protected) with product CRUD, order status management, user role management, search, and pagination.
- SEO: per-page metadata/OpenGraph, `sitemap.xml`, `robots.txt`, Organization JSON-LD, static prerendering with ISR.

## Hardware & software requirements

### Software (development machine)
- Node.js ≥ 18.17 (LTS recommended) and npm ≥ 9
- A Supabase project (free tier is enough)
- Optional: Vercel CLI

### Hardware (products documented in this repo)
The GENUM robot-car line covers 10 modes (see `INVENTORY/ADMIN/robo car/Multimode_Robotic_Car_Complete_Documentation.docx`). Common bill of materials:

- **Chassis:** 2WD chassis + 2 DC gear motors (+ caster wheel), or omni-directional chassis ×4 motors
- **Controllers:** Arduino UNO (classic modes) or ESP32 / ESP32-CAM (WiFi/Camera modes)
- **Motor driver:** L298N (or TB6612FNG for the omni build)
- **Sensors:** IR sensors ×2–4, HC-SR04 ultrasonic, ADXL335 accelerometer, microphone module, NEO-6M GPS
- **Comms:** HC-05/HC-06 Bluetooth, ESP32 WiFi (built-in)
- **Power:** 7.4 V Li-ion pack or 9 V battery; solar panel on the Solar Rover
- **Misc:** jumper wires, breadboard, screws/nuts, wheels

### Robo-car pin mapping (latest, Arduino UNO example used across all modes)

| Component | Pin |
|---|---|
| IR Sensor 1 | D2 |
| IR Sensor 2 | D4 |
| Ultrasonic Trigger | D5 |
| Ultrasonic Echo | D6 |
| Motor Driver IN1 | D7 |
| Motor Driver IN2 | D8 |
| Motor Driver IN3 | D9 |
| Motor Driver IN4 | D10 |

ESP32 builds use the same logical layout mapped to ESP32 GPIOs; OLED display rides I²C (SDA/SCL). Modes supported per model: WiFi (Remote/Autonomous/Web UI), Bluetooth (Manual/BT/Autonomous), Gesture, Line Follower, Obstacle Avoidance, Voice, GPS Navigation, Solar, Camera Vision, Omni-Wheel.

## File structure

```
app/
  layout.tsx              Root layout: fonts, metadata, CartProvider
  page.tsx                Landing page (ISR, revalidate=300)
  products/               Catalog + [slug] detail pages
  checkout/               Cart review + success/verification page
  account/, login/, admin/, reset-password/
  privacy/, terms/        Legal pages
  api/
    auth/{login,register,logout,reset,google,session,update-password}
    auth/callback         PKCE + email-link handler (/auth/callback route lives at app/auth/callback)
    cart                  GET read · PUT replace-with-stock-clamp
    orders                COD placement + user order list
    orders/confirm*       Server-side verification (eSewa/Khalti)
    checkout/{esewa,khalti}   Gateway session creation
    admin/{products,orders,users,content,upload}   Admin APIs (all admin-guarded)
components/
  SiteHeader/SiteFooter   Nav (active routes, hamburger) + footer (PAN, legal links)
  cart-provider.tsx       Single source of truth for cart state
  ProductCatalog/ProductDetailPro/AdminPanel/AuthPanel/...
lib/
  catalog.ts, content-store.ts   Product data (DB w/ bundled fallback)
  supabase/server.ts      Cookie client + service-role client (server only!)
  orders.ts               Order CRUD + transaction ledger helpers
  checkout.ts             Server-side re-pricing (never trusts client prices)
  cart-client.ts          localStorage read/write/merge utilities
  company.ts              Company identity (name, address, PAN, contacts)
supabase/schema.sql       Tables, RLS policies, storage bucket, triggers
scripts/                  seed-products.ts, create-admin.ts
middleware.ts             Refreshes Supabase auth cookies on every request
```

## Run locally

```powershell
npm install
copy .env.example .env.local   # then fill in the values (see below)
npm run dev
```

Open http://localhost:3000. Production check before deploying:

```powershell
npm run build
npm run start
```

Type/lint gates: `.\node_modules\.bin\tsc.cmd --noEmit` and `npm run lint`.

## Environment variables

Copy `.env.example` → `.env.local`; add the same keys in Vercel → Project → Settings → Environment Variables:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; `https://genumsolutions-website.vercel.app` (or your domain) in production. Used for all gateway callbacks. |
| `NEXT_PUBLIC_SUPABASE_URL` | Bare project URL from Supabase → Settings → API (no `/rest/v1/` suffix). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key — safe for the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only secret.** Bypasses RLS. Never prefix with `NEXT_PUBLIC_`, never commit. |
| `CONTACT_EMAIL` | Where contact-form mail lands. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Optional — contact form degrades gracefully without them. |
| `ESEWA_PRODUCT_CODE`, `ESEWA_SECRET_KEY`, `ESEWA_BASE_URL` | UAT: code `EPAYTEST`, base `https://uat.esewa.com.np`. |
| `KHALTI_SECRET_KEY`, `KHALTI_BASE_URL` | Test keys + `https://a.khalti.com/api/v2`. |

Without Supabase vars the site still renders from the bundled catalog in `lib/catalog.ts`.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (region: Mumbai or Singapore).
2. SQL Editor → run **the whole of `supabase/schema.sql`**. It creates: `profiles` (+ signup trigger + role-change protection), `products`, `site_content`, `carts`, `orders`, `customer_messages`, **`transactions`** (append-only payment ledger), RLS policies for admin vs customer, the `product-images` storage bucket, and the `set_admin()` helper.
3. Copy URL/anon/service keys into `.env.local`.
4. Seed the catalog: `npm run seed`.
5. Authentication → Providers → Email: keep "Confirm email" OFF until SMTP is configured.
6. Google sign-in: Authentication → Providers → Google → enable with an OAuth client from Google Cloud Console (authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`).

### Auth redirect URLs (Supabase → Authentication → URL Configuration)

| Setting | Value |
|---|---|
| Site URL | `https://genumsolutions-website.vercel.app` |
| Additional redirect URLs | `https://genumsolutions-website.vercel.app/**`, `http://localhost:3000/**` |

Password recovery and signup emails must land users on `<site>/auth/callback` (set "Reset password" email template link accordingly). The callback exchanges the PKCE code, then forwards to `/reset-password` or your `?next=` path. Open redirects are blocked (relative paths only).

### Roles

Admin = any signed-in user whose `profiles.role = 'admin'`. Promote yourself:

```sql
select public.set_admin('you@example.com');
-- or: npx tsx scripts/create-admin.ts you@example.com <password>
```

Users can also be promoted/demoted from `/admin` → Users tab (service-role backed, audit-friendly).

## Payments

Safe pattern everywhere: the order is saved `pending` server-side, prices are **re-checked against the database**, and payment is confirmed only after a server-to-server verification call. Every initiation/success/failure is appended to `transactions`.

| Provider | Start | Confirm |
|---|---|---|
| eSewa v2 | `POST /api/checkout/esewa` → signed form | `GET /api/orders/confirm/esewa?data=…` → status API must say `COMPLETE` |
| Khalti v2 | `POST /api/checkout/khalti` → redirect | `GET /api/orders/confirm/khalti?pidx=…` → lookup must say `Completed` + paisa match |
| Cash on delivery | `POST /api/orders` (`provider: 'cod'`) | marked when admin fulfils |

**Sandbox testing checklist (do this before production keys):**
1. eSewa UAT (`EPAYTEST`) with the mobile number/password pair from developer.esewa.com.np docs.
2. Khalti test keys from dashboard.khalti.com (test user).
3. COD flow: order saves as `pending`, buyer's cart empties, admin sees it in `/admin`.
4. For each payment method: verify order flips `pending → paid`, a row appears in `transactions`, and double-firing confirm does not duplicate rows.

## Deployment (Vercel)

1. Push this repo to GitHub/GitLab and import it in Vercel (framework auto-detected as Next.js; no build overrides needed).
2. Add every variable from the environment table above (Production + Preview).
3. Set `NEXT_PUBLIC_SITE_URL` to the final domain **before** testing payments — all gateway return URLs derive from it.
4. Redeploy once after adding env vars.
5. Update Supabase Site URL + redirect URLs to match the live domain (table above).
6. Post-deploy smoke test: browse catalog, add to cart (guest), sign in (cart merges), place a COD order, check `/admin` lists it, then run one sandbox payment per gateway.

## Daily operations

- **Products/content/images:** manage everything in `/admin` — changes go straight to Postgres and are live immediately.
- **Orders:** customers track status in `/account`; admins update statuses in `/admin` → Orders.
- **Payments ledger:** query `public.transactions` in the Supabase dashboard (admins can also read it via RLS).

## Validation

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
npm.cmd run lint
npm.cmd run build && npm.cmd run start
```
