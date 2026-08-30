# GENUM Solutions - Comprehensive Project Documentation
## "IoT & Remote Controller Platform: Website & Mobile App"

## Table of Contents

| Chapter | Title | Page |
|---------|-------|------|
| 1 | [Project Overview](#1-project-overview) | 3 |
| 2 | [Website Structure](#2-website-structure) | 5 |
| 3 | [Mobile Application](#3-mobile-application) | 12 |
| 4 | [IoT & Remote Controller System](#4-iot--remote-controller-system) | 15 |
| 5 | [Product Catalog & Projects](#5-product-catalog--projects) | 18 |
| 6 | [Download & App Distribution](#6-download--app-distribution) | 22 |
| 7 | [Navigation & Routing](#7-navigation--routing) | 25 |
| 8 | [Recent Refactoring Changes](#8-recent-refactoring-changes) | 28 |

---

## 1. Project Overview

### 1.1 Introduction
GENUM Solutions is a full-stack IoT platform based in Kathmandu, Nepal, offering robotics, electronics, AI, IoT, 3D printing, and practical technology training. The platform consists of two main components:

- **Website** (Next.js 14 with App Router) - The central hub for project catalog, IoT control, and documentation
- **Mobile Application** (Expo SDK 54 + React Native) - Native shell mirroring the website experience with added BLE capabilities

### 1.2 Architecture
```
Website (Next.js)          Mobile App (Expo)
━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━
• app/                     • mobile/src/
• pages/                   • screens/
• components/             • services/
• lib/                     • config/
```

### 1.3 Primary Functions
- IoT device control (BLE & WiFi)
- Project package catalog
- Robot car builds and control
- Third-party tools directory
- Android app distribution (APK)
- Customer support & information

---

## 2. Website Structure

### 2.1 Routing (App Router)
The website uses Next.js file-based routing under `app/` directory:

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/layout.tsx` / `page.tsx` | Home page |
| `/about` | `app/about/page.tsx` | About us |
| `/services` | `app/services/page.tsx` | Services & training |
| `/products` | `app/products/page.tsx` | Product listings |
| `/projects` | `app/projects/page.tsx` | Project packages & robot cars |
| `/iot-remote` | `app/iot-remote/page.tsx` | **Now embedded in /tools** |
| `/tools` | `app/tools/page.tsx` | **IoT & Remote Controller + OpenTools** |
| `/app` | `app/app/page.tsx` | Download Android app |
| `/drones` | `app/[slug]/page.tsx` | Dynamic category page |
| `/smart-farm` | `app/[slug]/page.tsx` | Dynamic category page |
| `/smart-city` | `app/[slug]/page.tsx` | Dynamic category page |
| `/home-automation` | `app/[slug]/page.tsx` | Dynamic category page |
| `/3d-printing` | `app/3d-printing/page.tsx` | 3D printing resources |
| `/journal` | `app/journal/page.tsx` | Journal/blog |
| `/contact` | `app/contact/page.tsx` | Contact form |
| `/checkout` | `app/checkout/page.tsx` | Purchase flow |
| `/privacy` | `app/privacy/page.tsx` | Privacy policy |
| `/terms` | `app/terms/page.tsx` | Terms of service |

### 2.2 Key Pages Refactored

#### 2.2.1 `/tools` Page (CORE PAGE)
**Location:** `app/tools/page.tsx`
**Status:** **MAJOR REFactor** - IoT & Remote Controller now EMBEDDED

**Before:** IoT & Remote Controller section linked out to `/iot-remote`
**After:** IoT & Remote Controller component embedded directly in the Tools page

**Structure:**
```
PageShell
├── PageIntro (eyebrow: "Tools · open source")
├── IotRemote (category selector + control panels)
└── OpenTools (third-party tools directory)
```

**IoT Categories (from project-catalog.ts):**
- `robocar` - Robo Car with joystick control
- `home-automation` - Lights, relays, sensors
- `smart-farm` - Irrigation and soil monitoring
- `smart-city` - Street lighting, parking, environment
- `drones` - Flight controllers and telemetry

#### 2.2.2 Dynamic Category Pages
**Location:** `app/[slug]/page.tsx` (NEW - replaces 4 duplicate files)
**Status:** **Consolidated** - Single source of truth

**Replaced Files (deleted):**
- `app/drones/page.tsx` → Now via `[slug]` route
- `app/smart-city/page.tsx` → Now via `[slug]` route
- `app/smart-farm/page.tsx` → Now via `[slug]` route
- `app/home-automation/page.tsx` → Now via `[slug]` route

**How It Works:**
- URL `/smart-farm` renders `app/[slug]/page.tsx` with slug="smart-farm"
- Fetches category data from `lib/project-catalog.ts`
- Renders `CategoryPage` component with hardware lists, points, etc.
- Metadata (title/description) generated dynamically from catalog

#### 2.2.3 `/projects` Page
**Location:** `app/projects/page.tsx`
**Enhancement:** Added download app section at the very bottom

**Structure:**
- Tabbed interface: "Project Packages" + "Robot Car Projects"
- Product filtering and search
- **NEW:** Download GENUM App banner at bottom
- Links to `/app` for full APK download

#### 2.2.4 `/app` Page (Download)
**Location:** `app/app/page.tsx`
**Full Android app download page** with:
- App version: 1.4.1
- File size: 29 MB
- Architecture: Android · 64-bit
- APK download link via Supabase storage
- Three-step setup instructions
- Release notes and system requirements

### 2.3 Navigation Components

#### 2.3.1 SiteHeader
**Location:** `components/SiteHeader.tsx`
**Primary navigation links:**
- About, Services, Products, Projects
- **IoT & Remote → /tools** (changed from /iot-remote)
- Tools, App, 3D Printing, Journal, Contact

#### 2.3.2 SiteFooter
**Location:** `components/SiteFooter.tsx`
**Shop/Explore links:**
- Services & Training, Shop, 3D Printing, **Tools**, IoT & Remote Controller → /tools, Projects

#### 2.3.3 CategoryPage
**Location:** `components/CategoryPage.tsx`
**Shows category details** with:
- Eyebrow, title, description
- "What you can build" points
- "Typical hardware" list
- **NEW:** "Test & control this category" → /tools link

---

## 3. Mobile Application

### 3.1 Architecture
The mobile app is a **WebView mirror** of the website (per `AGENTS.md`):

```
WebView loads: https://genumsolutions-website.vercel.app
Native additions:
- BLE auto-connect via roboCarBridge
- Native device catalog (deviceCatalog)
- Quick controls (LED, headlights, motor speed)
- Tools screen (IoT demo panel)
```

### 3.2 Key Screens

#### 3.2.1 ToolsScreen
**Location:** `mobile/src/screens/ToolsScreen.tsx`
**Status:** **CLEANED** - Removed robocar navigation

**Before:** Had "Robo Car Control" button navigating to `/robocar` (non-existent route)
**After:** Removed; IoT & Remote Controller now inside website's `/tools` page

**Current Features:**
- Device discovery (demo devices placeholder)
- Connection status indicator
- Quick controls: Built-in LED, Headlights, Motor speed
- **Removed:** Robo Car launcher (now accessed via website /tools)

#### 3.2.2 IotRemoteScreen
**Location:** `mobile/src/screens/IotRemoteScreen.tsx`
**Mirrors:** Website `/iot-remote` page inside WebView

**Features:**
- Category selector (Robo Car, Home Automation, Smart Farm, Smart City, Drones)
- WebView mirroring `https://genumsolutions-website.vercel.app/iot-remote`
- Native BLE auto-connect on mount
- Message bridging between native and web
- Progress bar during navigation

#### 3.2.3 SiteScreen
**Location:** `mobile/src/screens/SiteScreen.tsx`
**Full WebView** of the entire website within the native app shell.

### 3.3 Configuration
**Location:** `mobile/src/config/site.ts`
**Contains:**
- `WEBSITE_URL`: Primary website URL
- `APP_VERSION`: Version string (e.g., "1.4.1")
- Google OAuth configuration (note: doesn't work in embedded WebView)

---

## 4. IoT & Remote Controller System

### 4.1 Core Component
**Location:** `app/iot-remote/page.tsx` (still exists but now only used internally)

**Purpose:** The "test & play" surface for GENUM device control

**How It Works:**
1. Category selector on left/top
2. Selected project's control panel renders below
3. All categories share the same GENUM command protocol
4. Now embedded INSIDE `/tools` page (not standalone access point)

### 4.2 Category Control Panel
**Location:** `components/CategoryControlPanel.tsx`
**Shared component** used by all IoT categories (except Robo Car)

**Capabilities supported:**
- `directional` - F/B/L/R + speed (drives)
- `servo` - Steering servo control
- `pid` - PID tuning + live angle
- `start-stop` - Autonomous run/stop
- `relay` - On/off relay/switch outputs
- `sensor` - Live sensor readout
- `weblink` - Client/server ESP link
- `slider` - Arbitrary 0..n control (e.g., speed/threshold)

### 4.3 Project Catalog (Single Source of Truth)
**Location:** `lib/project-catalog.ts`
**Defines the 5 controller categories:**

| Slug | Name | Hardware | Capabilities |
|------|------|----------|-------------|
| `robocar` | Robo Car | ESP32, BO/brushed motors, Servo, MPU6050, HC-SR04/IR | directional, servo, pid, start-stop, weblink, slider |
| `home-automation` | Home Automation | ESP32/ESP8266, Relay modules, DHT/BME sensors, IR & motion | relay, sensor, slider |
| `smart-farm` | Smart Farm | ESP32, Soil moisture sensors, Water pumps/solenoids, Relays & PSUs | relay, sensor, slider |
| `smart-city` | Smart City | ESP32, Ambient air sensors, Ultrasonic/IR, NeoPixel/LED arrays | relay, sensor, slider |
| `drones` | Drones & Aerial | ESP32/STM32, Flight cameras, ESC + brushless motors, GPS & IMU | sensor, slider |

### 4.4 Command Protocol
- All categories use the same GENUM command format
- BLE or WiFi transport
- WebView mirrors control panels from website
- Mobile app provides native BLE auto-connect

---

## 5. Product Catalog & Projects

### 5.1 Product Data Structure
**Location:** `lib/catalog.ts`
**Product type with 30+ fields:**
- id, name, category, price, priceLabel, sku
- productType: 'Retail kit' | 'Project package' | 'Material' | 'Service package'
- description, specs, audience, difficulty
- warranty, stock, delivery, color, badge, supplier, image

### 5.2 Product Arrays (5 arrays, 87+ products total)

| Array | Count | Description |
|-------|-------|-------------|
| `inventoryProducts` | 23 | Core retail kits (Arduino, ESP32, motors, sensors) |
| `additionalInventoryProducts` | 22 | Quote inventory items ("Request quote" pricing) |
| `quotationProducts` | Varies | Quotation inventory items |
| `robotCarProducts` | 3 | Robot car builds (Arduino Multimode, ESP32 Bluetooth, ESP32 Wi-Fi) |
| `projectProducts` | 37 | Excel project packages |

### 5.3 Projects Page
**Location:** `app/projects/page.tsx`
**Features:**
- Two tabs: "Project Packages" + "Robot Car Projects"
- Product filtering by category, search, pagination
- Out-of-stock handling (shows "View details" vs "Add to cart")
- **NEW:** Download app section at bottom
- Product detail pages at `/products/${product.id}`

### 5.4 Product Display
**Component:** `components/ProjectsCatalog`
**Renders product cards with:**
- Image, name, category, price
- Stock status indicator
- Add to cart / View details buttons
- Category filtering

---

## 6. Download & App Distribution

### 6.1 Android App Download Page
**Location:** `app/app/page.tsx`
**Full page at route `/app`**

**Contents:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENUM MOBILE APP
Version 1.4.1 · 29 MB · Android · 64-bit
━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Download APK] button
  → Links to: https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/genum-solutions-latest.apk

Setup instructions:
1. Download APK
2. Allow unknown sources (Settings → Security)
3. Install & open

[View release notes & system requirements] link

Contact information and release manifest link
```

### 6.2 App Banner (Mobile)
**Location:** `components/AppBanner.tsx`
**Sticky bottom banner** features:
- "Get the GENUM app" or "Update available"
- Records download attempts in localStorage
- Auto-hides after 20 hours for returning visitors
- Always reachable from footer/`/app` page

### 6.3 Website Footer Link
**Location:** `components/SiteFooter.tsx` line 16
```
{ href: '/app', label: 'Download app' }
```
**Persistent link** in footer for easy access.

---

## 7. Navigation & Routing

### 7.1 Route Summary (All Website Routes)

```
Root Routes:
/                          - Home
/about                     - About us
/services                  - Services & training
/products                  - Product listings
/projects                  - Project packages & robot cars
/tools                     - IoT & Remote Controller + OpenTools
/app                       - Download Android app
/journal                   - Journal/blog
/contact                   - Contact form
/checkout                  - Purchase flow
/privacy                   - Privacy policy
/terms                     - Terms of service

Dynamic Routes (via [slug]):
/[slug]                    - Category pages (drones, smart-farm, smart-city, home-automation)
/products/${id}           - Product detail page

Redirects (next.config.mjs):
/robocar  →  /tools        (permanent redirect)
/robot-cars  →  /projects
/training  →  /services#training
/products/esp32-car  →  /products/esp32-bluetooth-robot-car
```

### 7.2 Navigation Flow

**User Journey: IoT Control**
1. Click "IoT & Remote" in header → `/tools`
2. Or click "Tools" in footer → `/tools`
3. Or click "Open IoT & Remote Controller" on projects page → `/tools`
4. IoT category selector appears (Robo Car, Home Automation, etc.)
5. Select category → Control panel renders
6. Connect BLE/WiFi device and control

**User Journey: Download App**
1. Click "Download app" in footer → `/app`
2. Or see banner at bottom of projects page → `/app`
3. Full APK download page with instructions

**User Journey: Category Information**
1. Browse products or projects
2. Click "Test & control this category" → `/tools`
3. Category page renders with description and hardware list
4. IoT controls available within `/tools`

---

## 8. Recent Refactoring Changes (Completed)

### 8.1 IoT Integration into Tools Page
**Status:** ✅ Complete
- `/tools` page now embeds `IotRemote` component
- Removed standalone `/iot-remote` as primary entry point
- All navigation unified under `/tools`

**Files Modified:**
- `app/tools/page.tsx` - Added IotRemote import and rendering
- `components/SiteHeader.tsx` - Link /iot-remote → /tools
- `components/SiteFooter.tsx` - Link /iot-remote → /tools
- `app/projects/page.tsx` - Link /iot-remote → /tools
- `components/CategoryPage.tsx` - Link /iot-remote → /tools
- `next.config.mjs` - /robocar redirect → /tools
- `public/sw.js` - Removed /iot-remote from precache
- `app/sitemap.ts` - Removed /iot-remote from sitemap

### 8.2 Category Page Consolidation
**Status:** ✅ Complete
- 4 duplicate category description files deleted
- Single dynamic `[slug]/page.tsx` route created
- All categories read from `lib/project-catalog.ts`

**Files Deleted:**
- `app/drones/page.tsx`
- `app/home-automation/page.tsx`
- `app/smart-city/page.tsx`
- `app/smart-farm/page.tsx`

**Files Created:**
- `app/[slug]/page.tsx` - Dynamic category page

### 8.3 Mobile App Cleanup
**Status:** ✅ Complete
- Removed robocar navigation from ToolsScreen
- No more navigation to non-existent `/robocar` route
- ToolsScreen now focuses on quick controls only

**Files Modified:**
- `mobile/src/screens/ToolsScreen.tsx` - Removed robocar View + Pressable

### 8.4 Download App Section
**Status:** ✅ Complete
- Added to bottom of Projects page
- Links to existing `/app` page
- No duplication - single source of truth

**Files Modified:**
- `app/projects/page.tsx` - Added download app section at end

### 8.5 Sitemap & SEO
**Status:** ✅ Complete
- Removed `/iot-remote` from sitemap
- Updated to reflect new route structure
- All category pages still crawlable via dynamic `[slug]` route

**Files Modified:**
- `app/sitemap.ts` - Removed `/iot-remote` from pages array

---

## Appendices

### A. Technology Stack
- **Website:** Next.js 14 (App Router), TypeScript, Tailwind CSS 3.4
- **Mobile:** Expo SDK 54, React Native, TypeScript
- **Firmware:** ESP32/Arduino (C++)
- **Backend:** Supabase (PostgreSQL, Storage, Auth)
- **UI:** Lucide React icons, Lucide-react for icons
- **Build:** npm, Next.js scripts, Vitest for testing

### B. Key Commands
```bash
# Website
cd genumsolutions-website
npm run dev      # Development server
npm run build    # Production build
npm run lint     # ESLint check
npm run typecheck # TypeScript check

# Mobile
cd genumsolutions-app/mobile
npx expo start   # Expo development server

# Utilities
npm test           # Run Vitest tests
npm run seed       # Seed product data to Supabase
```

### C. Data Flow
```
Product Catalog (lib/catalog.ts)
        ↓
Projects Page (app/projects/page.tsx) - displays products
        ↓
Content Store (lib/content-store.ts) - Supabase fallback
        ↓
User interactions (add to cart, view details)
        ↓
API routes (/api/products, /api/auth/session)
```

### D. Important Notes
1. **Google OAuth** does not work inside embedded Android WebView (by design)
2. **Mobile app** mirrors website via WebView - not independent feature set
3. **Product data** single source of truth on website only
4. **App download** hosted on website, linked from mobile app
5. **BLE controls** require dev build (not Expo Go) for native integration
6. **Service worker** precaches app shell pages for offline functionality

---

## Change Log

| Date | Version | Change | Files affected |
|------|---------|--------|----------------|
| 2026-08-31 | 1.0.0 | Initial documentation | All files |
|  |  | IoT & Remote Controller embedded in /tools | app/tools/page.tsx, navigation components |
|  |  | Category pages consolidated to dynamic route | app/[slug]/page.tsx, 4 files deleted |
|  |  | Mobile ToolsScreen robocar navigation removed | mobile/src/screens/ToolsScreen.tsx |
|  |  | Download app section added to Projects page | app/projects/page.tsx |
|  |  | Navigation unified: /iot-remote → /tools | 7 files modified |
|  |  | Sitemap and service worker updated | app/sitemap.ts, public/sw.js |

---

*Documentation generated from codebase analysis on 2026-08-31*
*GENUM Solutions Pvt. Ltd. - Kathmandu, Nepal*