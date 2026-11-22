# Website (genumsolutions-website) — Admin UI Blueprint

Verified 2026-11-16 against `main` @ `d4f124e`. This describes the console that
exists, not an earlier plan: one `/admin` route, seven tabs, and a sheet for every
add/edit form. `WEBSITE_ADMIN_COMPLETE.md` documents the fields and copy;
`APP_WEBSITE_UI_COMPARISON.md` maps the website onto the app.

## Overview

- Route: `app/admin/page.tsx` — server component. It resolves
  `getCurrentAdmin()`, `getCurrentUserRole()` and `getManagedProducts()`, redirects
  to `/login` when there is no admin session, and mounts `components/AdminPanel.tsx`
  with `ssr: false`. `metadata.robots` is `noindex, nofollow`.
- Shell: `components/AdminPanel.tsx` owns the header, the sticky tab strip, the
  hint line under it and one panel at a time. All tabs share one page; there are no
  `/admin/<tab>` routes.
- Panels: `components/admin/Admin*.tsx`. Shared pieces live in
  `components/admin/admin-helpers.tsx` (tokens, labels, rows) and
  `components/admin/AdminEditorSheet.tsx` (the editor dialog).

## Top-level navigation

`TABS` in `components/admin/admin-types.ts` — the app's `src/config/adminTabs.ts`
holds an identical list and `TAB_HINTS`, and both parity tests
(`tests/admin-parity.test.ts`, app `src/config/admin-parity.test.ts`) compare the
two maps. Order matters; keep the two files in step.

| #   | Tab                   | Component (section)                                                                                            |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | `Dashboard`           | `AdminDashboard` + `AdminActivity` stacked; money tiles link to Orders → Finance                               |
| 2   | `Orders`              | `AdminSectionTabs` "Order sections": `Orders` (`AdminOrders`), `Finance` (`AdminFinance`)                      |
| 3   | `Electronic Products` | `AdminProducts kind="electronic"`                                                                              |
| 4   | `3D Products`         | `AdminPrint` — sections: Catalog, Categories, Pricing, Costs, Promotions, Services, Gallery, Requests, Reports |
| 5   | `Projects`            | `AdminProjectPackages`                                                                                         |
| 6   | `Content`             | sections: Services (`AdminServices`), Journal (`AdminJournal`), Content (`AdminContent`)                       |
| 7   | `Users`               | sections: Users (`AdminUsers`), Messages (`AdminMessages`), Logs (`AdminLogsHub`)                              |
| 8   | `Settings`            | `AdminSettings` — sections: Company details, Contact, Social & messaging                                       |

Every tab renders its one-line hint from `TAB_HINTS` under the strip. The strip is
a single row that scrolls horizontally on narrow screens and is wired to
Left/Right arrow keys (`role="tablist"`).

## Panel structure

### Dashboard

`AdminDashboard` shows KPI cards (orders, users, carts, products, unread messages,
page views) with an "Open Orders" action instead of duplicating revenue tiles;
`AdminActivity` lists recent activity underneath. Both mount together — there is
no section switch here.

### Orders

`AdminOrders` lists every order with its item lines, status pills (pending → paid →
fulfilled → cancelled) and a receipt preview; deleting is admin-only.
`AdminFinance` holds revenue, transactions, conversion and the order-status
breakdown.

### Electronic Products / Projects

`AdminProducts` covers both catalogs via `kind`. Each card shows the photo, name,
category, price and stock with Preview / Edit / Hide / Delete. `AdminProjectPackages`
lists bundles and their components, with Preview / Edit / Delete.

### 3D Products (print studio)

`AdminPrint` owns the whole studio behind one section strip:

| Section      | What it holds                                                        |
| ------------ | -------------------------------------------------------------------- |
| `Catalog`    | Print products (same card actions as the other catalogs)             |
| `Categories` | Buckets shown on `/3d-printing`                                      |
| `Pricing`    | Material rates and the public calculator                             |
| `Costs`      | Internal costing sheet — live inputs, never shown to a customer      |
| `Promotions` | Active, in-date promotions                                           |
| `Services`   | Add-on services offered with a print                                 |
| `Gallery`    | Gallery images and captions                                          |
| `Requests`   | Quote requests and their status                                      |
| `Reports`    | Revenue, conversion, material use and margin derived from the quotes |

### Content

`AdminServices`, `AdminJournal` and `AdminContent` each list their records with
Preview / Edit / Hide (or Publish/Unpublish) and Delete, and each puts its add form
behind the section's Add button.

### Users

- `Users` — `AdminUsers` renders the directory (search, role, tier, delete for the
  owner). Per-user car and robot profiles are expanded from the user row
  ("Show projects" → `UserProjectProfiles`), not separate sections.
- `Messages` — `AdminMessages` lists customer messages (`/api/admin/messages`) with
  a preview dialog, "mark replied" and admin delete, plus the paged
  **Newsletter subscribers** panel (`/api/admin/newsletter`) showing email, capture
  time, source, status and admin-only Remove.
- `Logs` — `AdminLogsHub` with three sections: `User activity` (`AdminUserLogs`),
  `User profiles` (`AdminProfileEntries`), `Fleet diagnostics` (`AdminLogs`:
  crash reports + app logs).

### Settings

`AdminSettings` edits the single shared company record (`/api/admin/settings`) in
three sections — Company details, Contact, Social & messaging — covering the 17
`Company` fields including `url`, the socials and `whatsappNumber`. Rows are
read-only until **Edit** is pressed; the fields then open in `AdminEditorSheet`.

## Editing pattern

Every add/edit form is closed by default. Pressing **Add**/**New**/**Edit** opens
`AdminEditorSheet` — a portal dialog with `role="dialog"`, `aria-modal`, an Escape
handler, a backdrop, a scrollable body and a **Cancel** dismiss button in its
header. The list underneath stays unchanged while the sheet is open. Exceptions
kept live on purpose: the print **Costs** worksheet (a staff-only costing
calculator, never customer content) and the order status pills (the edit control
itself).

## Previews

Cards that publish to a customer page carry a **Preview** action that renders the
storefront presentation — products, project packages, services, journal posts,
print categories/promotions/services/gallery. Read-only dialogs (previews, the
order receipt) dismiss with **Close**; only the editor sheet says **Cancel**, which
is what the app's 390px smoke test asserts.

## Permissions

`currentRole` decides the surface: `staff` reads everything and edits catalog and
content, `admin` (`isAdminRole`) also deletes, `owner` additionally changes roles,
tiers and deletes users. Authorisation is enforced again in Supabase by RLS and in
each `/api/admin/*` route; the UI never assumes its own gates are enough.

## Key types

| Type                                 | Source                                                                 | Notes                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `Tab`, `TABS`, `TAB_HINTS`           | `components/admin/admin-types.ts`                                      | Mirrored by the app; parsed by both parity tests                     |
| `Product`                            | `lib/content-store.ts`                                                 | Shared by every catalog panel and the storefront                     |
| `Company`                            | `lib/company.ts`                                                       | 17 fields; the bundled constant is only a fallback for a failed read |
| `UserLogsPage`, `ProfileEntriesPage` | `lib/user-logs.ts`                                                     | Imported by the Logs panels so the shape cannot drift                |
| `PrintCategory`, `PrintPromotion`, … | `lib/print.ts` (records), `lib/print-costing.ts`, `lib/print-quote.ts` | Print-studio records shared with `/3d-printing`                      |

## Responsive behavior

Mobile-first at 390px: the tab strip is one horizontally scrolling row, section
pills scroll under it, cards stack, and the header wraps the account controls onto
a second line. The admin page is verified at 390×844 by the app's Playwright walk
(it renders the same data contracts) and by the website's own build/quality checks.

## Documentation

- `WEBSITE_ADMIN_COMPLETE.md` — every panel, field and copy string
- `ADMIN_UI_BLUEPRINT.md` — this file (structure, components, patterns, types)
- `APP_WEBSITE_UI_COMPARISON.md` — app vs website comparison (identical copy in both repos)
- `ADMIN_COHERENCE.md` — tab inventory, role permissions, data ownership
- `LINK_RESILIENCE.md` — diagnostic wire for website admins
