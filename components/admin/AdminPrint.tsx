"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { inputClass, cardRow, cardRowText } from "../../lib/styles";
import {
  defaultPrintSettings,
  PRINT_QUOTE_STATUSES,
  quoteStatusLabel,
  type PrintCategory,
  type PrintGalleryItem,
  type PrintMaterial,
  type PrintPromotion,
  type PrintQuoteRequest,
  type PrintSettings,
} from "../../lib/print";
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

const SECTIONS = ["Catalog", "Categories", "Pricing", "Promotions", "Gallery", "Requests"] as const;
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

const oneLine = "min-w-0 text-sm font-bold";

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

export default function AdminPrint({ products, onProductsChange, setMessage, canDelete }: Props) {
  const [section, setSection] = useState<Section>("Catalog");
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<PrintSettings>(defaultPrintSettings);
  const [categories, setCategories] = useState<PrintCategory[]>([]);
  const [materials, setMaterials] = useState<PrintMaterial[]>([]);
  const [promotions, setPromotions] = useState<PrintPromotion[]>([]);
  const [gallery, setGallery] = useState<PrintGalleryItem[]>([]);
  const [quotes, setQuotes] = useState<PrintQuoteRequest[]>([]);

  const [category, setCategory] = useState<PrintCategory>(emptyCategory);
  const [material, setMaterial] = useState<PrintMaterial>(emptyMaterial);
  const [promotion, setPromotion] = useState<PrintPromotion>(emptyPromotion);
  const [galleryItem, setGalleryItem] = useState<PrintGalleryItem>(emptyGallery);
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
                          { id: quote.id, status: quote.status, adminNotes: e.target.value },
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
