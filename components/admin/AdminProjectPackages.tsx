"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { inputClass, cardRow, cardRowText } from "../../lib/styles";
import { PROJECT_CATEGORIES } from "../../lib/project-catalog";
import {
  type ProjectPricing,
  type ProjectPricingExtra,
  type ProjectPricingBulkTier,
  defaultProjectPricing,
  formatNPR,
  estimateProject,
} from "../../lib/project-pricing";
import type { Product } from "./admin-types";
import { emptyProduct, PAGE_SIZE } from "./admin-types";
import { Pager, focusEditor, editorCard, editorCardTitle, panelCard } from "./admin-helpers";
import { revalidateProjectPricing } from "../../lib/revalidate";

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
            Project category
            <select
              value={product.project_category || ""}
              onChange={(event) => setField("project_category", event.target.value)}
              className={`mt-2 w-full ${inputClass}`}
              aria-label="Project category (groups projects on the public page)"
            >
              <option value="">— not set —</option>
              {PROJECT_CATEGORIES.filter((c) => c.slug !== "remote-controller")
                .slice()
                .map((cat) => (
                  <option key={cat.slug} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted">
              Groups this project on the public /projects page: Robo Car, Smart Home, Smart Farm,
              Smart City, Smart Dustbin, or Aerial Drones. Rolls up into the wheeled, smart, and
              drone buckets the owner asked for.
            </span>
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
            <span className="mt-1 block text-xs font-normal text-muted">
              Retail items: 0 shows as out of stock/unavailable for direct purchase. Project
              packages use quote flow regardless of stock.
            </span>
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
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out">("all");
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

  // 2026-11-13: project pricing (mirrors the 3D print studio pricing panel).
  // Loaded when a saved project opens; saved alongside the product via the
  // admin project-pricing route. Draft by default — prices stay hidden until
  // an admin approves them.
  const [projectPricing, setProjectPricing] = useState<ProjectPricing>(defaultProjectPricing);
  const [pricingBusy, setPricingBusy] = useState(false);

  useEffect(() => {
    if (!product.id || product.productType !== "Project package") {
      setProjectPricing(defaultProjectPricing);
      return;
    }
    let active = true;
    fetch(`/api/admin/project-pricing?projectId=${encodeURIComponent(product.id)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.pricing) setProjectPricing(data.pricing as ProjectPricing);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [product.id, product.productType]);

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
    // U-48: try/catch/finally so a thrown fetch cannot leave the linker
    // button stuck on "Saving…" (a permanently disabled editor).
    try {
      const response = await fetch("/api/admin/project-components", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: product.id, components: linkerLinks }),
      });
      const result = await response.json().catch(() => ({}));
      setMessage(
        response.ok
          ? `Component links saved (${result.saved ?? linkerLinks.length}).`
          : result.error || "Could not save component links."
      );
    } catch {
      setMessage("Could not reach the server to save component links.");
    } finally {
      setLinkerBusy(false);
    }
  }

  // 2026-11-13: save the open project's pricing rules (staff+) — mirrors the
  // 3D print studio settings save. Partial patches keep the rest intact via the
  // existing row read inside the API route.
  async function saveProjectPricing_(pricing: ProjectPricing) {
    if (!product.id) return;
    setPricingBusy(true);
    try {
      const response = await fetch("/api/admin/project-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: product.id,
          ...pricing,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        setProjectPricing(result.pricing ?? pricing);
        setMessage("Project pricing saved.");
        revalidateProjectPricing(product.id);
      } else {
        setMessage((result.error as string) || "Could not save the pricing.");
      }
    } catch {
      setMessage("Could not reach the server to save the pricing.");
    } finally {
      setPricingBusy(false);
    }
  }

  async function approveProjectPricing_(approved: boolean) {
    if (!product.id) return;
    setPricingBusy(true);
    try {
      const response = await fetch("/api/admin/project-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: product.id,
          resource: "pricing",
          approved,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        setProjectPricing((prev) =>
          approved
            ? { ...prev, priceStatus: "approved" as const }
            : { ...prev, priceStatus: "draft" as const }
        );
        revalidateProjectPricing(product.id);
      } else {
        setMessage((result.error as string) || "Could not update the pricing status.");
      }
    } catch {
      setMessage("Could not reach the server to update the pricing status.");
    } finally {
      setPricingBusy(false);
    }
  }

  // Local state for the extras + bulk-tiers editors (mirrors AdminPrint's
  // in-place array editing). synced back to projectPricing on save.
  const [extrasState, setExtrasState] = useState<ProjectPricingExtra[]>(projectPricing.extras);
  const [bulkTiersState, setBulkTiersState] = useState<ProjectPricingBulkTier[]>(
    projectPricing.bulkTiers
  );

  // Keep the live estimate preview in sync with the linked components + the
  // edited pricing rules. Runs whenever the open project's links or the local
  // extras/bulk-tiers/base-charge/markup/minimum change.
  const estimatePreview = useMemo<ReturnType<typeof estimateProject>>(() => {
    if (!product.id || product.productType !== "Project package") {
      return {
        available: false,
        packageBaseCharge: 0,
        componentsTotal: 0,
        extrasTotal: 0,
        subtotal: 0,
        discountPercent: 0,
        discountAmount: 0,
        beforeMinimum: 0,
        total: 0,
        minimumApplied: false,
        minimumOrder: 0,
        reason: "Rate on request",
      };
    }
    const catalogPrices = new Map<string, number>();
    for (const link of linkerLinks) {
      const found = products.find((p) => p.id === link.productId);
      if (found) catalogPrices.set(link.productId, found.price);
    }
    // Compute as if approved: the owner must see the number these rules
    // produce BEFORE deciding to publish them (the public page still hides
    // it until approval).
    return estimateProject({
      pricing: {
        ...projectPricing,
        priceStatus: "approved" as const,
        extras: extrasState,
        bulkTiers: bulkTiersState,
      },
      links: linkerLinks,
      catalogPrices,
    });
  }, [
    product.id,
    product.productType,
    linkerLinks,
    products,
    projectPricing,
    extrasState,
    bulkTiersState,
  ]);

  // Keep the local extras/bulk-tiers state in sync when the open project
  // changes (e.g. staff switches between projects in the editor).
  useEffect(() => {
    setExtrasState(projectPricing.extras);
    setBulkTiersState(projectPricing.bulkTiers);
  }, [projectPricing.extras, projectPricing.bulkTiers]);

  // The draft-CalculatedPrice component used inline below is typed via the
  // ProjectPricingEstimate returned by estimateProject.
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
    const matchesQuery =
      !needle ||
      `${item.name} ${item.sku} ${item.id} ${item.description}`.toLowerCase().includes(needle);
    const stock = Number(item.stock) || 0;
    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "out" && stock <= 0) ||
      (stockFilter === "low" && stock > 0 && stock <= 3) ||
      (stockFilter === "in" && stock > 3);
    return matchesCategory && matchesQuery && matchesStock;
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
      stock: Math.max(0, Math.round(Number(product.stock) || 0)),
      specs:
        typeof product.specs === "string"
          ? String(product.specs).split("\n").filter(Boolean)
          : product.specs,
    };
    // U-48: try/catch/finally — the old code released `busy` on both the error
    // and success branches but NOT when the fetch itself threw, which left the
    // Save button disabled on "Saving..." permanently.
    try {
      const response = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
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
    } catch {
      setMessage("Could not reach the server to save the product.");
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
      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[1fr_1.3fr]">
        <section aria-label="Project package list" className="min-w-0 space-y-4">
          <div className={panelCard}>
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
            <select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value as "all" | "in" | "low" | "out");
                setProjectPage(1);
              }}
              aria-label="Stock filter"
              className={`mt-3 w-full sm:w-44 ${inputClass}`}
            >
              <option value="all">All stock</option>
              <option value="in">In stock (&gt;3)</option>
              <option value="low">Low stock (1–3)</option>
              <option value="out">Out of stock (0)</option>
            </select>
            <div className="mt-3 divide-y divide-line">
              {shownProjects.map((item) => {
                const stock = Number(item.stock) || 0;
                const stockLabel =
                  stock <= 0
                    ? "Out of stock"
                    : stock <= 3
                      ? `Low stock (${stock})`
                      : `In stock (${stock})`;
                const stockClass =
                  stock <= 0
                    ? "bg-red-100 text-red-700"
                    : stock <= 3
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-700";
                return (
                  <div key={item.id} className={`${cardRow} items-center`}>
                    <div className={cardRowText}>
                      <span className="block">
                        <strong>{item.name}</strong>{" "}
                        <span className="text-slate-400">{item.sku}</span>
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wide text-gold">
                        {item.inventoryType || "Catalog"} · {item.priceLabel}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${stockClass}`}
                        >
                          {stockLabel}
                        </span>
                        {item.active === false && (
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
                            Hidden
                          </span>
                        )}
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
                );
              })}
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
                project_category: "",
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
                      className={`${cardRow} items-center rounded border border-line px-3 py-2`}
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

      {/* 2026-11-13: project pricing (mirrors the 3D print studio pricing panel).
            Only shown for a saved project package — it has an id to hang the pricing
            row on, and the catalog components it can be priced from. */}
      {product.id && product.productType === "Project package" && (
        <section id="project-package-pricing" aria-label="Project package pricing" className="mt-4">
          <div className={`${editorCard} rounded-xl border border-line bg-card p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={editorCardTitle}>Pricing</h2>
              <button
                type="button"
                disabled={pricingBusy}
                onClick={async () => {
                  if (!product.id) return;
                  const next = {
                    ...projectPricing,
                    extras: extrasState,
                    bulkTiers: bulkTiersState,
                  };
                  await saveProjectPricing_(next);
                }}
                className="rounded-full bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark disabled:opacity-60"
              >
                {pricingBusy ? "Saving…" : "Save pricing"}
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              Set the base charge, component markup, optional extras, bulk tiers and minimum order
              for this project package. Prices stay hidden (rate on request) until you approve them
              below.
            </p>

            {/* publication status + approve/withdraw */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">
                  Publication status
                </p>
                <p className="mt-1 text-sm font-bold text-ink">
                  {projectPricing.priceStatus === "approved"
                    ? `Rates approved${projectPricing.priceApprovedAt ? ` on ${new Date(projectPricing.priceApprovedAt).toLocaleDateString()}` : ""}${projectPricing.priceApprovedBy ? ` by ${projectPricing.priceApprovedBy}` : ""}`
                    : 'Draft — customers see "rate on request" and the calculator stays hidden'}
                </p>
              </div>
              <button
                type="button"
                disabled={pricingBusy}
                onClick={async () => {
                  if (!product.id) return;
                  const approved = projectPricing.priceStatus !== "approved";
                  if (
                    approved &&
                    !window.confirm(
                      "Publish the current project pricing and switch the calculator on?"
                    )
                  )
                    return;
                  await approveProjectPricing_(approved);
                }}
                className={`min-h-[44px] rounded-full px-5 text-xs font-black transition disabled:opacity-60 ${
                  projectPricing.priceStatus === "approved"
                    ? "border border-line bg-white text-ink hover:border-red-500"
                    : "bg-navy text-white hover:bg-navy-dark"
                }`}
              >
                {projectPricing.priceStatus === "approved"
                  ? "Withdraw rates"
                  : "Approve & publish rates"}
              </button>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1.3fr]">
              <div className={editorCard}>
                <h2 className={editorCardTitle}>Base charge &amp; markup</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="min-w-0 text-sm font-bold">
                    Package base charge (NPR)
                    <input
                      type="number"
                      min={0}
                      value={projectPricing.packageBaseCharge}
                      onChange={(e) =>
                        setProjectPricing({
                          ...projectPricing,
                          packageBaseCharge: Math.max(0, Math.round(Number(e.target.value) || 0)),
                        })
                      }
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Component markup (%)
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={projectPricing.componentMarkupPercent}
                      onChange={(e) =>
                        setProjectPricing({
                          ...projectPricing,
                          componentMarkupPercent: Math.max(
                            0,
                            Math.min(500, Math.round(Number(e.target.value) || 0))
                          ),
                        })
                      }
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Minimum order (NPR)
                    <input
                      type="number"
                      min={0}
                      value={projectPricing.minimumOrder}
                      onChange={(e) =>
                        setProjectPricing({
                          ...projectPricing,
                          minimumOrder: Math.max(0, Math.round(Number(e.target.value) || 0)),
                        })
                      }
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="sm:col-span-2 min-w-0 text-sm font-bold">
                    Pricing note
                    <input
                      value={projectPricing.note}
                      onChange={(e) =>
                        setProjectPricing({
                          ...projectPricing,
                          note: e.target.value.slice(0, 300),
                        })
                      }
                      className={`mt-2 w-full ${inputClass}`}
                      placeholder="Internal note (not shown to customers)"
                    />
                  </label>
                </div>
              </div>

              <div className={editorCard}>
                <h2 className={editorCardTitle}>Extras &amp; bulk tiers</h2>

                <div className="mt-3">
                  <p className="text-sm font-bold">Optional extras (flat add-ons)</p>
                  {extrasState.map((extra, index) => (
                    <div key={extra.id ?? index} className="mt-2 flex flex-wrap items-end gap-2">
                      <input
                        value={extra.name}
                        aria-label="Extra name"
                        onChange={(e) => {
                          const next = extrasState.map((x, i) =>
                            i === index ? { ...x, name: e.target.value.slice(0, 60) } : x
                          );
                          setExtrasState(next);
                        }}
                        className={`min-w-0 flex-1 ${inputClass}`}
                        placeholder="e.g. On-site training"
                      />
                      <input
                        type="number"
                        min={0}
                        aria-label="Extra amount (NPR)"
                        value={extra.amount}
                        onChange={(e) => {
                          const next = extrasState.map((x, i) =>
                            i === index
                              ? {
                                  ...x,
                                  amount: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                }
                              : x
                          );
                          setExtrasState(next);
                        }}
                        className={`w-32 ${inputClass}`}
                      />
                      <button
                        type="button"
                        onClick={() => setExtrasState(extrasState.filter((_, i) => i !== index))}
                        className="rounded-lg border border-line px-3 py-3 text-xs font-black text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setExtrasState([
                        ...extrasState,
                        { id: `extra-${extrasState.length + 1}`, name: "", amount: 0 },
                      ])
                    }
                    className="mt-2 rounded-lg border border-line px-4 py-2 text-xs font-black text-ink hover:border-navy"
                  >
                    Add extra
                  </button>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-bold">Bulk tiers (quantity → % off)</p>
                  {bulkTiersState.map((tier, index) => (
                    <div key={index} className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="text-xs font-bold">
                        Min qty
                        <input
                          type="number"
                          min={1}
                          value={tier.minQty}
                          onChange={(e) => {
                            const next = bulkTiersState.map((t, i) =>
                              i === index
                                ? {
                                    ...t,
                                    minQty: Math.max(1, Math.round(Number(e.target.value) || 1)),
                                  }
                                : t
                            );
                            setBulkTiersState(next);
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
                            const next = bulkTiersState.map((t, i) =>
                              i === index
                                ? {
                                    ...t,
                                    discountPercent: Math.min(
                                      90,
                                      Math.max(0, Math.round(Number(e.target.value) || 0))
                                    ),
                                  }
                                : t
                            );
                            setBulkTiersState(next);
                          }}
                          className={`ml-2 w-24 ${inputClass}`}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setBulkTiersState(bulkTiersState.filter((_, i) => i !== index))
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
                      setBulkTiersState([...bulkTiersState, { minQty: 10, discountPercent: 5 }])
                    }
                    className="mt-2 rounded-lg border border-line px-4 py-2 text-xs font-black text-ink hover:border-navy"
                  >
                    Add tier
                  </button>
                </div>
              </div>
            </div>

            {(extrasState.length > 0 ||
              bulkTiersState.length > 0 ||
              projectPricing.packageBaseCharge > 0 ||
              projectPricing.componentMarkupPercent > 0 ||
              projectPricing.minimumOrder > 0) && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Live estimate preview
                </p>
                <p className="mt-1 text-sm text-muted">
                  Based on the components currently linked to this project (below) + the pricing
                  rules above. This preview uses the same calculator the public page will show once
                  you approve the rates.
                </p>
                {estimatePreview.available ? (
                  <div className="mt-3 rounded-xl border border-line bg-white p-4">
                    <p className="text-sm text-muted">
                      Estimated indicative price
                      {projectPricing.priceStatus === "approved"
                        ? ""
                        : " (draft preview — approve above to publish)"}
                    </p>
                    <p className="mt-2 font-display text-2xl font-bold text-ink">
                      {formatNPR(estimatePreview.total)}
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted">Package base charge</span>
                        <span className="font-bold text-ink">
                          {formatNPR(estimatePreview.packageBaseCharge)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">
                          Components (
                          {estimatePreview.componentsTotal > 0 ? "included" : "none linked"})
                        </span>
                        <span className="font-bold text-ink">
                          {formatNPR(estimatePreview.componentsTotal)}
                        </span>
                      </div>
                      {estimatePreview.extrasTotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted">Extras</span>
                          <span className="font-bold text-ink">
                            {formatNPR(estimatePreview.extrasTotal)}
                          </span>
                        </div>
                      )}
                      {estimatePreview.discountPercent > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted">
                            Bulk discount · {estimatePreview.discountPercent}%
                          </span>
                          <span className="font-bold text-red-600">
                            −{formatNPR(estimatePreview.discountAmount)}
                          </span>
                        </div>
                      )}
                      {estimatePreview.minimumApplied && (
                        <div className="flex justify-between">
                          <span className="text-muted">Minimum order applied</span>
                          <span className="font-bold text-ink">
                            {formatNPR(estimatePreview.minimumOrder)}
                          </span>
                        </div>
                      )}
                    </dl>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">{estimatePreview.reason}</p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* project package preview portal — the "eye" button in the list opens
          a full-screen preview. Portal to <body> so the tab track's transform +
          overflow-hidden don't clip it off-screen (owner report 2026-09-22). */}
      {previewProduct &&
        createPortal(
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
                <h2 className="mt-2 break-words font-display text-xl font-bold leading-snug text-ink">
                  {previewProduct.name}
                </h2>
                <p className="mt-2 break-words text-sm leading-6 text-muted">
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
