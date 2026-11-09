# Genum Solutions Website — Architecture Documentation

## Overview

Next.js 14 (App Router, TypeScript) storefront for **GENUM SOLUTIONS PVT. LTD.** — robotics kits, electronics components, robot-car projects, 3D printing, AI/IoT project packages, and STEM training programs, built and shipped from Kathmandu, Nepal.

Live: https://genumsolutions-website.vercel.app

## Project Structure

```
website/
├── app/
│   ├── layout.tsx              # Root layout: fonts, metadata, CartProvider
│   ├── page.tsx                # Landing page (ISR, revalidate=300)
│   ├── products/               # Catalog + [slug] detail pages
│   ├── checkout/               # Cart review + success/verification page
│   ├── account/                # User account
│   ├── login/                  # Login page
│   ├── admin/                  # Admin dashboard
│   │   ├── page.tsx            # Admin dashboard overview
│   │   ├── settings/           # Company settings
│   │   ├── logs/               # Logs (3 sections)
│   │   ├── users/              # Users (3 sections)
│   │   ├── products/           # Product CRUD
│   │   ├── orders/             # Order management
│   │   ├── content/            # Content management
│   │   ├── projects/           # Project management
│   │   ├── 3d-printing/        # 3D products
│   │   └── activity/           # Activity tracking
│   ├── api/
│   │   ├── auth/               # Auth endpoints
│   │   ├── cart/               # Cart endpoints
│   │   ├── orders/             # Order endpoints
│   │   ├── checkout/           # Checkout endpoints
│   │   └── admin/              # Admin API endpoints
│   ├── privacy/, terms/        # Legal pages
├── components/
│   ├── SiteHeader/SiteFooter   # Navigation + footer
│   ├── cart-provider.tsx       # Cart state
│   ├── ProductCatalog/         # Product display
│   ├── ProductDetailPro/       # Product detail
│   ├── AdminPanel/             # Admin dashboard
│   ├── AuthPanel/              # Auth components
│   └── ...
├── lib/
│   ├── catalog.ts              # Product data
│   ├── content-store.ts        # Content store
│   ├── supabase/
│   │   ├── server.ts           # Server-side Supabase client
│   │   └── client.ts           # Client-side Supabase client
│   ├── orders.ts               # Order CRUD
│   ├── checkout.ts             # Checkout logic
│   ├── cart-client.ts          # Cart utilities
│   ├── company.ts              # Company identity
│   └── ...
├── supabase/
│   └── schema.sql              # Database schema (source of truth)
├── scripts/
│   ├── seed-products.ts
│   ├── create-admin.ts
│   ├── sync-app-fallback.mjs   # Sync app fallback
│   └── ...
├── middleware.ts               # Auth cookie refresh
├── tailwind.config.ts          # Tailwind config
└── next.config.mjs             # Next.js config
```

## Core Concepts

### 1. Framework Stack

| Layer                 | Technology                                                                           |
| --------------------- | ------------------------------------------------------------------------------------ |
| Framework             | Next.js 14.2 (App Router) + React 18 + TypeScript                                    |
| Styling               | Tailwind CSS (custom ink/navy/sky/mist/gold/line/border/surface/muted/accent tokens) |
| Database/Auth/Storage | Supabase (Postgres + Auth + Storage, cookie sessions via `@supabase/ssr`)            |
| Fonts                 | Inter + Sora via `next/font` (self-hosted)                                           |
| Payments              | eSewa ePay v2 · Khalti ePayment v2 · Cash on delivery                                |
| Email                 | Resend (contact form; optional)                                                      |
| Hosting               | Vercel                                                                               |

### 2. Navigation

Next.js App Router with page-based routing:

| Route                | Component                      | Description        |
| -------------------- | ------------------------------ | ------------------ |
| `/`                  | `app/page.tsx`                 | Landing page       |
| `/products`          | `app/products/`                | Product catalog    |
| `/products/[slug]`   | `app/products/[slug]/page.tsx` | Product detail     |
| `/checkout`          | `app/checkout/`                | Cart review        |
| `/account`           | `app/account/`                 | User account       |
| `/admin`             | `app/admin/`                   | Admin dashboard    |
| `/admin/settings`    | `app/admin/settings/`          | Company settings   |
| `/admin/users`       | `app/admin/users/`             | Users (3 sections) |
| `/admin/logs`        | `app/admin/logs/`              | Logs (3 sections)  |
| `/login`             | `app/login/`                   | Login              |
| `/reset-password`    | `app/reset-password/`          | Password reset     |
| `/privacy`, `/terms` | `app/privacy/`, `app/terms/`   | Legal              |

### 3. State Management

- **Client state**: React `useState`, `useEffect` across components
- **Cart state**: `cart-provider.tsx` (single source of truth)
- **Auth state**: Supabase cookie sessions (server-side)

### 4. Data Layer

**Server-side** (`lib/supabase/server.ts`):

- Cookie client for authenticated requests
- Service-role client for admin operations (bypasses RLS)

**Client-side** (`lib/supabase/client.ts`):

- Anon client for public data
- Auth sign-in/sign-up

**API routes** (`app/api/`):

- `auth/*` — Authentication endpoints
- `cart/*` — Cart CRUD
- `orders/*` — Order placement + status
- `checkout/*` — Payment gateway sessions
- `admin/*` — Admin CRUD operations

### 5. Admin Dashboard

See `docs/WEBSITE_ADMIN_COMPLETE.md` for complete admin UI documentation.

**9 tabs** in the admin dashboard, identical to the app except no Profile tab:

| Tab                 | Path                 | Description                                                  |
| ------------------- | -------------------- | ------------------------------------------------------------ |
| Dashboard           | `/admin`             | Main dashboard overview                                      |
| Orders              | `/admin/orders`      | Order management                                             |
| Electronic Products | `/admin/products`    | Product catalog                                              |
| 3D Products         | `/admin/3d-printing` | 3D printing catalog                                          |
| Projects            | `/admin/projects`    | Project packages                                             |
| Content             | `/admin/content`     | Services, journal, home copy                                 |
| Users               | `/admin/users`       | User directory + car profiles + robot profiles (3 sections)  |
| Logs                | `/admin/logs`        | System logs + user activity + fleet diagnostics (3 sections) |
| Settings            | `/admin/settings`    | Company info (17 fields) + training programs + pilot costs   |

### 6. Users Tab — 3 Sections (mirrored with app)

The **Users** tab (`AdminUsers.tsx`) has 3 sections:

1. **User Directory** (`UsersDirectory`) — Searchable user list with role/tier controls
2. **Car Profiles** (`CarProfilesSection`) — Per-car profiles with distinguished identity fields:
   - `profile_key` (stable: fw:boardId / BT MAC / wifi:uuid)
   - `car_name` (display name)
   - `unique_id` (unique identifier)
   - `settings` (JSON settings blob)
3. **Robot Profiles** (`RobotProfilesSection`) — Per-robot settings with robot_code, telemetry_channel, parameters

**Edit-button pattern** (all sections, mirrored with app):

- Read-only by default
- Tap "Edit" → form reveals
- Tap "Save" → persists and locks
- Tap "Cancel" → discards and returns to read-only

### 7. Mirror: Contact, Account, Services, Projects

The website already mirrors the app for these flows. No code changes needed.

#### Contact Page ↔ Contact Screen

| Element            | Website (`app/contact/page.tsx` + `ContactForm.tsx`)   | App (`ContactScreen.tsx`)                               | Shared                         |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------- | ------------------------------ |
| Contact details    | Company from Supabase `company_info` (cached fallback) | Company from Supabase `company_info` (bundled fallback) | Same `company_info` table      |
| Address            | Text shown                                             | Tap opens geo: URL                                      | Same company row               |
| Email              | Text shown                                             | Tap opens mailto: URL                                   | Same company row               |
| Phone              | Text shown                                             | Tap opens tel: URL                                      | Same company row               |
| WhatsApp           | Chat link via `whatsappLink()`                         | Chat link via `whatsappLink()`                          | Same `socials.ts` helper       |
| Socials            | Social links via `socialLinks()`                       | Social pill chips via `SocialsRow`                      | Same `company_info` row        |
| Inquiry form       | Client form (name/email/message) → `POST /api/contact` | Native form (name/email/message) → `POST /contact` edge | Same `customer_messages` table |
| Field limits       | name max 100, email max 254, message max 5000          | same limits enforced client-side                        | Same validation                |
| Email validation   | regex server-side                                      | regex client-side                                       | Same pattern                   |
| Status feedback    | in-form text, success/error                            | in-screen text, success/error                           | Same UX pattern                |
| Rate limiting      | 5 per minute per IP on /api/contact                    | Edge function rate limit                                | Both protected                 |
| Rate limit storage | In-memory (profile-services, single node)              | Edge function memory (single region)                    | Both single-node               |
| Legal links        | Footer links                                           | Privacy / Terms navigation                              | Same legal pages               |

#### Account Page ↔ Account Screen

| Element         | Website (`app/account/page.tsx` + `AccountPanel.tsx`)                 | App (`AccountScreen.tsx`)                                       | Shared                              |
| --------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| Auth gate       | AuthPanel if no session (probe `/api/auth/session` first)             | Redirect to sign-in if not signed in                            | Same Supabase auth                  |
| Header          | Avatar (initials) + name + email + tier + log out                     | Avatar (initials) + name + email + admin/staff badge + sign out | Same `profiles` table               |
| Stats (3 cards) | Orders / build-list items / support messages                          | Orders / build-list items / support messages                    | Same data sources                   |
| My collection   | MyCollection from `user_collection` (RLS own-rows)                    | Product cards from `user_collection` (RLS own-rows)             | Same `user_collection` table        |
| Your activity   | Habit counters (views/searches/cart_adds/orders) — hidden if all zero | Same habit counters — hidden if all zero                        | Same `user_habits` table            |
| Push settings   | PushNotificationSettings component                                    | (on Menu tab)                                                   | Same push subscription              |
| Robot prefs     | RobotPreferencesPanel                                                 | (on UserPreferencesScreen)                                      | Same robot settings                 |
| Car profiles    | CarProfilesPanel                                                      | (on UserPreferencesScreen)                                      | Same car profiles                   |
| Your orders     | Status pill + provider + total + line items                           | Status pill + provider + total + line items                     | Same `orders` table                 |
| Your details    | Edit profile (name/phone/address) form → PATCH /api/customer/profile  | Edit profile (name/phone/address) form → updateProfile()        | Same `profiles` table               |
| Your messages   | Support history with status pills                                     | Support history with status pills                               | Same `customer_messages` table      |
| Newsletter      | Email + consent checkbox + subscribe button                           | Email + consent checkbox + subscribe button                     | Same `newsletter_subscribers` table |

#### Services Page ↔ Services Screen

| Element           | Website (`app/services/page.tsx` + `ServicesGrid.tsx`)                                    | App (`ServicesScreen.tsx`)                                          | Shared                                     |
| ----------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------ |
| Data source       | Supabase `services` via `listServices()`                                                  | Supabase `services` via `getServices()`                             | Same `services` table                      |
| Fields            | id, name, category, priceLabel, description, tag, sortOrder, active, createdAt, updatedAt | id, name, category, priceLabel, description, tag, sortOrder, active | Same `Service` type (app omits timestamps) |
| Filter            | Category dropdown derived from DB rows                                                    | Category chips derived from DB rows                                 | Same categories                            |
| Search            | Text input, filters by name/description                                                   | Text input, filters by name/tag/id/description                      | Same search intent                         |
| Display           | ArticleCard with title + tag + description + priceLabel + quote link                      | Card with name + tag badge + description + priceLabel               | Same card data                             |
| Empty state       | "No services in this category"                                                            | "No services match your filters"                                    | Same empty handling                        |
| Pagination        | Load all server-side, filter client-side                                                  | PagePager (6 per page)                                              | Different impl, same data                  |
| Quote CTA         | "Request a quote" link to /contact                                                        | (none on list)                                                      | Same intent                                |
| Training programs | Training programs + pilot costs + STEM highlights section                                 | (not on services screen — admin tab only)                           | Website-only add-on                        |
| Process steps     | 4-step how-it-works section                                                               | (not on app)                                                        | Website-only add-on                        |

#### Projects Page ↔ Projects Screen

| Element      | Website (`app/projects/page.tsx` + `ProjectsCatalog.tsx`)                 | App (`ProjectsScreen.tsx`)                                                  | Shared                          |
| ------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------- |
| Data source  | Supabase `products` via `getManagedProducts()` + `applyScope("projects")` | Supabase `products` via `getProducts()` filtered to project packages + kits | Same `products` table           |
| Filter       | 6 project categories from `project_categories`                            | 6 project categories from `project_categories`                              | Same `project_categories` table |
| Search       | Text input, filters by name/note/description                              | Text input, filters by name/note/description                                | Same search intent              |
| Display      | 2-col grid on mobile, up to 5 at xl, ProductCard                          | 2-column grid, minimal ProductCard                                          | Same ProductCard component      |
| Empty state  | "No projects found matching your filters"                                 | "No projects found matching your filters"                                   | Same empty handling             |
| Pagination   | "See more" button + page indicator                                        | PagePager (8 per page)                                                      | Same pagination intent          |
| Coming soon  | Empty categories flagged                                                  | Empty categories flagged                                                    | Same UX                         |
| Include kits | `includeKits` prop re-adds Pre-packaged Kits                              | Pre-packaged Kits ride along (U-44)                                         | Same decision                   |
| Tools CTA    | "Test & control on the IoT Controller" link to /tools                     | (none)                                                                      | Website-only add-on             |

### 8. Product & Checkout Flow (mirrored with app)

#### Product Detail Page (`app/products/[slug]/page.tsx` + `ProductDetailPro`)

Mirrors the app's `ProductDetailScreen`:

- **Gallery**: contain-fit hero image + thumbnail strip
- **Header**: category badge + type badge, product name, note, description, price
- **Import meta card**: design by, license, source (link or text)
- **Info grid**: Price, SKU, Category, Stock, Supplier, Type
- **Audience/Warranty rows**
- **Color/Delivery rows**
- **Specs section**: bullet list of key:value specs
- **Project info** (Project packages): project overview, estimated duration, source folder, objectives, materials, learning outcomes, build steps, prerequisites, deliverables, maintenance notes, documentation/video links
- **Components used** (Project packages): horizontal cards with qty badges
- **Used in projects** (non-project): horizontal cards
- **Related products**: horizontal cards (same category → same type)
- **Add to cart**: qty stepper + Add to Cart button (sticky on mobile via cart provider)

#### Checkout Page (`app/checkout/page.tsx`)

Mirrors the app's `CheckoutScreen` with the same 3 payment methods:

- **Order summary**: items list (qty × name + line total) + Subtotal + Total
- **Delivery details form**: full name, email, phone, delivery address
- **Payment method buttons**: eSewa, Khalti, Pay on delivery
- **Sticky pay bar** (mobile): Total + eSewa + Khalti + Pay on delivery
- **Sign-in gate**: prompts to sign in before placing order
- **Newsletter opt-in**: consent checkbox beside order flow
- **Empty/unavailable states**: items no longer available, empty build list

#### Payment methods (identical across both):

| Method           | App                                            | Website                                          | Shared                    |
| ---------------- | ---------------------------------------------- | ------------------------------------------------ | ------------------------- |
| Cash on delivery | `createOrder({provider:'cod'})` → OrderSuccess | `POST /api/orders` → success page                | Both write `orders` table |
| eSewa            | `initiateEsewaPayment` → WebBrowser → confirm  | `POST /api/checkout/esewa` → form → confirm      | Both use eSewa v2         |
| Khalti           | `initiateKhaltiPayment` → WebBrowser → confirm | `POST /api/checkout/khalti` → redirect → confirm | Both use Khalti v2        |

Both re-price server-side, confirm server-to-server, write to immutable `transactions` ledger, and are idempotent.

### 9. Responsive Design

The website uses Tailwind CSS with responsive prefixes (`sm:`):

- `sm:` for small screens and up — layout changes from vertical stack to side-by-side
- `flex-col sm:flex-row` — vertical on mobile, horizontal on desktop
- `w-full sm:w-64` — full width on mobile, fixed width on desktop
- `sm:flex-row sm:items-center sm:justify-between` — action cluster stacks on mobile, side-by-side on desktop

**Mobile-first approach:**

- Mobile: stacked layout, full-width buttons
- Desktop: side-by-side layout, auto-width action clusters

### 10. Company Info (17 fields, mirrored with app)

```typescript
// lib/company.ts
export type Company = {
  name: string;
  shortName: string;
  url: string; // Website URL
  address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  pan: string;
  vatLabel: string;
  description: string;
  whatsappNumber: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
};
// 17 fields total
```

**Note on app parity:** The app's `src/config/company.ts` uses a 12-field subset. The app intentionally omits `url`, `city`, `country`, `vatLabel`, and `description` because it doesn't need them (offline fallback, no web URL display). The website's 17-field type is the source of truth; the app's 12-field type is a deliberate subset. See `APP_WEBSITE_UI_COMPARISON.md` Section 13 for the full comparison.

### 11. Payments

Safe pattern: order saved `pending` server-side, prices re-checked against database, payment confirmed only after server-to-server verification.

| Provider         | Start                                    | Confirm                                                                             |
| ---------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| eSewa v2         | `POST /api/checkout/esewa` → signed form | `GET /api/orders/confirm/esewa?data=…` → status API must say `COMPLETE`             |
| Khalti v2        | `POST /api/checkout/khalti` → redirect   | `GET /api/orders/confirm/khalti?pidx=…` → lookup must say `Completed` + paisa match |
| Cash on delivery | `POST /api/orders` (`provider: 'cod'`)   | marked when admin fulfils                                                           |

**Sandbox testing checklist:**

1. eSewa UAT (`EPAYTEST`) with developer.esewa.com.np docs pair
2. Khalti test keys from dashboard.khalti.com
3. COD flow: order saves as `pending`, buyer's cart empties, admin sees in `/admin`
4. For each method: verify `pending → paid`, `transactions` row appears, double-fire does not duplicate

### 12. Security & Compliance

- **Authentication & RBAC** — Supabase Auth (email/password + Google OAuth, PKCE). Admin = `profiles.role = 'admin'`.
- **Row Level Security** — all tables ship with RLS policies in `supabase/schema.sql`.
- **Secrets** — all credentials in environment variables (Vercel + `.env.local`, gitignored).
- **HTTPS & headers** — Vercel TLS; `next.config.mjs` sets HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Payment safety** — prices re-priced server-side, gateways confirmed server-to-server, events append to immutable `transactions` ledger, idempotent confirm endpoints.
- **CSRF** — auth/session cookies are SameSite.
- **Audit logging** — product/order/user/service mutations write to `activity_log`.
- **Input handling** — Supabase queries parameterized; admin CRUD validates required fields, numeric bounds, length caps, slug-formatted ids.

### 13. App-Version Contract (sibling `genumsolutions-app` repo)

- The Android app (Expo) ships its own UI and shares only the Supabase **database** with this site.
- `/app` reads the **live** `release.json` manifest from the shared `app-releases` bucket.
- `lib/company.ts` → `androidApp` is the **bundled fallback** shown when manifest is unreachable.
- Version pins that must move **together**: `mobile/app.json` ↔ `mobile/src/config/site.ts` ↔ git tag.

### 14. Deployment (Vercel)

1. Push repo to GitHub and import in Vercel (framework auto-detected as Next.js).
2. Add every environment variable (Production + Preview).
3. Set `NEXT_PUBLIC_SITE_URL` to the final domain **before** testing payments.
4. Redeploy once after adding env vars.
5. Update Supabase Site URL + redirect URLs to match live domain.
6. Post-deploy smoke test: browse catalog, add to cart, sign in, place COD order, check `/admin`, run one sandbox payment per gateway.

## Environment Variables

| Variable                                                   | Notes                                                            |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                     | `http://localhost:3000` locally; production domain in production |
| `NEXT_PUBLIC_SUPABASE_URL`                                 | Bare project URL (no `/rest/v1/` suffix)                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                            | Public anon key — safe for browser                               |
| `SUPABASE_SERVICE_ROLE_KEY`                                | **Server-only secret.** Never `NEXT_PUBLIC_`.                    |
| `CONTACT_EMAIL`                                            | Where contact-form mail lands                                    |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                      | Optional — contact form degrades without them                    |
| `ESEWA_PRODUCT_CODE`, `ESEWA_SECRET_KEY`, `ESEWA_BASE_URL` | UAT: code `EPAYTEST`, base `https://uat.esewa.com.np`            |
| `KHALTI_SECRET_KEY`, `KHALTI_BASE_URL`                     | Test keys + `https://a.khalti.com/api/v2`                        |

Without Supabase vars the site still renders from the bundled catalog in `lib/catalog.ts`.

## File Structure Summary

```
app/                          # Next.js App Router pages
  layout.tsx                  # Root layout
  page.tsx                    # Landing page
  products/                   # Catalog
  checkout/                   # Checkout flow
  account/, login/, admin/    # Auth + admin
  api/                        # API routes
components/                   # React components
  SiteHeader/SiteFooter       # Navigation
  cart-provider.tsx           # Cart state
  ProductCatalog/             # Product display
  AdminPanel/                 # Admin dashboard
lib/                          # Business logic
  catalog.ts                  # Product data
  supabase/                   # Supabase clients
  orders.ts                   # Order CRUD
  checkout.ts                 # Checkout logic
supabase/                     # Database schema
  schema.sql                  # Source of truth
scripts/                       # Utility scripts
middleware.ts                 # Auth cookie refresh
tailwind.config.ts            # Tailwind config
next.config.mjs               # Next.js config
```

## Test Status

- **301 vitest tests** across 24 files — all passing
- **TypeScript `tsc --noEmit`** — 0 errors
- **Build** — `npm run build` passes
- **Admin parity tests** — enforce identical tab structure with app
- **Contact/account/services/projects parity**: all 4 pages mirror app equivalents — documented in section 7

## Documentation Deliverables

- `docs/WEBSITE_ADMIN_COMPLETE.md` — Complete admin UI documentation
- `docs/ADMIN_UI_BLUEPRINT.md` — Admin UI blueprint
- `docs/WEBSITE_ARCHITECTURE.md` — This file (website architecture overview)
- `docs/APP_WEBSITE_UI_COMPARISON.md` — App vs website comparison
- `docs/ADMIN_COHERENCE.md` — Admin contract with app
- `docs/STORAGE_BUDGET.md` — Free-tier limits, image budget

---

_Documentation generated: 2026-11-09_
