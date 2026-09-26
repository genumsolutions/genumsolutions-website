// =====================================================================
// link-import — the shared "add product by link" extractor for BOTH
// clients (website admin + native app admin).
//
// Paste any product URL -> preview  : link-import extracts what it can
// (title, description, tags, images, source site, category hint) and the
// admin fills the rest; on save the admin's product form calls:
//
//   action 'create'  : re-extract, download the best image, upload it to
//                      the `product-images` bucket, and upsert the
//                      products row (documentation_url = source link).
//
// Extractors, in priority:
//   1. MakerWorld            -> Bambu Lab design API (anonymous metadata)
//   2. Any other site        -> OpenGraph + JSON-LD Product scan (bot-
//                               walled shops come back found:false and the
//                               admin fills the fields by hand).
//
// Security:
//   - Same staff+/admin+ gate as admin-products (caller JWT -> profile).
//   - Image download is SSRF-guarded: https-only, public-IP-only, 4 MB cap,
//     allowlisted content types, and the final tarball is stored in Supabase
//     Storage (never fetched directly by browsers from random CDNs).
//
// Body:  { action: 'preview'|'create', url, product?: {category?, name?,
//          price?, priceLabel?, stock?, description?, sortOrder?} }
//
// Deploy:
//   supabase functions deploy link-import --project-ref bkylfnlybtsujwzru
// =====================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

// ---------------- Caller auth (same gate as admin-products) ----------------
async function callerRole(req: Request): Promise<{
  role: string | null;
  client: ReturnType<typeof createClient> | null;
  error?: string;
}> {
  const callerToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!callerToken) return { role: null, client: null, error: "Sign in to import products." };
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData } = await adminClient.auth.getUser(callerToken);
  const callerId = userData?.user?.id;
  if (!callerId) return { role: null, client: null, error: "Sign in to import products." };
  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();
  if (!callerProfile?.role)
    return { role: null, client: null, error: "Only staff members can import products." };
  const role = String(callerProfile.role);
  if (!(role === "staff" || role === "admin" || role === "owner")) {
    return { role: null, client: null, error: "Only staff members can import products." };
  }
  return { role, client: adminClient };
}

// ---------------- Small helpers ----------------
const slugify = (raw: string) =>
  String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/&(amp;)?/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled-product";

const stripHtml = (html: string) =>
  String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const dedupe = <T>(arr: T[]) => Array.from(new Set(arr.filter(Boolean) as unknown[])) as T[];

/** Curate an imported description: collapse whitespace, trim stats annex,
 *  cap at a readable length with a clean sentence break. */
function curateDescription(desc: string, max = 600): string {
  const t = stripHtml(desc).replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSentence = cut.lastIndexOf(". ");
  const lastBreak = cut.lastIndexOf("\n");
  const end =
    lastSentence > max * 0.6
      ? lastSentence + 1
      : lastBreak > max * 0.4
        ? lastBreak
        : cut.lastIndexOf(" ");
  const head = t.slice(0, end > 40 ? end : max).replace(/[.;,\s]+$/, "");
  return `${head}…`;
}

function isHttpUrl(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** SSRF guard — resolution must end on a public IP, https only. */
function isPublicHttpsUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname;
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if (!isIp) return true; // DNS host — allow; fetch follows to a public IP
    const octets = host.split(".").map(Number);
    if (octets.some((o) => o > 255 || o < 0)) return false;
    const [a, b] = octets;
    if (a === 10) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 127 || a === 0) return false;
    return true;
  } catch {
    return false;
  }
}

// ---------------- Provider registry (U-35, 2026-09-25) ----------------
// ONE table of supported sources. Adding a provider is a single entry here —
// no changes to runPreview, no changes to the admin UI, and every attempt
// (supported or not) is recorded in `link_import_attempts` so the owner can
// see which sources staff are actually pasting.
export interface ProviderDef {
  /** stable id, also written to link_import_attempts.provider */
  id: string;
  /** human label shown in the admin "source" pill */
  label: string;
  /** apex hostnames; any subdomain of these also matches */
  hosts: string[];
  extract: (url: string) => Promise<Preview>;
}

/** Host matches if it equals an entry or is a subdomain of it. */
function hostMatches(hostname: string, hosts: string[]): boolean {
  const h = hostname.toLowerCase();
  return hosts.some((entry) => h === entry || h.endsWith(`.${entry}`));
}

/** Resolve a pasted URL to a provider, or null when unknown. */
function providerFor(rawUrl: string): ProviderDef | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  return PROVIDERS.find((p) => hostMatches(u.hostname, p.hosts)) ?? null;
}

// ---------------- MakerWorld / Bambu Lab extractor ----------------
const BAMBU_DESIGN_API = "https://api.bambulab.com/v1/design-service/design";
// Apex hosts only — providerFor() also matches every subdomain, so
// www.makerworld.com.cn and makerworld.eu style variants resolve too.
const MAKERWORLD_HOSTS = ["makerworld.com", "makerworld.com.cn"];

async function fetchBambuDesign(designId: number) {
  const res = await fetch(`${BAMBU_DESIGN_API}/${designId}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

interface Preview {
  found: boolean;
  provider: string;
  sourceUrl: string;
  title: string;
  description: string;
  tags: string[];
  images: string[];
  categoryHint: string;
  // Richer extraction (2026-09-23): print profile / weight / compatibility
  // become spec lines, gallery images are collected, stats enrich the
  // description — so the admin reviews prefilled data instead of retyping it.
  specs?: string[];
  // U-24 (2026-09-24): canonical MakerWorld spec model — { key, value } pairs
  // rendered as an organized "Specifications" block on product pages, and
  // flattened to `specs` string lines for the card chips.
  structuredSpecs?: { key: string; value: string }[];
  priceLabel?: string;
  extra?: Record<string, unknown>;
}

export interface MakerWorldSpecEntry {
  key: string;
  value: string;
}

/** Extract design id from a MakerWorld URL: https://makerworld.com/en/models/45000 ...
 *  Handles locale prefixes (/en/, /zh/, /zh-hans/), the canonical share form
 *  /models/<ID>-<title-slug> (the numeric ID LEADS the slug — U-39 fix: the old
 *  trailing-id regex never matched, so every slug-form share link fell through
 *  to the generic scraper, which only gets Cloudflare's 'Just a moment...'
 *  shell), and the query form /en/models?designId=45000. */
function makerworldDesignId(url: string): number | null {
  try {
    const u = new URL(url);
    if (!hostMatches(u.hostname, MAKERWORLD_HOSTS)) return null;
    // Query form: ?designId=123 or ?id=123
    for (const key of ["designId", "id", "modelId"]) {
      const raw = u.searchParams.get(key);
      if (raw && /^\d{3,}$/.test(raw.trim())) return Number(raw.trim());
    }
    const after = u.pathname.split("/models/")[1];
    if (after == null) return null;
    const segment = after.split(/[/?#]/)[0].trim();
    if (!segment) return null;
    // Plain numeric: /models/45000
    if (/^\d+$/.test(segment)) return Number(segment);
    // Slug form: /models/45000-magura-mt5-piston-rings — the ID LEADS.
    const leading = segment.match(/^(\d{3,})/);
    if (leading) return Number(leading[1]);
    return null;
  } catch {
    return null;
  }
}

/** All image candidates for a MakerWorld design, best-first. */
function makerworldImages(design: Record<string, unknown>): string[] {
  const instances = Array.isArray(design.instances)
    ? (design.instances as Record<string, unknown>[])
    : [];
  const ext = (design.designExtension ?? {}) as Record<string, unknown>;
  const defaultId = String(design.defaultInstanceId ?? "");
  const ok = (u: unknown) => isHttpUrl(u as string);

  const instanceCovers = instances.map((i) => String(i.cover ?? "")).filter(Boolean);
  const defaultCover = instances.find((i) => String(i.id ?? "") === defaultId)?.cover;
  const covers = dedupe([defaultCover, ...instanceCovers]);

  const gallery: string[] = [];
  for (const key of ["real_pictures", "design_pictures"]) {
    const list = Array.isArray(ext[key]) ? (ext[key] as unknown[]) : [];
    for (const item of list) {
      if (typeof item === "string") gallery.push(item);
      else if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const u = rec.url ?? rec.picUrl ?? rec.cover;
        if (u) gallery.push(String(u));
      }
    }
  }

  return dedupe([
    String(design.coverPortrait ?? ""),
    String(design.coverLandscape ?? ""),
    String(design.coverUrl ?? ""),
    ...covers,
    ...gallery,
  ]).filter(ok) as string[];
}

/**
 * U-24 (2026-09-24): canonical MakerWorld spec extraction. Only STANDARD
 * MakerWorld/Bambu profile fields are kept — no instance titles, no scraped
 * filler, no guessed units. The result feeds both the card chips (`specs`
 * lines) and the organized "Specifications" block (structured key/value).
 */
function makerworldStructuredSpecs(design: Record<string, unknown>): MakerWorldSpecEntry[] {
  const instances = Array.isArray(design.instances)
    ? (design.instances as Record<string, unknown>[])
    : [];
  const defaultId = String(design.defaultInstanceId ?? "");
  const best = instances.find((i) => String(i.id ?? "") === defaultId) || instances[0];
  if (!best) return [];
  const entries: MakerWorldSpecEntry[] = [];
  const ext = (best.extention ?? {}) as Record<string, unknown>;
  const mi = (ext.modelInfo ?? {}) as Record<string, unknown>;
  const comp = (mi.compatibility ?? {}) as Record<string, unknown>;
  if (comp.devProductName) {
    const value = String(comp.devProductName).trim();
    entries.push({ key: "Compatible", value: value.replace(/\s+/g, " ").slice(0, 60) });
  }
  // Dimensions (W × D × H mm) when the profile reports all present parts.
  const dim = (mi.dimension ?? {}) as Record<string, unknown>;
  const dWidth = typeof dim.width === "number" && dim.width > 0 ? dim.width : null;
  const dDepth = typeof dim.depth === "number" && dim.depth > 0 ? dim.depth : null;
  const dHeight = typeof dim.height === "number" && dim.height > 0 ? dim.height : null;
  if (dWidth || dDepth || dHeight)
    entries.push({
      key: "Dimensions",
      value: `${[dWidth, dDepth, dHeight].filter((n) => n != null).join(" × ")} mm`,
    });
  if (typeof best.weight === "number" && best.weight > 0)
    entries.push({ key: "Weight", value: `${best.weight} g` });
  if (typeof best.materialCnt === "number" && best.materialCnt > 0)
    entries.push({ key: "Materials", value: String(best.materialCnt) });
  // Filament types by NAME (MakerWorld standard), capped at 3, skipped when
  // the API only reports a count (no names = not a standard value).
  if (Array.isArray(best.instanceFilaments)) {
    const types = (best.instanceFilaments as Record<string, unknown>[])
      .map((f) => String(f.translateName || f.name || "").trim())
      .filter(Boolean);
    if (types.length) entries.push({ key: "Filament types", value: types.slice(0, 3).join(", ") });
  }
  const printEstimates = [
    String(best.estimatedPrintTime ?? ""),
    String(best.printTime ?? ""),
    String((best.extendInfo as Record<string, unknown> | undefined)?.printTime ?? ""),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  if (printEstimates.length) {
    const value = printEstimates[0];
    const n = Number(value);
    entries.push({
      key: "Print time",
      value:
        Number.isFinite(n) && n > 0 && value === String(Math.round(n))
          ? `~${Math.round((n >= 3600 ? n / 3600 : n / 60) * 10) / 10} ${n >= 3600 ? "h" : "min"}`
          : String(value).slice(0, 40),
    });
  }
  return entries;
}

/** Clean description ... */

/**
 * U-24 (2026-09-24): standard MakerWorld description only. The Bambu API's
 * summary is the designer's own blurb (likes/downloads live in separate
 * fields), so we strip any leftover stat/boilerplate phrases and cap at a
 * readable length — the "printed N times · liked N times" noise never ships.
 */
function makerworldDescription(design: Record<string, unknown>): string {
  const raw = String(design.summary || design.summaryTranslated || "");
  const cleaned = raw.replace(/\b(printed|boost|like|download|collection)\w*:\s*\d+[km]?\b/gi, "");
  return curateDescription(cleaned, 420);
}

/** Map MakerWorld category/tag keywords onto the company's REAL catalog
 *  taxonomy (query of live categories, 2026-09-24: 3D Models · Connectors &
 *  Cables · Controllers & Boards · Displays & Interfaces · Mechanical Parts ·
 *  Motors & Motion · Power & Charging · Robot Cars · Sensors & Modules ·
 *  Tools & Fabrication). Unknown items default to "3D Models" — the hint is
 *  reviewed in the editor before save, never applied blindly. */
function makerworldCategoryHint(design: Record<string, unknown>): string {
  const categories = Array.isArray(design.categories)
    ? (design.categories as Record<string, unknown>[]).map((c) =>
        String(c.name || "").toLowerCase()
      )
    : [];
  const tags = [...(design.tags ?? []), ...(design.tagsTranslated ?? [])]
    .map((t) => String(t).toLowerCase())
    .join(" ");
  const haystack = `${categories.join(" ")} ${tags}`;
  if (/(robot|rc |rc-) ?(car|vehicle)|\bcar\b|chassis|servo|tank|holonomic/.test(haystack))
    return "Robot Cars";
  if (
    /(arduino|esp32|esp8266|raspberry|micro.bit|circuit|pcb|electronic|soldering|breadboard|chip)/.test(
      haystack
    )
  )
    return "Controllers & Boards";
  if (
    /(sensor|imu|gyro|accelerometer|gps|lidar|ultrasonic|camera|joystick|encoder|thermistor)/.test(
      haystack
    )
  )
    return "Sensors & Modules";
  if (/(screen|display|lcd|oled|indicator|led |segment)/.test(haystack))
    return "Displays & Interfaces";
  if (
    /(holder|organizer|storage|bracket|mount|tray|gear|pulley|spacer|bearing|hinge|clamp)/.test(
      haystack
    )
  )
    return "Mechanical Parts";
  if (/(motor|wheel|gearbox|pump|fan |drone|propeller)/.test(haystack)) return "Motors & Motion";
  if (/(battery|charger|charging|power|usb-c|type-c|solar|dynamo)/.test(haystack))
    return "Power & Charging";
  if (
    /(screwdriver|hammer|wrench|caliper|fixture|socket set|pry bar|dust-collector)/.test(haystack)
  )
    return "Tools & Fabrication";
  if (/(cable|clip|connector|plug|adapter|crimping|wire)/.test(haystack))
    return "Connectors & Cables";
  if (/(figure|miniature|decor|art|sculpture|ornament|fidget|sign)/.test(haystack))
    return "3D Models";
  return "3D Models";
}

async function extractMakerWorld(url: string): Promise<Preview> {
  const designId = makerworldDesignId(url);
  if (!designId)
    return {
      found: false,
      provider: "makerworld",
      sourceUrl: url,
      title: "",
      description: "",
      tags: [],
      images: [],
      categoryHint: "3D Models",
    };
  const design = await fetchBambuDesign(designId);
  if (!design?.title) {
    return {
      found: false,
      provider: "makerworld",
      sourceUrl: url,
      title: "",
      description: "",
      tags: [],
      images: [],
      categoryHint: "3D Models",
      extra: { designId },
    };
  }
  const tags = dedupe([...(design.tags ?? []), ...(design.tagsTranslated ?? [])]) as string[];
  const categories = Array.isArray(design.categories)
    ? (design.categories as Record<string, unknown>[])
    : [];
  const structuredSpecs = makerworldStructuredSpecs(design);

  return {
    found: true,
    provider: "MakerWorld",
    sourceUrl: url,
    title: String(design.title || design.titleTranslated || "").trim(),
    description: makerworldDescription(design),
    tags: tags.filter((t) => String(t).length <= 30).slice(0, 12),
    images: makerworldImages(design),
    categoryHint: makerworldCategoryHint(design),
    specs: structuredSpecs.map((s) => `${s.key}: ${s.value}`),
    structuredSpecs,
    extra: {
      designId,
      modelId: design.modelId,
      slug: design.slug,
      license: design.license,
      creator: design.designCreator?.name || design.originals?.[0]?.uploaderName,
      subcategory: categories[0]?.name ?? "",
      stats: {
        printCount: design.printCount ?? 0,
        likeCount: design.likeCount ?? 0,
        collectionCount: design.collectionCount ?? 0,
        downloadCount: design.downloadCount ?? 0,
        commentCount: design.commentCount ?? 0,
      },
      pricing: {
        isPaid: design.paidSetting?.isPaid === true,
        isPointRedeemable: design.isPointRedeemable === true,
        pointPrice: design.pointRedeemDetail?.price ?? 0,
      },
    },
  };
}

// ---------------- Printables extractor (U-35, 2026-09-25) ----------------
// printables.com hard-blocks plain HTML scrapes (HTTP 403 for every browser-UA
// request, verified live), so the only working path is the public GraphQL API
// at api.printables.com/graphql/. Images live on the media.printables.com CDN
// and the API returns a RELATIVE `filePath`, so they are re-based here.
const PRINTABLES_GRAPHQL = "https://api.printables.com/graphql/";
const PRINTABLES_MEDIA = "https://media.printables.com/";
const PRINTABLES_HOSTS = ["printables.com"];

const PRINTABLES_QUERY = `query PrintById($id: ID!) {
  print(id: $id) {
    id
    name
    slug
    description
    user { publicUsername }
    license { name }
    tags { name }
    image { filePath }
    images { id filePath }
    downloadCount
  }
}`;

/** Extract the model id from a printables URL: /model/863119-headphone-holder */
function printablesModelId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!hostMatches(u.hostname, PRINTABLES_HOSTS)) return null;
    const after = u.pathname.split("/model/")[1];
    if (after == null) return null;
    const segment = after.split(/[/?#]/)[0].trim();
    if (!segment) return null;
    const id = segment.match(/^(\d{2,})/);
    return id ? id[1] : null;
  } catch {
    return null;
  }
}

function printablesImages(data: Record<string, unknown>): string[] {
  // U-39 (2026-09-26): Printables' GraphQL returns filePath as a BARE-relative
  // path ("media/prints/…" — no leading slash, no host). The old code only
  // re-based "//"- and "/"-prefixed values, so every image fell through to
  // isHttpUrl(bare path) = false and the gallery was ALWAYS empty. Re-base
  // bare-relative paths onto the media CDN too.
  const toUrl = (v: unknown): string | null => {
    if (typeof v !== "string" || !v) return null;
    const abs = v.startsWith("//")
      ? `https:${v}`
      : v.startsWith("http")
        ? v
        : `${PRINTABLES_MEDIA}${v.replace(/^\/+/, "")}`;
    return isHttpUrl(abs) ? abs : null;
  };
  const cover = toUrl((data.image as Record<string, unknown> | null)?.filePath);
  const list = Array.isArray(data.images) ? (data.images as Record<string, unknown>[]) : [];
  const rest = list.map((i) => toUrl(i.filePath)).filter((u): u is string => u != null);
  return dedupe([cover, ...rest].filter((u): u is string => u != null));
}

/** Strip the HTML subset printables puts in model descriptions. */
function printablesDescription(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPrintables(url: string): Promise<Preview> {
  const miss: Preview = {
    found: false,
    provider: "printables",
    sourceUrl: url,
    title: "",
    description: "",
    tags: [],
    images: [],
    categoryHint: "3D Models",
  };
  const modelId = printablesModelId(url);
  if (!modelId) return miss;

  const res = await fetch(PRINTABLES_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
    body: JSON.stringify({ query: PRINTABLES_QUERY, variables: { id: modelId } }),
  });
  if (!res.ok) return { ...miss, extra: { modelId, httpStatus: res.status } };

  let payload: { data?: { print?: Record<string, unknown> | null }; errors?: unknown };
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    return { ...miss, extra: { modelId } };
  }
  const model = payload.data?.print;
  const name = String(model?.name ?? "").trim();
  if (!model || !name)
    return { ...miss, extra: { modelId, graphqlErrors: payload.errors ?? null } };

  const tags = Array.isArray(model.tags)
    ? (model.tags as Record<string, unknown>[]).map((t) => String(t?.name ?? "")).filter(Boolean)
    : [];
  const description = curateDescription(printablesDescription(String(model.description ?? "")));
  const images = printablesImages(model);
  const creator = String(
    (model.user as Record<string, unknown> | null)?.publicUsername ?? ""
  ).trim();
  const license = String((model.license as Record<string, unknown> | null)?.name ?? "").trim();
  const slug = String(model.slug ?? "").trim();
  const canonical = `https://www.printables.com/model/${modelId}${slug ? `-${slug}` : ""}`;

  const specs: string[] = [];
  if (license) specs.push(`License: ${license}`);
  if (creator) specs.push(`Designer: ${creator}`);
  const downloads = Number(model.downloadCount ?? 0);
  if (Number.isFinite(downloads) && downloads > 0) specs.push(`Downloads: ${downloads}`);

  return {
    found: true,
    provider: "Printables",
    sourceUrl: canonical,
    title: name,
    description,
    tags: dedupe(tags).slice(0, 12),
    images,
    categoryHint: "3D Models",
    specs,
    structuredSpecs: specs.map((line) => {
      const at = line.indexOf(": ");
      return { key: line.slice(0, at), value: line.slice(at + 2) };
    }),
    extra: {
      modelId,
      slug,
      license,
      creator,
      subcategory: tags[0] ?? "",
      canonical,
      stats: { downloadCount: downloads },
    },
  };
}

// ---------------- Thingiverse (U-39, 2026-09-26): known-unsupported ----------------
// www.thingiverse.com is a client-rendered SPA: the HTML shell carries ONLY the
// site-level og tags (verified live — no model title/description/image), the
// public API requires an OAuth token (401 without one), and the CDN blocks
// non-browser fetches (403). There is nothing to extract without a scraping
// service, so this extractor returns a HONEST not-found with the reason.
// Attempt rows still record provider='thingiverse' (outcome provider-empty)
// so demand is visible in link_import_attempts.
const THINGIVERSE_HOSTS = ["thingiverse.com"];

async function extractThingiverse(url: string): Promise<Preview> {
  const thingId = url.match(/thing:(\d+)/)?.[1] ?? "";
  return {
    found: false,
    provider: "thingiverse",
    sourceUrl: url,
    title: "",
    description: "",
    tags: [],
    images: [],
    categoryHint: "3D Models",
    extra: {
      thingId,
      reason:
        "Thingiverse blocks automated reads (their API needs an OAuth token, their pages are client-rendered). Copy the model name/images manually for now.",
    },
  };
}

/** The registry itself — ordered, first match wins. */
const PROVIDERS: ProviderDef[] = [
  { id: "makerworld", label: "MakerWorld", hosts: MAKERWORLD_HOSTS, extract: extractMakerWorld },
  { id: "printables", label: "Printables", hosts: PRINTABLES_HOSTS, extract: extractPrintables },
  {
    id: "thingiverse",
    label: "Thingiverse",
    hosts: THINGIVERSE_HOSTS,
    extract: extractThingiverse,
  },
];

// ---------------- Generic OpenGraph + JSON-LD extractor ----------------
const readMeta = (html: string, prop: string): string => {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    "i"
  );
  const m = html.match(re) || html.match(re2);
  return m ? m[1] : "";
};

function scanJsonLd(html: string): {
  name?: string;
  image?: string;
  description?: string;
  price?: string;
  siteName?: string;
  specs?: string[];
} {
  const blocks =
    html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const raw = block
      .replace(/^<script[^>]*>/i, "")
      .replace(/<\/script>$/i, "")
      .trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const scan = (
      node: Record<string, unknown>
    ): {
      name?: string;
      image?: string;
      description?: string;
      price?: string;
      siteName?: string;
      specs?: string[];
    } | null => {
      if (!node || typeof node !== "object") return null;
      const type = Array.isArray(node["@type"]) ? node["@type"][0] : node["@type"];
      if (type === "Product" || type?.includes("Product")) {
        let image = "";
        if (typeof node["image"] === "string") image = node["image"];
        else if (Array.isArray(node["image"]) && typeof node["image"][0] === "string")
          image = node["image"][0];
        else if (typeof node["image"] === "object" && node["image"]?.["url"])
          image = node["image"]["url"] as string;
        const offer = Array.isArray(node["offers"]) ? node["offers"][0] : node["offers"];
        const specs: string[] = [];
        if (Array.isArray(node["additionalProperty"])) {
          for (const prop of node["additionalProperty"]) {
            if (prop && typeof prop === "object" && prop["name"] != null && prop["value"] != null) {
              specs.push(`${String(prop["name"])}: ${String(prop["value"])}`);
            }
          }
        }
        return {
          name: String(node["name"] || ""),
          image,
          description: String(node["description"] || ""),
          price: offer?.["price"] != null ? String(offer["price"]) : undefined,
          siteName:
            typeof node["brand"] === "object" && node["brand"]?.["name"]
              ? String(node["brand"]["name"])
              : undefined,
          specs,
        };
      }
      for (const key of Object.keys(node)) {
        const v = node[key];
        if (Array.isArray(v)) {
          for (const item of v) {
            if (typeof item === "object" && item !== null) {
              const r = scan(item as Record<string, unknown>);
              if (r?.name) return r;
            }
          }
        } else if (typeof v === "object" && v !== null) {
          const r = scan(v as Record<string, unknown>);
          if (r?.name) return r;
        }
      }
      return null;
    };
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "object" && item !== null) {
          const r = scan(item as Record<string, unknown>);
          if (r?.name) return r;
        }
      }
    } else if (typeof parsed === "object" && parsed !== null) {
      const r = scan(parsed as Record<string, unknown>);
      if (r?.name) return r;
    }
  }
  return {};
}

const UA_GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const UA_LIST = [UA, UA_GOOGLEBOT];

async function fetchPage(url: string): Promise<string | null> {
  for (const ua of UA_LIST) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": ua,
          Accept: "text/html,application/xhtml+xml,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
      // Bot-walled shops (403/429) may still serve Googlebot — retry once.
      if (res.status === 403 || res.status === 429) continue;
      if (!res.ok) return null;
      const type = res.headers.get("content-type") || "";
      if (!type.includes("html")) return null;
      return await res.text();
    } catch {
      // transient network error — try the next UA
    }
  }
  return null;
}

/** Turn absolute, protocol-relative (`//host/...`) or page-relative (`/img.jpg`)
 *  image URLs into safe absolute http(s) URLs. */
function resolveImageUrl(raw: string, base: string): string {
  if (!raw) return "";
  if (/^(data:|javascript:|blob:)/i.test(raw.trim())) return "";
  try {
    const u = new URL(raw.trim(), base);
    if (!(u.protocol === "https:" || u.protocol === "http:")) return "";
    return u.href;
  } catch {
    return "";
  }
}

const IMG_SKIP =
  /(icon|logo|avatar|pixel|spacer|bullet|favicon|badge|sprite|placeholder|1x1|transparent)/i;

/** Last-resort fallback: scrape `<img>` / `srcset` / lazy-load attrs / preload
 *  images, skipping obvious icons/logos/pixels/tracking blips. */
function scrapePageImages(html: string, base: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const abs = resolveImageUrl(raw, base);
    if (!abs || seen.has(abs)) return;
    if (IMG_SKIP.test(abs)) return;
    seen.add(abs);
    out.push(abs);
  };
  const pickSrcset = (attr: string) => {
    let best = "";
    let bestW = -1;
    for (const part of (attr || "").split(",")) {
      const bits = part.trim().split(/\s+/);
      const url = bits[0] || "";
      const d = bits[1] || "";
      const wm = d.match(/(\d+)w/);
      const xm = d.match(/(\d+)x/);
      const w = wm ? Number(wm[1]) : xm ? Math.round(Number(xm[1]) * 500) : 0;
      if (w > bestW) {
        bestW = w;
        best = url;
      }
    }
    if (best) add(best);
  };
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/<img[^>]+srcset=["']([^"']+)["']/gi)) pickSrcset(m[1]);
  for (const m of html.matchAll(/<source[^>]+srcset=["']([^"']+)["']/gi)) pickSrcset(m[1]);
  // Lazy-loaded galleries use data attributes for the real image.
  for (const m of html.matchAll(/<img[^>]+\bdata-(?:src|original|lazy-src|thumb)="([^"]+)"/gi))
    add(m[1]);
  for (const m of html.matchAll(
    /<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]+href=["']([^"']+)["']/gi
  ))
    add(m[1]);
  return out;
}

async function extractGeneric(url: string): Promise<Preview> {
  const html = await fetchPage(url);
  if (!html)
    return {
      found: false,
      provider: "generic",
      sourceUrl: url,
      title: "",
      description: "",
      tags: [],
      images: [],
      categoryHint: "",
    };

  const ld = scanJsonLd(html);
  const ogTitle = readMeta(html, "og:title");
  const ogDesc = readMeta(html, "og:description");
  const ogSite = readMeta(html, "og:site_name");
  const htmlTitle = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const title = String(ld.name || ogTitle || htmlTitle || "").trim();
  const description = String(ld.description || ogDesc || "").trim();

  // Collect every gallery/og/twitter/image_src URL the page exposes, best-first.
  const collectMeta = (prop: string): string[] => {
    const out: string[] = [];
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "gi"
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
      "gi"
    );
    for (const m of html.matchAll(re1)) out.push(m[1]);
    for (const m of html.matchAll(re2)) out.push(m[1]);
    return out;
  };
  const itemPropImages = [
    ...html.matchAll(/<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/gi),
  ].map((m) => m[1]);
  const linkImages = [
    ...html.matchAll(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/gi),
  ].map((m) => m[1]);

  const ldImage = Array.isArray(ld.image)
    ? (ld.image as string[])
    : ld.image
      ? [ld.image as string]
      : [];
  const metaImages = [
    ...collectMeta("og:image"),
    ...collectMeta("og:image:url"),
    ...collectMeta("og:image:secure_url"),
    ...collectMeta("twitter:image"),
    ...itemPropImages,
    ...linkImages,
  ]
    .map((u) => resolveImageUrl(u, url))
    .filter(Boolean);
  const scraped = scrapePageImages(html, url);

  const images = dedupe([
    ...ldImage.map((u) => resolveImageUrl(u, url)),
    ...metaImages,
    ...(ldImage.length + metaImages.length < 3 ? scraped : []),
  ])
    .filter(Boolean)
    .slice(0, 8) as string[];

  const keywords = readMeta(html, "keywords");
  const tags = (keywords || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.length <= 40)
    .slice(0, 12);

  const extra: Record<string, unknown> = {};
  if (ld.price != null) extra.price = ld.price;
  if (ld.siteName) extra.siteName = ld.siteName;

  return {
    found: Boolean(title),
    provider: ogSite || ld.siteName || "website",
    sourceUrl: url,
    title,
    description,
    tags,
    images,
    specs: (ld.specs ?? []).slice(0, 12),
    categoryHint: "",
    extra: Object.keys(extra).length ? extra : undefined,
  };
}

// ---------------- Image guard + storage upload ----------------
/** Sniff image type from magic bytes (CDNs often lie about content-type). */
function sniffImageType(buf: Uint8Array): { contentType: string; ext: string } | null {
  const p = (off: number, ...bytes: number[]) => {
    for (let i = 0; i < bytes.length; i++) if (buf[off + i] !== bytes[i]) return false;
    return true;
  };
  if (buf.length >= 3 && p(0, 0xff, 0xd8, 0xff)) return { contentType: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && p(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { contentType: "image/png", ext: "png" };
  if (buf.length >= 12 && p(0, 0x52, 0x49, 0x46, 0x46) && p(8, 0x57, 0x45, 0x42, 0x50))
    return { contentType: "image/webp", ext: "webp" };
  if (buf.length >= 12 && p(0, 0x52, 0x49, 0x46, 0x46) && p(8, 0x41, 0x56, 0x49, 0x46))
    return { contentType: "image/avif", ext: "avif" };
  if (buf.length >= 6 && p(0, 0x47, 0x49, 0x46, 0x38))
    return { contentType: "image/gif", ext: "gif" };
  return null;
}

async function downloadImage(
  url: string
): Promise<{ bytes: Uint8Array; contentType: string; ext: string } | { error: string }> {
  if (!isPublicHttpsUrl(url)) return { error: "Image URL must be https from a public host." };
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (!res.ok) return { error: `Image fetch failed (http ${res.status}).` };
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0) return { error: "Image was empty." };
    if (buf.byteLength > MAX_IMAGE_BYTES) return { error: "Image is larger than 4 MB." };
    const sniffed = sniffImageType(buf);
    if (!sniffed) return { error: "Not a supported image (jpg/png/webp/avif/gif)." };
    return { bytes: buf, contentType: sniffed.contentType, ext: sniffed.ext };
  } catch {
    return { error: "Image download failed." };
  }
}

// ---------------- Main handlers ----------------

/** Reason text for the admin, so a failure is never a silent dead end. */
export type AttemptOutcome = "extracted" | "provider-empty" | "provider-error" | "no-provider";

/**
 * U-35 (2026-09-25): resolve the provider, try it, and ALWAYS fall back to the
 * generic OpenGraph/JSON-LD scraper on the same URL. Previously a recognised
 * provider that returned nothing produced a bare "found: false" with no
 * fallback, no try/catch and no diagnostics — which is what the owner saw as
 * "extract details is not working".
 */
async function runPreview(url: string, client?: ReturnType<typeof createClient>): Promise<Preview> {
  const provider = providerFor(url);
  let primary: Preview | null = null;
  let outcome: AttemptOutcome = "no-provider";
  let errorText = "";

  if (provider) {
    outcome = "provider-empty";
    try {
      primary = await provider.extract(url);
      if (primary.found) outcome = "extracted";
    } catch (error) {
      outcome = "provider-error";
      errorText = error instanceof Error ? error.message : String(error);
      console.error(`link-import ${provider.id} extract failed:`, error);
    }
  }

  if (outcome !== "extracted") {
    // Fall back to generic scraping for the SAME url, whatever the outcome was.
    try {
      const generic = await extractGeneric(url);
      if (generic.found) {
        const note = provider
          ? `${generic.provider} fallback (${provider.label} ${outcome})`
          : generic.provider;
        return {
          ...generic,
          provider: note,
          extra: { ...(generic.extra ?? {}), attemptedProvider: provider?.id ?? null },
        };
      }
    } catch (error) {
      console.error("link-import generic fallback failed:", error);
    }
  }

  const result: Preview = primary ?? {
    found: false,
    provider: provider?.id ?? "generic",
    sourceUrl: url,
    title: "",
    description: "",
    tags: [],
    images: [],
    categoryHint: "",
  };
  // Surface a human reason on the not-found path so the admin can say WHY.
  if (!result.found) {
    result.extra = {
      ...(result.extra ?? {}),
      outcome,
      ...(errorText ? { error: errorText.slice(0, 200) } : {}),
      supported: PROVIDERS.map((p) => ({ id: p.id, label: p.label, hosts: p.hosts })),
    };
  }
  void recordAttempt(client, url, provider, outcome, errorText);
  return result;
}

/** U-35: best-effort telemetry so the owner can see which sources staff try. */
async function recordAttempt(
  client: ReturnType<typeof createClient> | undefined,
  url: string,
  provider: ProviderDef | null,
  outcome: AttemptOutcome,
  errorText: string
) {
  if (!client) return;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }
  try {
    await client.from("link_import_attempts").insert({
      host,
      provider: provider?.id ?? null,
      provider_label: provider?.label ?? null,
      outcome,
      error: errorText ? errorText.slice(0, 300) : null,
    });
  } catch (error) {
    // Telemetry must never break extraction.
    console.error("link-import attempt log failed:", error);
  }
}

/**
 * W1 (2026-09-24): download image URL(s) (SSRF-guarded, magic-byte sniffed)
 * and upload them to the `product-images` bucket, returning their public
 * storage URLs. Used by the WEBSITE admin save path so a product whose editor
 * seeded the ORIGINAL third-party image URLs (makerworld CDN, shop image, ...)
 * gets the same durable storage copies the app's create flow always produced —
 * next/image + CSP only allow our own bucket.
 * Body: { action:'upload-image', url, imageUrls }  (url = the source link,
 * used for the MakerWorld extractor when imageUrls is absent).
 */
async function runUploadImage(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const url = String(body?.url || "").trim();
  const explicitList = Array.isArray(body?.imageUrls)
    ? (body.imageUrls as unknown[]).filter((u): u is string => typeof u === "string")
    : [];
  const explicit = String(body?.imageUrl || "").trim();
  const wantsImage = isHttpUrl(url) || isHttpUrl(explicit) || explicitList.some(isHttpUrl);
  if (!wantsImage)
    return { status: 400, data: { error: "Please paste a valid https image/link." } };

  const candidates: string[] = [];
  for (const u of [...explicitList, explicit]) {
    if (isHttpUrl(u) && !candidates.includes(u)) candidates.push(u);
  }
  try {
    const preview = await runPreview(url || explicit, client);
    for (const img of preview.images ?? []) {
      if (typeof img === "string" && isHttpUrl(img) && !candidates.includes(img))
        candidates.push(img);
    }
  } catch {
    // extractor failure is non-fatal when explicit image URLs were given
  }
  if (candidates.length === 0)
    return { status: 422, data: { error: "No image candidates found for that link." } };

  const uploaded: string[] = [];
  for (const candidate of candidates.slice(0, 8)) {
    const img = await downloadImage(candidate);
    if ("error" in img) {
      console.warn("link-import upload-image skip:", img.error);
      continue;
    }
    const path = `${crypto.randomUUID()}-linkimport.${img.ext}`;
    const { error: upErr } = await client.storage.from("product-images").upload(path, img.bytes, {
      contentType: img.contentType,
      upsert: false,
    });
    if (upErr) {
      console.warn("link-import upload-image storage skip:", upErr.message);
      continue;
    }
    uploaded.push(`${supabaseUrl}/storage/v1/object/public/product-images/${path}`);
  }
  if (uploaded.length === 0)
    return { status: 502, data: { error: "Could not download or store the images." } };
  return { status: 200, data: { imageUrl: uploaded[0], gallery: uploaded } };
}

async function runCreate(body: Record<string, unknown>, client: ReturnType<typeof createClient>) {
  const url = String(body?.url || "").trim();
  const overrides = (
    body?.product && typeof body.product === "object" ? body.product : {}
  ) as Record<string, unknown>;
  if (!isHttpUrl(url))
    return { status: 400, data: { error: "Please paste a valid https product link." } };

  // U-24 (2026-09-24): re-extraction is now a FALLBACK, not a hard gate. The
  // admin reviewed the preview and possibly edited the image/gallery — those
  // reviewed URLs win. Only when they are absent do we re-extract from the
  // source, so a slow/down source never blocks or silently swaps the pictures
  // the admin already approved.
  let preview: Preview = {
    found: false,
    provider: "",
    sourceUrl: url,
    title: "",
    description: "",
    tags: [],
    images: [],
    categoryHint: "",
  };
  try {
    preview = await runPreview(url, client);
  } catch {
    // preview failure is non-fatal when the admin supplied explicit fields
  }

  const rawName = String(overrides?.name || preview.title || "").trim();
  if (!rawName)
    return {
      status: 400,
      data: { error: "No product name available. Please fill the name manually." },
    };

  const overridesList = [
    ...(Array.isArray(overrides?.gallery)
      ? (overrides.gallery as unknown[]).filter((u): u is string => typeof u === "string")
      : []),
    ...(typeof overrides?.image === "string" && overrides.image.trim()
      ? [overrides.image.trim()]
      : []),
  ];
  const isStorage = (u: string) =>
    Boolean(supabaseUrl) && u.startsWith(`${supabaseUrl}/storage/v1/`);

  // Upload the FULL gallery (cap 8), reviewed URLs FIRST, source-extracted
  // best-first after. The first success becomes the primary image; every
  // success becomes a gallery entry, so multi-photo rows keep ALL pictures.
  const GALLERY_CAP = 8;
  const uploaded: string[] = [];
  let imageUrl = "";
  for (const candidate of dedupe([...overridesList, ...preview.images]).slice(0, GALLERY_CAP)) {
    if (!isHttpUrl(candidate)) continue;
    // Already ours (re-save of a storage row): keep the URL as-is, no re-host.
    if (isStorage(candidate)) {
      if (!imageUrl) imageUrl = candidate;
      if (!uploaded.includes(candidate)) uploaded.push(candidate);
      continue;
    }
    const img = await downloadImage(candidate);
    if ("error" in img) {
      console.warn("link-import image skip:", img.error);
      continue;
    }
    const path = `${crypto.randomUUID()}-${slugify(rawName)}.${img.ext}`;
    const { error: upErr } = await client.storage.from("product-images").upload(path, img.bytes, {
      contentType: img.contentType,
      upsert: false,
    });
    if (upErr) {
      console.warn("link-import storage skip:", upErr.message);
      continue;
    }
    const storageUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${path}`;
    if (!imageUrl) imageUrl = storageUrl;
    uploaded.push(storageUrl);
  }

  // U-44 (2026-09-26): import DESTINATION — the caller picks "Products"
  // (default, the shop path) or "Project Packages" BEFORE importing, so a row
  // can never strand in the admin-only "Robot Cars" window again. That limbo
  // came from category='Robot Cars' + product_type='Retail kit': admins saw
  // the row in their Projects panel, customers saw it NOWHERE (the shop
  // excludes the category; Projects requires product_type 'Project package').
  const destRaw = String(overrides?.destinationType || overrides?.productType || "").trim();
  const toProjects = destRaw === "Project package" || destRaw === "Project Packages";
  let category = String(overrides?.category || preview.categoryHint || "Retail kit")
    .trim()
    .slice(0, 80);
  // Backstop: the project-family categories are for robot-car builds — an
  // ordinary product import must not claim one even when the extractor's
  // category hint (or a stale editor field) suggests it. MakerWorld hints
  // "Robot Cars" for printed RC-car models, which is exactly how the three
  // stranded rows were born; they re-home to 3D Models.
  if (!toProjects && /^(robot cars|pre-packaged kits)$/i.test(category)) {
    const hint = String(preview.categoryHint || "").trim();
    category = hint && !/^(robot cars|pre-packaged kits)$/i.test(hint) ? hint : "3D Models";
  }
  const productType = toProjects ? "Project package" : "Retail kit";
  // Explicit project_category override wins (e.g. "Remote Controller");
  // otherwise project imports default to the Robo Car family.
  const overridePcat =
    typeof overrides?.projectCategory === "string" && overrides.projectCategory.trim()
      ? overrides.projectCategory.trim().slice(0, 80)
      : "";
  const projectCategory = overridePcat || (toProjects ? "Robo Car" : null);
  const description = String(overrides?.description || preview.description || "")
    .trim()
    .slice(0, 4000);
  const price = Math.max(0, Math.round(Number(overrides?.price) || 0));
  const stock = Math.max(0, Math.round(Number(overrides?.stock) || 0));
  const priceLabel = String(overrides?.priceLabel || "Request quote")
    .trim()
    .slice(0, 60);
  const rawSpecs = Array.isArray(overrides?.specs)
    ? (overrides.specs as unknown[])
    : (preview.specs ?? []);
  const specs = rawSpecs
    .filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
    .map((s) => String(s).trim().slice(0, 120))
    .slice(0, 12);

  const sourceSite = String(preview.provider || "").trim();
  const importMeta: Record<string, unknown> = {
    sourceSite,
    sourceUrl: url,
  };
  const extra = preview.extra && typeof preview.extra === "object" ? preview.extra : {};
  if (typeof extra.creator === "string" && extra.creator) importMeta.creator = extra.creator;
  if (typeof extra.license === "string" && extra.license) importMeta.license = extra.license;
  if (typeof extra.designId === "number") importMeta.designId = extra.designId;
  if (typeof extra.subcategory === "string" && extra.subcategory.trim())
    importMeta.subcategory = extra.subcategory.trim().slice(0, 80);
  if (Array.isArray(preview.tags) && preview.tags.length)
    importMeta.tags = preview.tags.slice(0, 12);
  // U-24 (2026-09-24): structured specs ride along so the organized
  // "Specifications" block renders on the product page, not just the chips.
  if (Array.isArray(preview.structuredSpecs) && preview.structuredSpecs.length)
    importMeta.structuredSpecs = preview.structuredSpecs.slice(0, 12);
  if (extra.stats && typeof extra.stats === "object") importMeta.stats = extra.stats;

  // Dedupe by SOURCE LINK (owner request: each unique link saved once, reused
  // for future imports). If a row already carries this documentation_url,
  // update it in place instead of creating an orphaned duplicate.
  const { data: byUrl } = await client
    .from("products")
    .select("id, name, image_url, gallery")
    .eq("documentation_url", url)
    .maybeSingle();

  const row = {
    name: rawName.slice(0, 120),
    category,
    // U-44: persist the destination so both clients group the row the same
    // way from the moment it is created (see the limbo note above).
    product_type: productType,
    project_category: projectCategory,
    description,
    price,
    price_label: priceLabel,
    stock,
    image_url: imageUrl || byUrl?.image_url || undefined,
    gallery: uploaded.length ? uploaded : (byUrl?.gallery ?? undefined),
    documentation_url: url,
    specs,
    import_meta: importMeta,
    sort_order: Number(overrides?.sortOrder) || 1000,
    updated_at: new Date().toISOString(),
  };

  let targetId = byUrl?.id ?? "";
  if (!targetId) {
    let id = slugify(rawName);
    const { data: existing } = await client
      .from("products")
      .select("documentation_url")
      .eq("id", id)
      .maybeSingle();
    if (existing && existing.documentation_url !== url) {
      id = `${slugify(rawName)}-${Math.random().toString(36).slice(2, 6)}`;
    }
    targetId = id;
  }

  const { data, error } = await client
    .from("products")
    .upsert({ id: targetId, ...row })
    .select();
  if (error) return { status: 500, data: { error: error.message } };
  return { status: 201, data: { product: data?.[0] ?? { id: targetId, ...row }, preview } };
}

/**
 * P1c (2026-09-24): BACKFILL — re-run extraction for every existing product
 * that has a `documentation_url` but an empty gallery, and repopulate gallery
 * (+ a fresh primary image if missing). Admin+ only (it rewrites existing rows
 * in bulk). Returns per-product results so the caller can log failures.
 */
async function runBackfill(client: ReturnType<typeof createClient>, role: string, limit = 0) {
  if (role !== "admin" && role !== "owner")
    return { status: 403, data: { error: "Only admins can run the gallery backfill." } };

  const { data: rows, error } = await client
    .from("products")
    .select("id, name, documentation_url, image_url, gallery")
    .neq("documentation_url", "")
    .order("name", { ascending: true });
  if (error) return { status: 500, data: { error: error.message } };
  if (!rows || rows.length === 0) return { status: 200, data: { processed: 0, results: [] } };

  const targets = (rows as Record<string, unknown>[]).filter((r) => {
    const gallery = Array.isArray(r.gallery) ? (r.gallery as string[]).filter(Boolean) : [];
    return gallery.length === 0;
  });
  // Optional batch bound (see the backfill call site): 0 = no limit.
  const bounded = limit > 0 ? targets.slice(0, limit) : targets;

  const results: Record<string, unknown>[] = [];
  for (const row of bounded) {
    const url = String(row.documentation_url || "").trim();
    const name = String(row.name || "").trim();
    const result: Record<string, unknown> = { id: row.id, url, status: "skipped" };
    if (!isHttpUrl(url)) {
      results.push(result);
      continue;
    }
    try {
      const preview = await runPreview(url, client);
      if (!preview.images || preview.images.length === 0) {
        results.push(result);
        continue;
      }
      const uploaded: string[] = [];
      let imageUrl = "";
      for (const candidate of preview.images.slice(0, 8)) {
        const img = await downloadImage(candidate);
        if ("error" in img) continue;
        const path = `${crypto.randomUUID()}-${slugify(name || "product")}.${img.ext}`;
        const { error: upErr } = await client.storage
          .from("product-images")
          .upload(path, img.bytes, { contentType: img.contentType, upsert: false });
        if (upErr) continue;
        const storageUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${path}`;
        if (!imageUrl) imageUrl = storageUrl;
        uploaded.push(storageUrl);
      }
      if (uploaded.length === 0) {
        results.push(result);
        continue;
      }
      const { error: upErr } = await client
        .from("products")
        .update({ image_url: imageUrl, gallery: uploaded, updated_at: new Date().toISOString() })
        .eq("id", String(row.id));
      result.status = upErr ? `error: ${upErr.message}` : "updated";
      result.imageUrl = imageUrl;
      result.galleryCount = uploaded.length;
      if (upErr) console.warn("link-import backfill update skip:", upErr.message);
    } catch (e) {
      result.status = `error: ${e instanceof Error ? e.message : "internal"}`;
    }
    if (result.status !== "skipped") results.push(result);
  }
  return {
    status: 200,
    data: { processed: bounded.length, totalTargets: targets.length, results },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, apikey",
      },
    });
  }

  try {
    const { client, role, error } = await callerRole(req);
    if (error || !client) return json({ error: error || "Sign in to import products." }, 401);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const action = String(body?.action || "");
    const url = String(body?.url || "");

    if (action === "preview") {
      if (!isHttpUrl(url)) return json({ error: "Please paste a valid https product link." }, 400);
      // U-35: a provider/network failure must come back as a readable message,
      // never as an opaque 500 that the admin UI used to swallow silently.
      try {
        const preview = await runPreview(url, client);
        return json({ preview });
      } catch (error) {
        console.error("link-import preview failed:", error);
        return json(
          {
            error:
              error instanceof Error
                ? `Could not read that page: ${error.message}`
                : "Could not read that page.",
            preview: null,
          },
          502
        );
      }
    }

    if (action === "create") {
      const result = await runCreate(body as Record<string, unknown>, client);
      return json(result.data, result.status);
    }

    if (action === "upload-image") {
      const result = await runUploadImage(body as Record<string, unknown>, client);
      return json(result.data, result.status);
    }

    if (action === "backfill") {
      // U-39 (2026-09-26): optional { limit: n } bounds the batch. The catalog
      // outgrew the edge runtime's 150s idle limit (every target row does live
      // network fetches), so full runs now time out at the gateway. The admin
      // UI sends no limit (full backfill, run repeatedly — already-updated rows
      // are skipped) while the E2E harness sends a tiny limit to prove the RBAC
      // gate without the timeout.
      const rawLimit = Number((body as Record<string, unknown>)?.limit ?? 0);
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 0;
      const result = await runBackfill(client, role, limit);
      return json(result.data, result.status);
    }

    return json({ error: "Unknown action." }, 404);
  } catch (error) {
    console.error("link-import error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});
