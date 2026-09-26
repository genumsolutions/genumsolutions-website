"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { inputClass } from "../../lib/styles";
import type { Product } from "./admin-types";
import { emptyProduct, PAGE_SIZE } from "./admin-types";
import { Pager, focusEditor, editorCard, editorCardTitle } from "./admin-helpers";

type Props = {
  products: Product[];
  onProductsChange: (updater: (prev: Product[]) => Product[]) => void;
  setMessage: (msg: string) => void;
  canDelete: boolean;
};

function ProjectEditor({
  product,
  onChange,
  onSave,
  onReset,
  busy,
  categories,
}: {
  product: Product;
  onChange: (product: Product) => void;
  onSave: (event?: FormEvent) => void;
  onReset: () => void;
  busy: boolean;
  categories: string[];
}) {
  function setField<K extends keyof Product>(key: K, value: Product[K]) {
    onChange({ ...product, [key]: value });
  }

  const textFields: { key: keyof Product; label: string }[] = [
    { key: "id", label: "Project ID" },
    { key: "name", label: "Project name" },
    { key: "sku", label: "SKU / package code" },
    { key: "priceLabel", label: "Price label" },
    { key: "note", label: "Short summary" },
    { key: "audience", label: "Ideal audience" },
    { key: "difficulty", label: "Difficulty" },
    { key: "warranty", label: "Warranty / support" },
    { key: "delivery", label: "Delivery / lead time" },
  ];

  return (
    <section id="project-package-editor" aria-label="Project package editor" className={editorCard}>
      <form onSubmit={onSave}>
        <h2 className="font-display text-2xl font-bold">
          {product.id ? `Edit ${product.name}` : "Add a project package"}
        </h2>
        <p className="mt-1 text-sm text-muted">
          These fields are stored in the shared products table and appear on the public project page
          and native app.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {textFields.map(({ key, label }) => (
            <label key={key} className="min-w-0 text-sm font-bold">
              {label}
              <input
                value={String(product[key] ?? "")}
                onChange={(event) => setField(key, event.target.value as Product[typeof key])}
                className={`mt-2 w-full ${inputClass}`}
              />
            </label>
          ))}
          <label className="min-w-0 text-sm font-bold">
            Category
            <select
              value={product.category || ""}
              onChange={(event) => setField("category", event.target.value)}
              className={`mt-2 w-full ${inputClass}`}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Price (NPR)
            <input
              type="number"
              min="0"
              value={product.price}
              onChange={(event) => setField("price", Number(event.target.value))}
              className={`mt-2 w-full ${inputClass}`}
            />
          </label>
          <label className="text-sm font-bold">
            Stock / available units
            <input
              type="number"
              min="0"
              value={product.stock}
              onChange={(event) => setField("stock", Number(event.target.value))}
              className={`mt-2 w-full ${inputClass}`}
            />
          </label>
          <label className="sm:col-span-2 text-sm font-bold">
            Full project description
            <textarea
              value={product.description}
              onChange={(event) => setField("description", event.target.value)}
              rows={6}
              className={`mt-2 w-full ${inputClass}`}
            />
          </label>
          <label className="sm:col-span-2 text-sm font-bold">
            Project overview
            <textarea
              value={product.projectOverview || ""}
              onChange={(event) => setField("projectOverview", event.target.value)}
              rows={4}
              className={`mt-2 w-full ${inputClass}`}
            />
          </label>
          {(
            [
              ["objectives", "Objectives"],
              ["materialsRequired", "Materials required"],
              ["learningOutcomes", "Learning outcomes"],
              ["buildSteps", "Build steps"],
              ["controlMethods", "Control methods"],
              ["prerequisites", "Prerequisites"],
              ["deliverables", "Deliverables"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm font-bold">
              {label} (one per line)
              <textarea
                value={(product[key] || []).join("\n")}
                onChange={(event) => setField(key, event.target.value.split("\n").filter(Boolean))}
                rows={4}
                className={`mt-2 w-full ${inputClass}`}
              />
            </label>
          ))}
          <label className="text-sm font-bold">
            Estimated duration
            <input
              value={product.estimatedDuration || ""}
              onChange={(event) => setField("estimatedDuration", event.target.value)}
              placeholder="e.g. 2 weeks"
              className={`mt-2 w-full ${inputClass}`}
            />
          </label>
          <label className="text-sm font-bold">
            Source folder / reference
            <input
              value={product.sourceFolder || ""}
              onChange={(event) => setField("sourceFolder", event.target.value)}
              className={`mt-2 w-full ${inputClass}`}
            />
          </label>
          <label className="text-sm font-bold">
            Documentation URL
            <input
              value={product.documentationUrl || ""}
              onChange={(event) => setField("documentationUrl", event.target.value)}
              className={`mt-2 w-full ${inputClass}`}
            />
          </label>
          <label className="text-sm font-bold">
            Video URL
            <input
              value={product.videoUrl || ""}
              onChange={(event) => setField("videoUrl", event.target.value)}
              className={`mt-2 w-full ${inputClass}`}
            />
          </label>
          <label className="sm:col-span-2 text-sm font-bold">
            Maintenance and safety notes
            <textarea
              value={product.maintenanceNotes || ""}
              onChange={(event) => setField("maintenanceNotes", event.target.value)}
              rows={4}
              className={`mt-2 w-full ${inputClass}`}
            />
          </label>
          <label className="sm:col-span-2 text-sm font-bold">
            Components, technologies, and deliverables (one per line)
            <textarea
              value={product.specs.join("\n")}
              onChange={(event) =>
                setField("specs", event.target.value.split("\n").filter(Boolean))
              }
              rows={6}
              className={`mt-2 w-full ${inputClass}`}
            />
          </label>
          <label className="sm:col-span-2 text-sm font-bold">
            Image URL
            <input
              value={product.image || ""}
              onChange={(event) => setField("image", event.target.value)}
              placeholder="Supabase Storage or public image URL"
              className={`mt-2 w-full ${inputClass}`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
            <input
              type="checkbox"
              checked={product.active !== false}
              onChange={(event) => setField("active", event.target.checked)}
            />{" "}
            Visible to customers
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy}
            className="bg-gold px-5 py-3 text-sm font-black text-ink disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save project package"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="border border-line px-5 py-3 text-sm font-black text-ink"
          >
            New project
          </button>
        </div>
      </form>
    </section>
  );
}

export default function AdminProjectPackages({
  products,
  onProductsChange,
  setMessage,
  canDelete,
}: Props) {
  const [product, setProduct] = useState<Product>(emptyProduct);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [projectCategory, setProjectCategory] = useState("All");
  const [projectQuery, setProjectQuery] = useState("");
  const [projectPage, setProjectPage] = useState(1);
  const [busy, setBusy] = useState(false);

  // U-45: component linker state for the OPEN project editor.
  const [linkerLinks, setLinkerLinks] = useState<{ productId: string; quantity: number }[]>([]);
  const [linkerSuggestions, setLinkerSuggestions] = useState<
    {
      productId: string | null;
      label: string;
      quantity: number;
      score: number;
      matchedBy: string;
    }[]
  >([]);
  const [linkerBusy, setLinkerBusy] = useState(false);

  // Load saved links + fresh suggestions whenever a project opens in the editor.
  useEffect(() => {
    if (!product.id || product.productType !== "Project package") {
      setLinkerLinks([]);
      setLinkerSuggestions([]);
      return;
    }
    let active = true;
    setLinkerBusy(true);
    fetch(`/api/admin/project-components?projectId=${encodeURIComponent(product.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const saved: { productId: string; quantity: number }[] = data.components ?? [];
        if (saved.length > 0) {
          setLinkerLinks(saved);
        } else {
          // Pre-fill from the matcher's confident suggestions; staff edits.
          setLinkerLinks(
            (data.suggestions ?? [])
              .filter((s: { productId: string | null }) => s.productId)
              .map((s: { productId: string; quantity: number }) => ({
                productId: s.productId,
                quantity: s.quantity,
              }))
          );
        }
        setLinkerSuggestions(data.suggestions ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLinkerBusy(false);
      });
    return () => {
      active = false;
    };
  }, [product.id, product.productType]);

  async function saveComponentLinks() {
    if (!product.id) return;
    setLinkerBusy(true);
    const response = await fetch("/api/admin/project-components", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: product.id, components: linkerLinks }),
    });
    const result = await response.json().catch(() => ({}));
    setLinkerBusy(false);
    setMessage(
      response.ok
        ? `Component links saved (${result.saved ?? linkerLinks.length}).`
        : result.error || "Could not save component links."
    );
  }

  const projectProducts = products.filter(
    (item) =>
      item.productType === "Project package" ||
      item.category === "Robot Cars" ||
      item.category === "Pre-packaged Kits"
  );
  const projectCategories = Array.from(new Set(projectProducts.map((item) => item.category)));
  const filteredProjects = projectProducts.filter((item) => {
    const matchesCategory = projectCategory === "All" || item.category === projectCategory;
    const needle = projectQuery.trim().toLowerCase();
    return (
      matchesCategory &&
      (!needle ||
        `${item.name} ${item.sku} ${item.id} ${item.description}`.toLowerCase().includes(needle))
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const shownProjects = filteredProjects.slice(
    (projectPage - 1) * PAGE_SIZE,
    projectPage * PAGE_SIZE
  );

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
    const response = await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Could not save product.");
      setBusy(false);
      return;
    }
    onProductsChange((current) =>
      [...current.filter((item) => item.id !== payload.id), payload].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    setProduct(emptyProduct);
    setMessage("Product saved.");
    setBusy(false);
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
    const response = await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok)
      onProductsChange((current) => current.map((p) => (p.id === item.id ? payload : p)));
  }

  return (
    <>
      <div
        role="tabpanel"
        id="panel-project-packages"
        aria-labelledby="tab-project-packages"
        className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[1fr_1.3fr]"
      >
        <section aria-label="Project package list" className="min-w-0 space-y-6">
          <div className="min-w-0 border-t-2 border-ink bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold">
                Project Packages ({filteredProjects.length})
              </h2>
              <select
                value={projectCategory}
                onChange={(e) => {
                  setProjectCategory(e.target.value);
                  setProjectPage(1);
                }}
                className={inputClass}
                aria-label="Project category"
              >
                <option value="All">All categories</option>
                {projectCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={projectQuery}
              onChange={(e) => {
                setProjectQuery(e.target.value);
                setProjectPage(1);
              }}
              placeholder="Search by name, SKU, or id"
              aria-label="Search project packages"
              className={`mt-3 w-full ${inputClass}`}
            />
            <div className="mt-3 divide-y divide-line">
              {shownProjects.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block line-clamp-2 text-sm">
                      <strong>{item.name}</strong>{" "}
                      <span className="text-slate-400">{item.sku}</span>
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wide text-gold">
                      {item.inventoryType || "Catalog"} · {item.priceLabel}
                    </span>
                  </div>
                  <span className="flex shrink-0 flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setProduct(item);
                        focusEditor("project-package-editor");
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
              {shownProjects.length === 0 && (
                <p className="py-3 text-sm text-slate-500">
                  No project packages match &ldquo;{projectQuery}&rdquo;.
                </p>
              )}
            </div>
            <Pager page={projectPage} totalPages={totalPages} onPage={setProjectPage} />
          </div>
        </section>
        <section
          id="project-package-editor"
          aria-label="Project package editor"
          className="min-w-0"
        >
          <ProjectEditor
            product={product}
            onChange={setProduct}
            onSave={saveProduct}
            onReset={() =>
              setProduct({
                ...emptyProduct,
                productType: "Project package",
                category: "Project Packages",
              })
            }
            busy={busy}
            categories={
              projectCategories.length ? projectCategories : ["Project Packages", "Robot Cars"]
            }
          />
          {/* U-45: component linker — only for a SAVED project row (needs an
              id to hang links on). Suggestions come from the matcher; staff
              adjusts quantities / removes rows, then saves. */}
          {product.id && product.productType === "Project package" && (
            <div className={`${editorCard} mt-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className={editorCardTitle}>Components used in this project</h2>
                <button
                  type="button"
                  onClick={() => void saveComponentLinks()}
                  disabled={linkerBusy}
                  className="rounded-full bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark disabled:opacity-60"
                >
                  {linkerBusy ? "Saving…" : "Save component links"}
                </button>
              </div>
              <p className="mt-1 text-sm text-muted">
                Pre-filled from the project&rsquo;s materials list where the catalog matched. Link
                the exact Electronic Products a builder needs — they appear (with quantities) on the
                project&rsquo;s public page.
              </p>
              {linkerLinks.length === 0 && !linkerBusy && (
                <p className="mt-3 text-sm text-slate-500">
                  No components linked yet — add from the suggestions below.
                </p>
              )}
              <ul className="mt-3 space-y-2">
                {linkerLinks.map((link) => {
                  const linked = products.find((p) => p.id === link.productId);
                  return (
                    <li
                      key={link.productId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-line px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                        {linked?.name ?? link.productId}
                      </span>
                      <label className="flex items-center gap-2 text-xs font-black text-muted">
                        Qty
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={link.quantity}
                          onChange={(e) =>
                            setLinkerLinks((current) =>
                              current.map((l) =>
                                l.productId === link.productId
                                  ? {
                                      ...l,
                                      quantity: Math.max(
                                        1,
                                        Math.min(99, Number(e.target.value) || 1)
                                      ),
                                    }
                                  : l
                              )
                            )
                          }
                          className="w-16 rounded border border-line px-2 py-1 text-right text-sm text-ink"
                          aria-label={`Quantity for ${linked?.name ?? link.productId}`}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setLinkerLinks((current) =>
                            current.filter((l) => l.productId !== link.productId)
                          )
                        }
                        className="text-xs font-bold text-red-600 underline"
                        aria-label={`Remove ${linked?.name ?? link.productId}`}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
              {linkerSuggestions.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Matcher suggestions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {linkerSuggestions.map((s) => {
                      const already = linkerLinks.some((l) => l.productId === s.productId);
                      return (
                        <button
                          key={s.label}
                          type="button"
                          disabled={!s.productId || already}
                          onClick={() => {
                            if (!s.productId) return;
                            setLinkerLinks((current) => [
                              ...current,
                              { productId: s.productId as string, quantity: s.quantity },
                            ]);
                          }}
                          title={
                            s.productId
                              ? `matched by ${s.matchedBy} (score ${s.score.toFixed(2)})`
                              : "no catalog match — generic part"
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                            already
                              ? "border-line bg-mist text-slate-400"
                              : s.productId
                                ? "border-navy bg-white text-navy hover:bg-mist"
                                : "cursor-not-allowed border-dashed border-line text-slate-400"
                          }`}
                        >
                          {already ? "✓ " : "+ "}
                          {s.label}
                          {s.quantity > 1 ? ` (×${s.quantity})` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      {previewProduct &&
        createPortal(
          // Portal to <body>: the tab track's transform + overflow-hidden clips fixed
          // descendants — without it the preview renders off-screen (owner report 2026-09-22).
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Project package preview"
            onClick={() => setPreviewProduct(null)}
          >
            <article
              className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
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
                  {previewProduct.badge || "Project Package"}
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
