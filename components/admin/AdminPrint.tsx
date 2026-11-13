"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { inputClass, cardRow, cardRowText } from "../../lib/styles";
import {
  defaultPrintSettings,
  formatNPR,
  PRINT_QUOTE_STATUSES,
  PRINT_QUOTE_WON_STATUSES,
  quoteStatusLabel,
  type PrintCategory,
  type PrintGalleryItem,
  type PrintMaterial,
  type PrintPromotion,
  type PrintQuoteRequest,
  type PrintService,
  type PrintSettings,
} from "../../lib/print";
import {
  costPrintJob,
  costingStatus,
  defaultPrintCosting,
  quoteMargin,
  suggestedPrice,
  type PrintCosting,
} from "../../lib/print-costing";
import type { Product } from "./admin-types";
import AdminProducts from "./AdminProducts";
import {
  EmptyState,
  RowActions,
  SaveBar,
  editorCard,
  editorCardTitle,
  panelTitle,
  PanelCard,
} from "./admin-helpers";

// The existing "3D Products" tab becomes a workspace with sub-tabs. The global
// tab strip (and both repos' parity tests) stays untouched: catalog, pricing,
// categories, promotions, gallery and quote requests all live here.

// 2026-11-13 (business layer): Services moved out of a hardcoded component,
// Costs is the internal cost/margin sheet, and Reports turns quote records into
// the KPIs the handoff asks for (revenue, AOV, grams, margin, conversion).
const SECTIONS = [
  "Catalog",
  "Categories",
  "Pricing",
  "Costs",
  "Promotions",
  "Services",
  "Gallery",
  "Requests",
  "Reports",
] as const;
type Section = (typeof SECTIONS)[number];

type Props = {
  products: Product[];
  onProductsChange: (updater: (prev: Product[]) => Product[]) => void;
  setMessage: (msg: string) => void;
  canDelete: boolean;
};

const emptyCategory: PrintCategory = {
  id: "",
  name: "",
  description: "",
  image: "",
  sortOrder: 1000,
  active: true,
};

const emptyMaterial: PrintMaterial = {
  id: "",
  name: "",
  description: "",
  ratePerGram: 0,
  note: "",
  sortOrder: 1000,
  active: true,
};

const emptyPromotion: PrintPromotion = {
  id: "",
  title: "",
  body: "",
  image: "",
  ctaLabel: "Request a quote",
  ctaHref: "#quote",
  discountType: "none",
  discountValue: 0,
  startsAt: null,
  endsAt: null,
  active: false,
  sortOrder: 1000,
};

const emptyGallery: PrintGalleryItem = {
  id: "",
  image: "",
  caption: "",
  category: "",
  featured: false,
  active: true,
  sortOrder: 1000,
};

const emptyService: PrintService & { id?: string } = {
  id: "",
  title: "",
  description: "",
  priceNote: "",
  sortOrder: 1000,
  active: true,
};

const oneLine = "min-w-0 text-sm font-bold";

type NumericCostingKey = Exclude<keyof PrintCosting, "notes">;

const COSTING_FIELDS: Array<{
  key: NumericCostingKey;
  label: string;
  step?: number;
  hint?: string;
}> = [
  {
    key: "filamentCostPerGram",
    label: "Filament cost / gram (NPR)",
    step: 0.01,
    hint: "Supplier price per kg ÷ 1000.",
  },
  { key: "wastagePercent", label: "Waste allowance (%)", hint: "Handoff starting point: 10%." },
  {
    key: "electricityRatePerKwh",
    label: "Electricity / kWh (NPR)",
    step: 0.01,
    hint: "Use your NEA tariff, not a guess.",
  },
  { key: "printerWatts", label: "Printer power (W)" },
  { key: "machineCost", label: "Machine cost (NPR)" },
  { key: "machineLifeHours", label: "Useful machine hours" },
  { key: "maintenancePerHour", label: "Maintenance / hour (NPR)", step: 0.01 },
  { key: "labourPerHour", label: "Operator labour / hour (NPR)", step: 0.01 },
  { key: "packagingPerJob", label: "Packaging / job (NPR)" },
  {
    key: "paymentFeePercent",
    label: "Payment fee (%)",
    step: 0.01,
    hint: "Gateway charge, applied to the subtotal.",
  },
  { key: "overheadPerMonth", label: "Overhead / month (NPR)" },
  { key: "monthlyOrderTarget", label: "Orders / month (target)" },
  {
    key: "targetMarginPercent",
    label: "Target gross margin (%)",
    hint: "price = cost ÷ (1 − margin).",
  },
];

async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/admin/upload", { method: "POST", body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Upload failed.");
  return String(result.url ?? "");
}

function ImageField({
  value,
  onChange,
  label = "Image",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-w-0 sm:col-span-2">
      <p className="text-sm font-bold">{label}</p>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://... or upload"
          aria-label={`${label} URL`}
          className={`min-w-0 flex-1 ${inputClass}`}
        />
        <label className="cursor-pointer rounded-lg bg-navy px-4 py-2.5 text-xs font-black text-white transition hover:bg-navy-dark">
          {busy ? "Uploading..." : "Upload"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              setBusy(true);
              try {
                onChange(await uploadImage(file));
              } catch {
                // The parent message channel owns user-facing errors; the
                // button just returns to idle.
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}

/** Per-quote cost inputs. Local state keeps typing cheap; Save sends all four
 * fields together so a status change never wipes a half-typed figure. */
function QuoteFigures({
  quote,
  costing,
  busy,
  onSave,
}: {
  quote: PrintQuoteRequest;
  costing: PrintCosting;
  busy: boolean;
  onSave: (values: Record<string, unknown>, message: string) => Promise<unknown>;
}) {
  const [amount, setAmount] = useState(String(quote.quotedAmount || ""));
  const [grams, setGrams] = useState(String(quote.estimatedGrams || ""));
  const [hours, setHours] = useState(String(quote.printHours || ""));
  const [reprint, setReprint] = useState(quote.reprint);
  const margin = quoteMargin(costing, {
    quotedAmount: quote.quotedAmount,
    estimatedGrams: quote.estimatedGrams,
    printHours: quote.printHours,
    reprint: quote.reprint,
  });
  return (
    <div className="mt-3 rounded-xl bg-mist/60 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-bold">
          Quoted (NPR)
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={`mt-1 w-28 ${inputClass}`}
          />
        </label>
        <label className="text-xs font-bold">
          Grams
          <input
            type="number"
            min={0}
            value={grams}
            onChange={(event) => setGrams(event.target.value)}
            className={`mt-1 w-24 ${inputClass}`}
          />
        </label>
        <label className="text-xs font-bold">
          Print hours
          <input
            type="number"
            min={0}
            step="0.25"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className={`mt-1 w-24 ${inputClass}`}
          />
        </label>
        <label className="flex min-h-[44px] items-center gap-2 text-xs font-bold">
          <input
            type="checkbox"
            checked={reprint}
            onChange={(event) => setReprint(event.target.checked)}
            className="h-4 w-4 accent-navy"
          />
          Reprinted
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void onSave(
              {
                status: quote.status,
                adminNotes: quote.adminNotes,
                quotedAmount: Number(amount) || 0,
                estimatedGrams: Number(grams) || 0,
                printHours: Number(hours) || 0,
                reprint,
              },
              "Quote figures saved."
            )
          }
          className="min-h-[44px] rounded-lg border border-navy px-4 text-xs font-black text-navy transition hover:bg-white disabled:opacity-60"
        >
          Save figures
        </button>
        <p className="ml-auto text-right text-[11px] leading-4 text-slate-500">
          {margin
            ? `Est. cost ${formatNPR(margin.cost)} · margin ${margin.marginPercent}%`
            : quote.quotedAmount > 0
              ? "Margin hidden: the Costs sheet is incomplete."
              : "Not quoted yet."}
        </p>
      </div>
    </div>
  );
}

/** KPIs the handoff asks for, from quote records + the internal costing sheet. */
function PrintReports({ quotes, costing }: { quotes: PrintQuoteRequest[]; costing: PrintCosting }) {
  const won = quotes.filter((quote) => PRINT_QUOTE_WON_STATUSES.includes(quote.status));
  const closed = quotes.filter(
    (quote) => quote.status !== "cancelled" && quote.status !== "rejected"
  );
  const revenue = won.reduce((sum, quote) => sum + quote.quotedAmount, 0);
  const grams = won.reduce(
    (sum, quote) => sum + quote.estimatedGrams * Math.max(1, quote.quantity),
    0
  );
  const month = new Date().toISOString().slice(0, 7);
  const monthQuotes = quotes.filter((quote) => quote.createdAt.startsWith(month));
  const monthWon = monthQuotes.filter((quote) => PRINT_QUOTE_WON_STATUSES.includes(quote.status));
  const monthRevenue = monthWon.reduce((sum, quote) => sum + quote.quotedAmount, 0);
  const reprints = quotes.filter((quote) => quote.reprint).length;
  const margins = won
    .map((quote) =>
      quoteMargin(costing, {
        quotedAmount: quote.quotedAmount,
        estimatedGrams: quote.estimatedGrams,
        printHours: quote.printHours,
        reprint: quote.reprint,
      })
    )
    .filter((value): value is NonNullable<ReturnType<typeof quoteMargin>> => value !== null);
  const averageMargin =
    margins.length > 0
      ? Math.round(
          (margins.reduce((sum, value) => sum + value.marginPercent, 0) / margins.length) * 10
        ) / 10
      : null;
  const costed = won.filter((quote) => quote.quotedAmount > 0).length;
  const sheet = costingStatus(costing);

  const stats: Array<{ label: string; value: string; note: string }> = [
    {
      label: "Quoted revenue",
      value: formatNPR(revenue),
      note: `${won.length} won quotes (approved → completed)`,
    },
    {
      label: "Average order",
      value: won.length > 0 ? formatNPR(Math.round(revenue / won.length)) : "—",
      note: `${costed} of ${won.length} quotes costed`,
    },
    {
      label: "Enquiry conversion",
      value: closed.length > 0 ? `${Math.round((won.length / closed.length) * 100)}%` : "—",
      note: `${won.length} won / ${closed.length} live enquiries`,
    },
    {
      label: "This month",
      value: formatNPR(monthRevenue),
      note: `${monthWon.length} of ${monthQuotes.length} requests won`,
    },
    {
      label: "Material used",
      value: `${grams.toLocaleString("en-IN")} g`,
      note: "Slicer grams × quantity on won quotes",
    },
    {
      label: "Reprint rate",
      value: quotes.length > 0 ? `${Math.round((reprints / quotes.length) * 100)}%` : "—",
      note: `${reprints} flagged reprint${reprints === 1 ? "" : "s"}`,
    },
    {
      label: "Average gross margin",
      value: averageMargin === null ? "—" : `${averageMargin}%`,
      note:
        averageMargin === null ? "Fill the Costs sheet to see margins" : "Estimate, not net profit",
    },
    {
      label: "Cost per quoted gram",
      value:
        sheet.complete && billedGramCost(costing) > 0
          ? `${formatNPR(Math.round(billedGramCost(costing) * 100) / 100)}/g`
          : "—",
      note: sheet.complete ? "Includes waste allowance" : `Missing: ${sheet.missing.join(", ")}`,
    },
  ];

  return (
    <div className="mt-4 min-w-0 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-line bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">
              {stat.label}
            </p>
            <p className="mt-1 break-words font-display text-xl font-bold text-ink">{stat.value}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">{stat.note}</p>
          </div>
        ))}
      </div>
      <PanelCard>
        <h2 className={panelTitle}>By status</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRINT_QUOTE_STATUSES.map((status) => {
            const count = quotes.filter((quote) => quote.status === status).length;
            return (
              <span
                key={status}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink"
              >
                {quoteStatusLabel(status)} · {count}
              </span>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Figures come from the quote records only. Material cost, margin and cost per gram are
          estimates from the Costs sheet — never present them as audited profit.
        </p>
      </PanelCard>
    </div>
  );
}

/** Filament cost per billed gram (with the waste allowance applied). */
function billedGramCost(costing: PrintCosting): number {
  return costing.filamentCostPerGram * (1 + costing.wastagePercent / 100);
}

export default function AdminPrint({ products, onProductsChange, setMessage, canDelete }: Props) {
  const [section, setSection] = useState<Section>("Catalog");
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<PrintSettings>(defaultPrintSettings);
  const [categories, setCategories] = useState<PrintCategory[]>([]);
  const [materials, setMaterials] = useState<PrintMaterial[]>([]);
  const [promotions, setPromotions] = useState<PrintPromotion[]>([]);
  const [gallery, setGallery] = useState<PrintGalleryItem[]>([]);
  const [services, setServices] = useState<PrintService[]>([]);
  const [costing, setCosting] = useState<PrintCosting>(defaultPrintCosting);
  const [quotes, setQuotes] = useState<PrintQuoteRequest[]>([]);

  const [category, setCategory] = useState<PrintCategory>(emptyCategory);
  const [material, setMaterial] = useState<PrintMaterial>(emptyMaterial);
  const [promotion, setPromotion] = useState<PrintPromotion>(emptyPromotion);
  const [galleryItem, setGalleryItem] = useState<PrintGalleryItem>(emptyGallery);
  const [service, setService] = useState<PrintService & { id?: string }>(emptyService);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/print");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error || "Could not load 3D print content.");
        return;
      }
      setSettings({ ...defaultPrintSettings, ...(data.settings ?? {}) });
      setCategories(data.categories ?? []);
      setMaterials(data.materials ?? []);
      setPromotions(data.promotions ?? []);
      setGallery(data.gallery ?? []);
      setServices(data.services ?? []);
      setCosting({ ...defaultPrintCosting, ...(data.costing ?? {}) });
      setQuotes(data.quotes ?? []);
    } catch {
      setMessage("Could not reach the server to load 3D print content.");
    } finally {
      setLoaded(true);
    }
  }, [setMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(resource: string, item: unknown, success: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/print", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, item }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error || "Could not save the change.");
        return false;
      }
      setMessage(success);
      await load();
      return true;
    } catch {
      setMessage("Could not reach the server to save the change.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(resource: string, id: string, label: string) {
    if (!window.confirm(`Delete ${label}?`)) return;
    const response = await fetch(
      `/api/admin/print?resource=${encodeURIComponent(resource)}&id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Could not delete the item.");
      return;
    }
    setMessage("Deleted.");
    await load();
  }

  async function showFiles(quote: PrintQuoteRequest) {
    if (quote.fileUrls.length === 0) {
      setMessage("No files attached to this request.");
      return;
    }
    const response = await fetch(`/api/admin/print?files=${encodeURIComponent(quote.id)}`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Could not open the files.");
      return;
    }
    const files = Array.isArray(result.files) ? result.files : [];
    files.forEach((file: { url?: string }) => {
      if (file.url) window.open(file.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="mt-4 min-w-0">
      <div className="flex flex-wrap gap-1.5 border-b border-line pb-3">
        {SECTIONS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSection(item)}
            aria-current={section === item ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-xs font-black transition ${
              section === item
                ? "bg-navy text-white"
                : "border border-line bg-white text-ink hover:border-navy"
            }`}
          >
            {item}
            {item === "Requests" && quotes.length > 0 ? ` (${quotes.length})` : ""}
          </button>
        ))}
      </div>

      {section === "Catalog" && (
        <AdminProducts
          kind="models"
          products={products}
          onProductsChange={onProductsChange}
          setMessage={setMessage}
          canDelete={canDelete}
        />
      )}

      {section === "Categories" && (
        <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[1fr_1.3fr]">
          <PanelCard>
            <h2 className={panelTitle}>Categories ({categories.length})</h2>
            <div className="mt-3 divide-y divide-line">
              {categories.map((item) => (
                <div key={item.id} className={`${cardRow} items-center`}>
                  <div className={cardRowText}>
                    <strong>{item.name}</strong>
                    <span className="ml-2 text-xs text-slate-400">{item.id}</span>
                    {!item.active && (
                      <span className="ml-2 text-[10px] font-black uppercase text-red-500">
                        hidden
                      </span>
                    )}
                  </div>
                  <RowActions
                    actions={[
                      { label: "Edit", tone: "navy", onClick: () => setCategory(item) },
                      {
                        label: item.active ? "Hide" : "Show",
                        tone: "ink",
                        onClick: () =>
                          void save(
                            "categories",
                            { ...item, active: !item.active },
                            item.active ? "Category hidden." : "Category shown."
                          ),
                      },
                      {
                        label: "Delete",
                        tone: "red",
                        show: canDelete,
                        onClick: () => void remove("categories", item.id, item.name),
                      },
                    ]}
                  />
                </div>
              ))}
              {loaded && categories.length === 0 && <EmptyState>No categories yet.</EmptyState>}
            </div>
          </PanelCard>

          <form
            className={editorCard}
            onSubmit={async (event: FormEvent) => {
              event.preventDefault();
              if (!category.id || !category.name) {
                setMessage("Category needs an id and a name.");
                return;
              }
              if (await save("categories", category, "Category saved.")) setCategory(emptyCategory);
            }}
          >
            <h2 className={editorCardTitle}>
              {categories.some((item) => item.id === category.id)
                ? "Edit category"
                : "Add category"}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className={oneLine}>
                Id
                <input
                  value={category.id}
                  onChange={(e) => setCategory({ ...category, id: e.target.value })}
                  placeholder="home-decor"
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={oneLine}>
                Name
                <input
                  value={category.name}
                  onChange={(e) => setCategory({ ...category, name: e.target.value })}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={`${oneLine} sm:col-span-2`}>
                Description
                <textarea
                  value={category.description}
                  onChange={(e) => setCategory({ ...category, description: e.target.value })}
                  rows={3}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <ImageField
                label="Category image"
                value={category.image}
                onChange={(image) => setCategory({ ...category, image })}
              />
              <label className={oneLine}>
                Sort order
                <input
                  type="number"
                  value={category.sortOrder}
                  onChange={(e) => setCategory({ ...category, sortOrder: Number(e.target.value) })}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={category.active}
                  onChange={(e) => setCategory({ ...category, active: e.target.checked })}
                  className="h-4 w-4"
                />{" "}
                Active
              </label>
            </div>
            <SaveBar>
              <button
                type="submit"
                disabled={busy}
                className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save category"}
              </button>
              <button
                type="button"
                onClick={() => setCategory(emptyCategory)}
                className="border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-navy"
              >
                New
              </button>
            </SaveBar>
          </form>
        </div>
      )}

      {section === "Pricing" && (
        <div className="mt-4 grid min-w-0 gap-4">
          {/* 2026-11-13: a typed rate is a DRAFT until someone approves it.
              Approval also switches the calculator on; withdrawal switches it
              off and returns every rate to "on request" publicly. */}
          <PanelCard className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">
                Publication status
              </p>
              <p className="mt-1 text-sm font-bold text-ink">
                {settings.pricingStatus === "approved"
                  ? `Rates approved${settings.pricingApprovedAt ? ` on ${new Date(settings.pricingApprovedAt).toLocaleDateString()}` : ""}${settings.pricingApprovedBy ? ` by ${settings.pricingApprovedBy}` : ""}`
                  : 'Draft — customers see "rate on request" and the calculator stays hidden'}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const approved = settings.pricingStatus !== "approved";
                if (
                  approved &&
                  !window.confirm(
                    "Publish the current material rates and switch the calculator on?"
                  )
                )
                  return;
                if (
                  await save(
                    "pricing",
                    { approved },
                    approved ? "Rates published." : "Rates withdrawn."
                  )
                )
                  return;
              }}
              className={`min-h-[44px] rounded-full px-5 text-xs font-black transition disabled:opacity-60 ${
                settings.pricingStatus === "approved"
                  ? "border border-line bg-white text-ink hover:border-red-500"
                  : "bg-navy text-white hover:bg-navy-dark"
              }`}
            >
              {settings.pricingStatus === "approved" ? "Withdraw rates" : "Approve & publish rates"}
            </button>
          </PanelCard>
          <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
            <PanelCard>
              <h2 className={panelTitle}>Materials ({materials.length})</h2>
              <div className="mt-3 divide-y divide-line">
                {materials.map((item) => (
                  <div key={item.id} className={`${cardRow} items-center`}>
                    <div className={cardRowText}>
                      <strong>{item.name}</strong>{" "}
                      <span className="text-xs text-slate-500">
                        {item.ratePerGram > 0 ? `NPR ${item.ratePerGram}/g` : "rate not published"}
                      </span>
                      {!item.active && (
                        <span className="ml-2 text-[10px] font-black uppercase text-red-500">
                          hidden
                        </span>
                      )}
                    </div>
                    <RowActions
                      actions={[
                        { label: "Edit", tone: "navy", onClick: () => setMaterial(item) },
                        {
                          label: item.active ? "Hide" : "Show",
                          tone: "ink",
                          onClick: () =>
                            void save(
                              "materials",
                              { ...item, active: !item.active },
                              item.active ? "Material hidden." : "Material shown."
                            ),
                        },
                        {
                          label: "Delete",
                          tone: "red",
                          show: canDelete,
                          onClick: () => void remove("materials", item.id, item.name),
                        },
                      ]}
                    />
                  </div>
                ))}
              </div>
            </PanelCard>

            <form
              className={editorCard}
              onSubmit={async (event: FormEvent) => {
                event.preventDefault();
                if (!material.id || !material.name) {
                  setMessage("Material needs an id and a name.");
                  return;
                }
                if (await save("materials", material, "Material saved."))
                  setMaterial(emptyMaterial);
              }}
            >
              <h2 className={editorCardTitle}>Material rate</h2>
              <p className="mt-2 text-xs text-muted">
                A rate of 0 keeps the material &quot;rate on request&quot; and stops the calculator
                from pricing it. Rates only appear publicly once you enter them here.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className={oneLine}>
                  Id
                  <input
                    value={material.id}
                    onChange={(e) => setMaterial({ ...material, id: e.target.value })}
                    placeholder="pla"
                    className={`mt-2 w-full ${inputClass}`}
                  />
                </label>
                <label className={oneLine}>
                  Name
                  <input
                    value={material.name}
                    onChange={(e) => setMaterial({ ...material, name: e.target.value })}
                    className={`mt-2 w-full ${inputClass}`}
                  />
                </label>
                <label className={oneLine}>
                  Rate per gram (NPR)
                  <input
                    type="number"
                    min={0}
                    value={material.ratePerGram}
                    onChange={(e) =>
                      setMaterial({ ...material, ratePerGram: Number(e.target.value) })
                    }
                    className={`mt-2 w-full ${inputClass}`}
                  />
                </label>
                <label className={oneLine}>
                  Sort order
                  <input
                    type="number"
                    value={material.sortOrder}
                    onChange={(e) =>
                      setMaterial({ ...material, sortOrder: Number(e.target.value) })
                    }
                    className={`mt-2 w-full ${inputClass}`}
                  />
                </label>
                <label className={`${oneLine} sm:col-span-2`}>
                  Description
                  <textarea
                    value={material.description}
                    onChange={(e) => setMaterial({ ...material, description: e.target.value })}
                    rows={3}
                    className={`mt-2 w-full ${inputClass}`}
                  />
                </label>
                <label className={`${oneLine} sm:col-span-2`}>
                  Customer-facing note
                  <input
                    value={material.note}
                    onChange={(e) => setMaterial({ ...material, note: e.target.value })}
                    className={`mt-2 w-full ${inputClass}`}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={material.active}
                    onChange={(e) => setMaterial({ ...material, active: e.target.checked })}
                    className="h-4 w-4"
                  />{" "}
                  Active
                </label>
              </div>
              <SaveBar>
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Save material"}
                </button>
                <button
                  type="button"
                  onClick={() => setMaterial(emptyMaterial)}
                  className="border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-navy"
                >
                  New
                </button>
              </SaveBar>
            </form>
          </div>

          <form
            className={editorCard}
            onSubmit={(event) => {
              event.preventDefault();
              void save("settings", settings, "Calculator settings saved.");
            }}
          >
            <h2 className={editorCardTitle}>Calculator &amp; order rules</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
                <input
                  type="checkbox"
                  checked={settings.calculatorEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, calculatorEnabled: e.target.checked })
                  }
                  className="h-4 w-4"
                />{" "}
                Show the public calculator (requires at least one material rate)
              </label>
              <label className={oneLine}>
                Minimum order (NPR)
                <input
                  type="number"
                  min={0}
                  value={settings.minimumOrder}
                  onChange={(e) =>
                    setSettings({ ...settings, minimumOrder: Number(e.target.value) })
                  }
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={oneLine}>
                Design base charge (NPR)
                <input
                  type="number"
                  min={0}
                  value={settings.designBaseCharge}
                  onChange={(e) =>
                    setSettings({ ...settings, designBaseCharge: Number(e.target.value) })
                  }
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={`${oneLine} sm:col-span-2`}>
                Materials introduction (shown above PLA/PETG)
                <textarea
                  value={settings.materialsIntro}
                  onChange={(e) => setSettings({ ...settings, materialsIntro: e.target.value })}
                  rows={3}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={`${oneLine} sm:col-span-2`}>
                Estimate disclaimer
                <textarea
                  value={settings.disclaimer}
                  onChange={(e) => setSettings({ ...settings, disclaimer: e.target.value })}
                  rows={2}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={`${oneLine} sm:col-span-2`}>
                Hero image URL
                <input
                  value={settings.heroImage}
                  onChange={(e) => setSettings({ ...settings, heroImage: e.target.value })}
                  placeholder="https://..."
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <div className="sm:col-span-2">
                <p className="text-sm font-bold">Finishing charges</p>
                {settings.finishingCharges.map((charge, index) => (
                  <div key={charge.id} className="mt-2 flex flex-wrap items-end gap-2">
                    <input
                      value={charge.name}
                      aria-label="Finishing name"
                      onChange={(e) => {
                        const next = [...settings.finishingCharges];
                        next[index] = { ...charge, name: e.target.value };
                        setSettings({ ...settings, finishingCharges: next });
                      }}
                      className={`min-w-0 flex-1 ${inputClass}`}
                    />
                    <input
                      type="number"
                      min={0}
                      aria-label="Finishing amount"
                      value={charge.amount}
                      onChange={(e) => {
                        const next = [...settings.finishingCharges];
                        next[index] = { ...charge, amount: Number(e.target.value) };
                        setSettings({ ...settings, finishingCharges: next });
                      }}
                      className={`w-32 ${inputClass}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          finishingCharges: settings.finishingCharges.filter((_, i) => i !== index),
                        })
                      }
                      className="rounded-lg border border-line px-3 py-3 text-xs font-black text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      finishingCharges: [
                        ...settings.finishingCharges,
                        {
                          id: `finish-${settings.finishingCharges.length + 1}`,
                          name: "",
                          amount: 0,
                        },
                      ],
                    })
                  }
                  className="mt-2 rounded-lg border border-line px-4 py-2 text-xs font-black text-ink hover:border-navy"
                >
                  Add finishing charge
                </button>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm font-bold">Bulk tiers (quantity → % off print + finishing)</p>
                {settings.bulkTiers.map((tier, index) => (
                  <div key={index} className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="text-xs font-bold">
                      Min qty
                      <input
                        type="number"
                        min={1}
                        value={tier.minQty}
                        onChange={(e) => {
                          const next = [...settings.bulkTiers];
                          next[index] = { ...tier, minQty: Number(e.target.value) };
                          setSettings({ ...settings, bulkTiers: next });
                        }}
                        className={`ml-2 w-24 ${inputClass}`}
                      />
                    </label>
                    <label className="text-xs font-bold">
                      Discount %
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={tier.discountPercent}
                        onChange={(e) => {
                          const next = [...settings.bulkTiers];
                          next[index] = { ...tier, discountPercent: Number(e.target.value) };
                          setSettings({ ...settings, bulkTiers: next });
                        }}
                        className={`ml-2 w-24 ${inputClass}`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          bulkTiers: settings.bulkTiers.filter((_, i) => i !== index),
                        })
                      }
                      className="rounded-lg border border-line px-3 py-2 text-xs font-black text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      bulkTiers: [...settings.bulkTiers, { minQty: 10, discountPercent: 5 }],
                    })
                  }
                  className="mt-2 rounded-lg border border-line px-4 py-2 text-xs font-black text-ink hover:border-navy"
                >
                  Add tier
                </button>
              </div>
            </div>
            <SaveBar>
              <button
                type="submit"
                disabled={busy}
                className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save settings"}
              </button>
            </SaveBar>
          </form>
        </div>
      )}

      {section === "Promotions" && (
        <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[1fr_1.3fr]">
          <PanelCard>
            <h2 className={panelTitle}>Promotions ({promotions.length})</h2>
            <div className="mt-3 divide-y divide-line">
              {promotions.map((item) => (
                <div key={item.id} className={`${cardRow} items-center`}>
                  <div className={cardRowText}>
                    <strong>{item.title}</strong>
                    <span className="ml-2 text-xs text-slate-500">
                      {item.active ? "live" : "draft"}
                    </span>
                  </div>
                  <RowActions
                    actions={[
                      { label: "Edit", tone: "navy", onClick: () => setPromotion(item) },
                      {
                        label: item.active ? "Unpublish" : "Publish",
                        tone: "ink",
                        onClick: () =>
                          void save(
                            "promotions",
                            { ...item, active: !item.active },
                            item.active ? "Promotion unpublished." : "Promotion published."
                          ),
                      },
                      {
                        label: "Delete",
                        tone: "red",
                        show: canDelete,
                        onClick: () => void remove("promotions", item.id, item.title),
                      },
                    ]}
                  />
                </div>
              ))}
              {loaded && promotions.length === 0 && (
                <EmptyState>No promotions yet — nothing is shown on the site.</EmptyState>
              )}
            </div>
          </PanelCard>

          <form
            className={editorCard}
            onSubmit={async (event: FormEvent) => {
              event.preventDefault();
              if (!promotion.title) {
                setMessage("Promotion needs a title.");
                return;
              }
              if (await save("promotions", promotion, "Promotion saved."))
                setPromotion(emptyPromotion);
            }}
          >
            <h2 className={editorCardTitle}>{promotion.id ? "Edit promotion" : "New promotion"}</h2>
            <p className="mt-2 text-xs text-muted">
              Promotions start unpublished. Set the dates, publish, and the banner appears above the
              catalogue only while it is live.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={`${oneLine} sm:col-span-2`}>
                Title
                <input
                  value={promotion.title}
                  onChange={(e) => setPromotion({ ...promotion, title: e.target.value })}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={`${oneLine} sm:col-span-2`}>
                Body
                <textarea
                  value={promotion.body}
                  onChange={(e) => setPromotion({ ...promotion, body: e.target.value })}
                  rows={3}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={oneLine}>
                CTA label
                <input
                  value={promotion.ctaLabel}
                  onChange={(e) => setPromotion({ ...promotion, ctaLabel: e.target.value })}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={oneLine}>
                CTA link
                <input
                  value={promotion.ctaHref}
                  onChange={(e) => setPromotion({ ...promotion, ctaHref: e.target.value })}
                  placeholder="/3d-printing#quote"
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={oneLine}>
                Discount type
                <select
                  value={promotion.discountType}
                  onChange={(e) =>
                    setPromotion({
                      ...promotion,
                      discountType: e.target.value as PrintPromotion["discountType"],
                    })
                  }
                  className={`mt-2 w-full ${inputClass}`}
                >
                  <option value="none">No percentage</option>
                  <option value="percent">Percent</option>
                  <option value="flat">Flat NPR</option>
                </select>
              </label>
              <label className={oneLine}>
                Discount value
                <input
                  type="number"
                  min={0}
                  value={promotion.discountValue}
                  onChange={(e) =>
                    setPromotion({ ...promotion, discountValue: Number(e.target.value) })
                  }
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={oneLine}>
                Starts
                <input
                  type="datetime-local"
                  value={promotion.startsAt ? promotion.startsAt.slice(0, 16) : ""}
                  onChange={(e) =>
                    setPromotion({
                      ...promotion,
                      startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={oneLine}>
                Ends
                <input
                  type="datetime-local"
                  value={promotion.endsAt ? promotion.endsAt.slice(0, 16) : ""}
                  onChange={(e) =>
                    setPromotion({
                      ...promotion,
                      endsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <ImageField
                label="Promotion image (optional)"
                value={promotion.image}
                onChange={(image) => setPromotion({ ...promotion, image })}
              />
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={promotion.active}
                  onChange={(e) => setPromotion({ ...promotion, active: e.target.checked })}
                  className="h-4 w-4"
                />{" "}
                Published
              </label>
            </div>
            <SaveBar>
              <button
                type="submit"
                disabled={busy}
                className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save promotion"}
              </button>
              <button
                type="button"
                onClick={() => setPromotion(emptyPromotion)}
                className="border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-navy"
              >
                New
              </button>
            </SaveBar>
          </form>
        </div>
      )}

      {section === "Costs" && (
        <div className="mt-4 min-w-0">
          <form
            className={editorCard}
            onSubmit={(event) => {
              event.preventDefault();
              void save("costing", costing, "Costing sheet saved.");
            }}
          >
            <h2 className={editorCardTitle}>Internal costing sheet</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Staff-only — this never reaches the website or the app. Leave a field at 0 until you
              have a real figure; the reports hide margin rather than guess.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COSTING_FIELDS.map((field) => (
                <label key={field.key} className={oneLine}>
                  {field.label}
                  <input
                    type="number"
                    min={0}
                    step={field.step ?? 1}
                    value={costing[field.key]}
                    onChange={(event) =>
                      setCosting({ ...costing, [field.key]: Number(event.target.value) })
                    }
                    className={`mt-2 w-full ${inputClass}`}
                  />
                  {field.hint && (
                    <span className="mt-1 block text-[11px] font-medium leading-4 text-slate-500">
                      {field.hint}
                    </span>
                  )}
                </label>
              ))}
              <label className={`${oneLine} sm:col-span-2 lg:col-span-3`}>
                Internal notes
                <textarea
                  value={costing.notes}
                  onChange={(event) => setCosting({ ...costing, notes: event.target.value })}
                  rows={2}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
            </div>
            <SaveBar>
              <button
                type="submit"
                disabled={busy}
                className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save costing"}
              </button>
            </SaveBar>
          </form>

          <PanelCard className="mt-4">
            <h3 className="font-display text-lg font-bold">Worked example</h3>
            <p className="mt-1 text-xs text-slate-500">
              100 g part, 2 print hours, 15 minutes of labour — recalculated as you type.
            </p>
            {(() => {
              const job = costPrintJob(costing, { grams: 100, printHours: 2, labourHours: 0.25 });
              const price = suggestedPrice(job.total, costing.targetMarginPercent);
              return (
                <>
                  <dl className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                    {[
                      ["Material (incl. waste)", job.materialCost],
                      ["Electricity", job.electricityCost],
                      ["Machine time", job.machineCost],
                      ["Maintenance", job.maintenanceCost],
                      ["Labour", job.labourCost],
                      ["Packaging", job.packagingCost],
                      ["Payment fee", job.paymentFee],
                      ["Overhead allocation", job.overheadAllocation],
                      ["Total cost", job.total],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="flex justify-between gap-3 border-b border-line pb-1"
                      >
                        <dt className="text-muted">{label}</dt>
                        <dd className="font-bold text-ink">{formatNPR(Number(value))}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-sm font-bold text-ink">
                    Suggested price at {costing.targetMarginPercent}% margin: {formatNPR(price)}
                  </p>
                  {!job.complete && (
                    <p className="mt-1 text-xs font-bold text-amber-700">
                      Incomplete: {job.missing.join(", ")}. Treat the figures above as partial.
                    </p>
                  )}
                </>
              );
            })()}
          </PanelCard>
        </div>
      )}

      {section === "Services" && (
        <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[1fr_1.3fr]">
          <PanelCard>
            <h2 className={panelTitle}>Custom services ({services.length})</h2>
            <div className="mt-3 divide-y divide-line">
              {services.map((item) => (
                <div key={item.id} className={`${cardRow} items-center`}>
                  <div className={cardRowText}>
                    <strong>{item.title}</strong>
                    {item.priceNote && (
                      <span className="ml-2 text-xs text-slate-500">{item.priceNote}</span>
                    )}
                    {!item.active && (
                      <span className="ml-2 text-[10px] font-black uppercase text-red-500">
                        hidden
                      </span>
                    )}
                  </div>
                  <RowActions
                    actions={[
                      { label: "Edit", tone: "navy", onClick: () => setService(item) },
                      {
                        label: item.active ? "Hide" : "Show",
                        tone: "ink",
                        onClick: () =>
                          void save(
                            "services",
                            { ...item, active: !item.active },
                            item.active ? "Service hidden." : "Service shown."
                          ),
                      },
                      {
                        label: "Delete",
                        tone: "red",
                        show: canDelete,
                        onClick: () => void remove("services", item.id, item.title),
                      },
                    ]}
                  />
                </div>
              ))}
              {loaded && services.length === 0 && (
                <EmptyState>
                  No services yet — the website falls back to the six bundled ones (design, repair,
                  material guidance, scaling, batches, post-processing).
                </EmptyState>
              )}
            </div>
          </PanelCard>

          <form
            className={editorCard}
            onSubmit={async (event: FormEvent) => {
              event.preventDefault();
              if (!service.title.trim()) {
                setMessage("Service needs a title.");
                return;
              }
              if (await save("services", service, "Service saved."))
                setService({ ...emptyService });
            }}
          >
            <h2 className={editorCardTitle}>{service.id ? "Edit service" : "Add service"}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className={oneLine}>
                Title
                <input
                  value={service.title}
                  onChange={(event) => setService({ ...service, title: event.target.value })}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={oneLine}>
                Price note
                <input
                  value={service.priceNote}
                  onChange={(event) => setService({ ...service, priceNote: event.target.value })}
                  placeholder="From NPR 2,500"
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={`${oneLine} sm:col-span-2`}>
                Description
                <textarea
                  value={service.description}
                  onChange={(event) => setService({ ...service, description: event.target.value })}
                  rows={3}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={oneLine}>
                Sort order
                <input
                  type="number"
                  value={service.sortOrder}
                  onChange={(event) =>
                    setService({ ...service, sortOrder: Number(event.target.value) })
                  }
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={service.active}
                  onChange={(event) => setService({ ...service, active: event.target.checked })}
                  className="h-4 w-4"
                />{" "}
                Active
              </label>
            </div>
            <SaveBar>
              <button
                type="submit"
                disabled={busy}
                className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save service"}
              </button>
              <button
                type="button"
                onClick={() => setService({ ...emptyService })}
                className="border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-navy"
              >
                New
              </button>
            </SaveBar>
          </form>
        </div>
      )}

      {section === "Reports" && <PrintReports quotes={quotes} costing={costing} />}

      {section === "Gallery" && (
        <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[1fr_1.3fr]">
          <PanelCard>
            <h2 className={panelTitle}>Gallery ({gallery.length})</h2>
            <div className="mt-3 divide-y divide-line">
              {gallery.map((item) => (
                <div key={item.id} className={`${cardRow} items-center`}>
                  <div className={cardRowText}>
                    <strong>{item.caption || item.image}</strong>
                    {!item.active && (
                      <span className="ml-2 text-[10px] font-black uppercase text-red-500">
                        hidden
                      </span>
                    )}
                  </div>
                  <RowActions
                    actions={[
                      { label: "Edit", tone: "navy", onClick: () => setGalleryItem(item) },
                      {
                        label: item.active ? "Hide" : "Show",
                        tone: "ink",
                        onClick: () =>
                          void save(
                            "gallery",
                            { ...item, active: !item.active },
                            item.active ? "Image hidden." : "Image shown."
                          ),
                      },
                      {
                        label: "Delete",
                        tone: "red",
                        show: canDelete,
                        onClick: () => void remove("gallery", item.id, "this image"),
                      },
                    ]}
                  />
                </div>
              ))}
              {loaded && gallery.length === 0 && (
                <EmptyState>No gallery images yet — the section stays hidden.</EmptyState>
              )}
            </div>
          </PanelCard>

          <form
            className={editorCard}
            onSubmit={async (event: FormEvent) => {
              event.preventDefault();
              if (!galleryItem.image) {
                setMessage("Add an image first.");
                return;
              }
              if (await save("gallery", galleryItem, "Gallery item saved."))
                setGalleryItem(emptyGallery);
            }}
          >
            <h2 className={editorCardTitle}>
              {galleryItem.id ? "Edit gallery item" : "Add gallery image"}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ImageField
                label="Image"
                value={galleryItem.image}
                onChange={(image) => setGalleryItem({ ...galleryItem, image })}
              />
              <label className={oneLine}>
                Caption
                <input
                  value={galleryItem.caption}
                  onChange={(e) => setGalleryItem({ ...galleryItem, caption: e.target.value })}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={oneLine}>
                Category label
                <input
                  value={galleryItem.category}
                  onChange={(e) => setGalleryItem({ ...galleryItem, category: e.target.value })}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className={oneLine}>
                Sort order
                <input
                  type="number"
                  value={galleryItem.sortOrder}
                  onChange={(e) =>
                    setGalleryItem({ ...galleryItem, sortOrder: Number(e.target.value) })
                  }
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={galleryItem.active}
                  onChange={(e) => setGalleryItem({ ...galleryItem, active: e.target.checked })}
                  className="h-4 w-4"
                />{" "}
                Visible
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={galleryItem.featured}
                  onChange={(e) => setGalleryItem({ ...galleryItem, featured: e.target.checked })}
                  className="h-4 w-4"
                />{" "}
                Featured
              </label>
            </div>
            <SaveBar>
              <button
                type="submit"
                disabled={busy}
                className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save image"}
              </button>
              <button
                type="button"
                onClick={() => setGalleryItem(emptyGallery)}
                className="border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-navy"
              >
                New
              </button>
            </SaveBar>
          </form>
        </div>
      )}

      {section === "Requests" && (
        <div className="mt-4 min-w-0">
          <PanelCard>
            <h2 className={panelTitle}>Quote requests ({quotes.length})</h2>
            <div className="mt-3 space-y-3">
              {quotes.map((quote) => (
                <article key={quote.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-ink">
                        {quote.name}{" "}
                        <span className="font-medium text-slate-500">
                          · {quote.email}
                          {quote.phone ? ` · ${quote.phone}` : ""}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(quote.createdAt).toLocaleString()} · qty {quote.quantity}
                        {quote.material ? ` · ${quote.material}` : ""}
                        {quote.dimensions ? ` · ${quote.dimensions}` : ""}
                        {quote.timeline ? ` · by ${quote.timeline}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-mist px-3 py-1 text-[11px] font-black uppercase tracking-wide text-navy">
                      {quoteStatusLabel(quote.status)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                    {quote.description}
                  </p>
                  {quote.referenceUrls.length > 0 && (
                    <p className="mt-2 text-xs text-navy">
                      {quote.referenceUrls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mr-3 underline"
                        >
                          Reference link
                        </a>
                      ))}
                    </p>
                  )}
                  {/* Quote figures (2026-11-13): the amount actually quoted, the
                      slicer grams/hours the price was built from, and whether the
                      job had to be reprinted. Feeds the Reports tab. */}
                  <QuoteFigures
                    quote={quote}
                    costing={costing}
                    busy={busy}
                    onSave={(values, message) =>
                      save("quotes", { id: quote.id, ...values }, message)
                    }
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={quote.status}
                      aria-label={`Status for ${quote.name}`}
                      onChange={(e) =>
                        void save(
                          "quotes",
                          { id: quote.id, status: e.target.value, adminNotes: quote.adminNotes },
                          "Quote status updated."
                        )
                      }
                      className={inputClass}
                    >
                      {PRINT_QUOTE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {quoteStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void showFiles(quote)}
                      disabled={quote.fileUrls.length === 0}
                      className="rounded-lg border border-line px-4 py-2.5 text-xs font-black text-ink transition hover:border-navy disabled:opacity-40"
                    >
                      Open files ({quote.fileUrls.length})
                    </button>
                    <a
                      href={`mailto:${quote.email}?subject=${encodeURIComponent("Your 3D print quote")}`}
                      className="rounded-lg border border-line px-4 py-2.5 text-xs font-black text-ink transition hover:border-navy"
                    >
                      Reply by email
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        void remove("quotes", quote.id, `the request from ${quote.name}`)
                      }
                      className="rounded-lg border border-line px-4 py-2.5 text-xs font-black text-red-600 transition hover:border-red-500"
                      hidden={!canDelete}
                    >
                      Delete
                    </button>
                  </div>
                  <label className="mt-3 block text-xs font-bold">
                    Internal notes
                    <textarea
                      defaultValue={quote.adminNotes}
                      rows={2}
                      onBlur={(e) => {
                        if (e.target.value === quote.adminNotes) return;
                        void save(
                          "quotes",
                          {
                            id: quote.id,
                            status: quote.status,
                            adminNotes: e.target.value,
                            quotedAmount: quote.quotedAmount,
                            estimatedGrams: quote.estimatedGrams,
                            printHours: quote.printHours,
                            reprint: quote.reprint,
                          },
                          "Notes saved."
                        );
                      }}
                      className={`mt-1 w-full ${inputClass}`}
                    />
                  </label>
                </article>
              ))}
              {loaded && quotes.length === 0 && <EmptyState>No quote requests yet.</EmptyState>}
            </div>
          </PanelCard>
        </div>
      )}
    </div>
  );
}
