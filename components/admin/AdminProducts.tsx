"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { inputClass } from "../../lib/styles";
import type { Product } from "./admin-types";
import { emptyProduct, fields, PAGE_SIZE } from "./admin-types";
import {
  EmptyState,
  Pager,
  SaveBar,
  editorCard,
  editorCardTitle,
  panelListSection,
  panelTitle,
  PanelCard,
} from "./admin-helpers";

type Props = {
  products: Product[];
  onProductsChange: (updater: (prev: Product[]) => Product[]) => void;
  setMessage: (msg: string) => void;
  canDelete: boolean;
};

export default function AdminProducts({
  products,
  onProductsChange,
  setMessage,
  canDelete,
}: Props) {
  const [product, setProduct] = useState<Product>(emptyProduct);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [productPage, setProductPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [extracted, setExtracted] = useState<{
    provider: string;
    images: string[];
    fields: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const linkInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProductPage(1);
  }, [query, category]);

  const categories = Array.from(new Set(products.map((item) => item.category).filter(Boolean)));
  const filteredProducts = products.filter(
    (item) =>
      (category === "All" || item.category === category) &&
      `${item.name} ${item.sku} ${item.id} ${item.category}`
        .toLowerCase()
        .includes(query.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const shownProducts = filteredProducts.slice(
    (productPage - 1) * PAGE_SIZE,
    productPage * PAGE_SIZE
  );

  function updateProduct(key: keyof Product, value: string | number | string[]) {
    setProduct((current) => ({ ...current, [key]: value }));
  }

  async function saveProduct(event?: FormEvent) {
    event?.preventDefault();
    if (!product.id || !product.name) {
      setMessage("Give the product at least an id and a name.");
      return;
    }
    setBusy(true);
    const payload = {
      ...product,
      id: product.id.trim().toLowerCase().replace(/\s+/g, "-"),
      price: Number(product.price),
      stock: Number(product.stock),
      specs:
        typeof product.specs === "string"
          ? String(product.specs).split("\n").filter(Boolean)
          : product.specs,
    };
    try {
      const response = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        // U-24 (2026-09-24): the save path re-hosts foreign images through the
        // link-import edge and can time out on big galleries — surface that
        // instead of dying silently (the old code left the button busy).
        setMessage(result.error || "Could not save product.");
        return;
      }
      onProductsChange((current) =>
        [...current.filter((item) => item.id !== payload.id), payload].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setProduct(emptyProduct);
      setMessage("Product saved.");
    } catch (error) {
      console.error("save failed", error);
      setMessage("Save failed — is your connection ok? Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct(id: string) {
    if (!window.confirm(`Delete ${id}?`)) return;
    const response = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (response.ok) {
      onProductsChange((current) => current.filter((item) => item.id !== id));
      setMessage("Product deleted.");
    }
  }

  async function toggleProductVisibility(item: Product) {
    const payload = { ...item, active: item.active === false };
    try {
      const response = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        onProductsChange((current) => current.map((p) => (p.id === item.id ? payload : p)));
        setMessage(item.active === false ? "Product shown." : "Product hidden.");
      } else {
        const result = await response.json().catch(() => ({}));
        setMessage(result.error || "Could not update visibility.");
      }
    } catch (error) {
      console.error("visibility toggle failed", error);
      setMessage("Update failed — try again.");
    }
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setMessage("");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/admin/upload", { method: "POST", body: form });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.url) {
      setProduct((current) => ({ ...current, image: result.url }));
      setMessage("Image uploaded.");
    } else setMessage(result.error || "Upload failed.");
    setUploading(false);
  }

  async function previewLink(event: FormEvent) {
    event?.preventDefault();
    const url = linkUrl.trim();
    if (!url) {
      setMessage("Paste a product link first.");
      return;
    }
    setImporting(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/link-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", url }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error || "Could not look up that link.");
        return;
      }
      const p = result.preview;
      if (!p?.found) {
        setProduct((current) => ({
          ...current,
          name: current.name || p?.title || "",
          category: current.category || p?.categoryHint || "",
          description: current.description || p?.description || "",
          image: current.image || p?.images?.[0] || "",
        }));
        setExtracted(null);
        setMessage("No details found for that page — fill the fields manually, then save.");
        return;
      }
      setProduct((current) => ({
        ...current,
        id: p.title
          ? String(p.title)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "")
              .slice(0, 60)
          : current.id,
        name: p.title,
        category: p.categoryHint || current.category,
        description: p.description || current.description,
        image: p.images?.[0] || current.image,
        // U-23 (2026-09-24): seed the FULL gallery from the extracted images
        // so every photo is kept ("last link sticks"), not just the cover.
        gallery: (p.images || []).slice(0, 8),
        specs: p.specs || current.specs,
        price: current.price || Number(p.extra?.price ?? 0) || 0,
        priceLabel: current.priceLabel || "Request quote",
        documentationUrl: url,
        // U-24 (2026-09-24): carry the source credit + canonical specs into
        // import_meta so the "Design & source" block and the organized
        // "Specifications" section render on the published page.
        importMeta: {
          sourceSite: p.provider,
          sourceUrl: url,
          ...(p.extra?.creator ? { creator: String(p.extra.creator) } : {}),
          ...(p.extra?.license ? { license: String(p.extra.license) } : {}),
          ...(typeof p.extra?.designId === "number" ? { designId: p.extra.designId } : {}),
          ...(p.extra?.subcategory ? { subcategory: String(p.extra.subcategory) } : {}),
          ...(Array.isArray(p.tags) && p.tags.length ? { tags: p.tags.slice(0, 12) } : {}),
          ...(Array.isArray(p.structuredSpecs) && p.structuredSpecs.length
            ? { structuredSpecs: p.structuredSpecs.slice(0, 12) }
            : {}),
          ...(p.extra?.stats && typeof p.extra.stats === "object" ? { stats: p.extra.stats } : {}),
        },
      }));
      setExtracted({
        provider: p.provider,
        images: (p.images || []).slice(0, 8),
        fields: (p.specs?.filter(Boolean) || []).length,
      });
      setMessage(
        `Extracted ${p.provider} details — review the fields in the editor below, then click "Save product".`
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div
        role="tabpanel"
        id="panel-products"
        aria-labelledby="tab-products"
        className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[1fr_1.3fr]"
      >
        <section aria-label="Product list" className={panelListSection}>
          <PanelCard>
            <h2 className={panelTitle}>Products ({filteredProducts.length})</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, SKU, or id"
                aria-label="Search products"
                className={`w-full ${inputClass}`}
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Category filter"
                className={`w-full sm:w-48 ${inputClass}`}
              >
                <option value="All">All categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 divide-y divide-line">
              {shownProducts.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block line-clamp-2 text-sm">
                      <strong>{item.name}</strong>{" "}
                      <span className="text-slate-400">{item.sku}</span>
                    </span>
                  </div>
                  <span className="flex shrink-0 flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setProduct(item);
                        document
                          .getElementById("product-editor")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="text-xs font-bold text-navy underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setPreviewProduct(item)}
                      className="text-xs font-bold text-slate-500 underline"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => void toggleProductVisibility(item)}
                      className="text-xs font-bold text-ink underline"
                    >
                      {item.active === false ? "Show" : "Hide"}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => removeProduct(item.id)}
                        className="text-xs font-bold text-red-600 underline"
                      >
                        Delete
                      </button>
                    )}
                  </span>
                </div>
              ))}
              {shownProducts.length === 0 && (
                <EmptyState>No products match &ldquo;{query}&rdquo;.</EmptyState>
              )}
            </div>
            <Pager page={productPage} totalPages={totalPages} onPage={setProductPage} />
          </PanelCard>
        </section>
        <section id="product-editor" aria-label="Product editor" className="min-w-0">
          <form onSubmit={previewLink} className={`${editorCard} mb-6`}>
            <h2 className={editorCardTitle}>Import a product by link</h2>
            <p className="mt-1 text-sm text-muted">
              Paste any product page (e.g. a MakerWorld model, an Amazon or shop listing). Click{" "}
              <strong>Extract details</strong> to pull the title, description, specs and images into
              the editor below — then fine-tune and click <strong>Save product</strong>.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                ref={linkInput}
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  if (e.target.value !== linkUrl) setExtracted(null);
                }}
                placeholder="https://makerworld.com/en/models/... or any product page"
                aria-label="Product link"
                className={`w-full ${inputClass}`}
              />
              <button
                type="submit"
                disabled={!linkUrl.trim() || importing}
                className="shrink-0 bg-gold px-5 py-2 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60"
              >
                {importing ? "Extracting…" : "Extract details"}
              </button>
            </div>
            {extracted && (
              <div className="mt-3 flex items-center gap-3 rounded bg-navy/5 p-3">
                {extracted.images[0] ? (
                  <Image
                    src={extracted.images[0]}
                    alt=""
                    width={56}
                    height={56}
                    unoptimized
                    className="shrink-0 rounded border border-line object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded border border-dashed border-line" />
                )}
                <p className="min-w-0 text-sm leading-snug text-ink">
                  <strong className="block">
                    {extracted.fields > 0
                      ? `${extracted.fields} spec line${extracted.fields === 1 ? "" : "s"}`
                      : "Details"}{" "}
                    extracted from {extracted.provider}.
                  </strong>
                  <span className="text-muted">
                    {extracted.images.length} image{extracted.images.length === 1 ? "" : "s"} found
                    {extracted.images.length === 0
                      ? " — you can paste or upload one below"
                      : "; review the fields in the editor below, then click Save product"}
                    .
                  </span>
                </p>
              </div>
            )}
          </form>
          <form onSubmit={saveProduct} className={editorCard}>
            <h2 className={editorCardTitle}>
              {products.some((item) => item.id === product.id)
                ? `Edit ${product.id}`
                : "Add a new product"}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {fields
                .filter((key) => key !== "category")
                .map((key) => (
                  <label key={key} className="min-w-0 text-sm font-bold capitalize">
                    {key}
                    <input
                      value={String(product[key] ?? "")}
                      onChange={(e) =>
                        updateProduct(
                          key,
                          ["price", "stock"].includes(key) ? Number(e.target.value) : e.target.value
                        )
                      }
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                ))}
              <label className="min-w-0 text-sm font-bold capitalize">
                category
                <input
                  list="product-category-suggestions"
                  value={product.category}
                  onChange={(e) => updateProduct("category", e.target.value)}
                  placeholder="Type a category, e.g. 3D Models"
                  aria-label="Category (type or pick)"
                  className={`mt-2 w-full ${inputClass}`}
                />
                <datalist id="product-category-suggestions">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </label>
              <label className="min-w-0 text-sm font-bold capitalize">
                product type
                <select
                  value={product.productType}
                  onChange={(e) => updateProduct("productType", e.target.value)}
                  className={`mt-2 w-full ${inputClass}`}
                >
                  {["Retail kit", "Project package", "Material", "Service package"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-sm font-bold sm:col-span-2">
                Specs, one per line
                <textarea
                  value={
                    Array.isArray(product.specs) ? product.specs.join("\n") : String(product.specs)
                  }
                  onChange={(e) => updateProduct("specs", e.target.value.split("\n"))}
                  rows={4}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <div className="min-w-0 sm:col-span-2">
                <p className="text-sm font-bold">Product image</p>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
                  {product.image && (
                    <Image
                      src={product.image}
                      alt={product.name || "Product preview"}
                      width={64}
                      height={64}
                      unoptimized
                      className="shrink-0 rounded object-cover"
                    />
                  )}
                  <input
                    value={product.image || ""}
                    onChange={(e) => updateProduct("image", e.target.value)}
                    placeholder="https://... or upload below"
                    aria-label="Product image URL"
                    className={`min-w-0 flex-1 ${inputClass}`}
                  />
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadImage(file);
                      e.currentTarget.value = "";
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInput.current?.click()}
                    className="bg-navy px-4 py-2 text-xs font-black text-white disabled:opacity-60"
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <p className="text-sm font-bold">
                  Gallery — one image URL per line{" "}
                  <span className="font-normal text-muted">
                    (first is the cover if no image set; storage URLs are kept as-is on save)
                  </span>
                </p>
                <textarea
                  value={Array.isArray(product.gallery) ? product.gallery.join("\n") : ""}
                  onChange={(e) =>
                    updateProduct(
                      "gallery",
                      e.target.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .slice(0, 8)
                    )
                  }
                  rows={4}
                  placeholder={"https://...\nhttps://..."}
                  aria-label="Product gallery image URLs"
                  className={`mt-2 w-full ${inputClass} font-mono text-xs`}
                />
                {Array.isArray(product.gallery) && product.gallery.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.gallery.map((src, i) => (
                      <div
                        key={`${src}-${i}`}
                        className="relative h-14 w-14 overflow-hidden rounded border border-line bg-mist"
                      >
                        <Image
                          src={src}
                          alt={`Gallery ${i + 1}`}
                          width={56}
                          height={56}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <SaveBar>
              <button
                type="submit"
                disabled={busy || uploading}
                className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save product"}
              </button>
              {product.id && (
                <button
                  type="button"
                  onClick={() => setProduct(emptyProduct)}
                  className="border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-navy"
                >
                  New product
                </button>
              )}
            </SaveBar>
          </form>
        </section>
      </div>
      {previewProduct &&
        createPortal(
          // Portal to <body>: the tab track has transform:translateX + overflow-hidden,
          // which clips any fixed-positioned descendant — the preview rendered off-screen
          // before (owner report 2026-09-22: "admin doesn't show the preview of the cards").
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Product preview"
            onClick={() => setPreviewProduct(null)}
          >
            <article
              className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewProduct(null)}
                className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm transition hover:bg-white"
                aria-label="Close preview"
              >
                ✕
              </button>
              <div className="relative h-48 overflow-hidden rounded-t-2xl bg-ink">
                {previewProduct.image ? (
                  <Image
                    src={previewProduct.image}
                    alt={previewProduct.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                <span className="absolute bottom-3 left-4 max-w-[calc(100%-2rem)] truncate text-xs font-black uppercase tracking-widest text-white">
                  {previewProduct.category}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="truncate text-xs font-black uppercase tracking-widest text-navy">
                  {previewProduct.badge || previewProduct.productType}
                </p>
                <h2 className="mt-2 line-clamp-2 font-display text-xl font-bold leading-snug text-ink">
                  {previewProduct.name}
                </h2>
                <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-muted">
                  {previewProduct.note || previewProduct.description}
                </p>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <strong className="font-display text-lg text-ink">
                    {previewProduct.priceLabel}
                  </strong>
                  <span className="flex gap-2">
                    <a
                      href={`/products/${previewProduct.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark"
                    >
                      View page
                    </a>
                    <button
                      onClick={() => setPreviewProduct(null)}
                      className="rounded-full border border-line px-4 py-2 text-xs font-black text-ink transition hover:border-navy"
                    >
                      Close
                    </button>
                  </span>
                </div>
              </div>
            </article>
          </div>,
          document.body
        )}
    </>
  );
}
