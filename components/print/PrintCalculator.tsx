"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { estimatePrint, formatNPR, type PrintMaterial, type PrintSettings } from "../../lib/print";

// Storefront estimate. Renders only when the owner has enabled the calculator
// AND at least one material has a published rate; otherwise the page shows the
// request-a-quote card instead (see app/3d-printing/page.tsx).
export default function PrintCalculator({
  settings,
  materials,
}: {
  settings: PrintSettings;
  materials: PrintMaterial[];
}) {
  const priced = materials.filter((material) => material.ratePerGram > 0);
  const [materialId, setMaterialId] = useState(priced[0]?.id ?? "");
  const [weight, setWeight] = useState(100);
  const [quantity, setQuantity] = useState(1);
  const [design, setDesign] = useState(false);
  const [finishing, setFinishing] = useState<string[]>([]);

  const material = priced.find((item) => item.id === materialId) ?? priced[0];
  const estimate = useMemo(
    () =>
      estimatePrint({
        weightGrams: weight,
        quantity,
        materialRatePerGram: material?.ratePerGram ?? 0,
        designRequested: design,
        finishingIds: finishing,
        settings,
      }),
    [weight, quantity, material, design, finishing, settings]
  );

  const toggleFinishing = (id: string) =>
    setFinishing((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );

  return (
    <section className="mx-auto max-w-7xl px-5 pt-10 lg:px-8" aria-labelledby="print-calculator">
      <div className="grid gap-6 rounded-2xl border border-line bg-white p-6 lg:grid-cols-[1.1fr_.9fr] lg:p-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
            Print calculator
          </p>
          <h2 id="print-calculator" className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            Estimate before you commit.
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Enter the printed weight — your slicer shows it — and choose the options you need.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-sm font-bold">
              Material
              <select
                value={material?.id ?? ""}
                onChange={(event) => setMaterialId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-line bg-white px-4 py-3 text-sm font-medium outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
              >
                {priced.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — NPR {item.ratePerGram}/g
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm font-bold">
              Printed weight (grams)
              <input
                type="number"
                min={1}
                value={weight}
                onChange={(event) => setWeight(Math.max(0, Number(event.target.value)))}
                className="mt-2 w-full rounded-lg border border-line bg-white px-4 py-3 text-sm font-medium outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
              />
            </label>
            <label className="min-w-0 text-sm font-bold">
              Quantity
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) =>
                  setQuantity(Math.max(1, Math.floor(Number(event.target.value))))
                }
                className="mt-2 w-full rounded-lg border border-line bg-white px-4 py-3 text-sm font-medium outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
              />
            </label>
            <label className="flex min-h-[46px] items-center gap-2 self-end rounded-lg border border-line px-4 py-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={design}
                onChange={(event) => setDesign(event.target.checked)}
                className="h-4 w-4 accent-navy"
              />
              I need design help
            </label>
          </div>

          {settings.finishingCharges.length > 0 && (
            <fieldset className="mt-4">
              <legend className="text-sm font-bold">Finishing</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {settings.finishingCharges.map((charge) => (
                  <label
                    key={charge.id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-bold"
                  >
                    <input
                      type="checkbox"
                      checked={finishing.includes(charge.id)}
                      onChange={() => toggleFinishing(charge.id)}
                      className="h-3.5 w-3.5 accent-navy"
                    />
                    {charge.name} · {formatNPR(charge.amount)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <div className="rounded-2xl bg-mist p-5" aria-live="polite">
          {estimate.available ? (
            <>
              <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Estimated</p>
              <p className="mt-1 font-display text-3xl font-bold text-ink">
                {formatNPR(estimate.total)}
              </p>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Material · {estimate.totalGrams} g</dt>
                  <dd className="font-bold text-ink">{formatNPR(estimate.materialCost)}</dd>
                </div>
                {estimate.finishingCost > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Finishing</dt>
                    <dd className="font-bold text-ink">{formatNPR(estimate.finishingCost)}</dd>
                  </div>
                )}
                {estimate.designCost > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Design base</dt>
                    <dd className="font-bold text-ink">{formatNPR(estimate.designCost)}</dd>
                  </div>
                )}
                {estimate.discountAmount > 0 && (
                  <div className="flex justify-between gap-3 text-emerald-700">
                    <dt>Bulk discount · {estimate.discountPercent}%</dt>
                    <dd className="font-bold">−{formatNPR(estimate.discountAmount)}</dd>
                  </div>
                )}
                {estimate.minimumApplied && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Minimum order applied</dt>
                    <dd className="font-bold text-ink">{formatNPR(settings.minimumOrder)}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-4 text-xs leading-5 text-muted">{settings.disclaimer}</p>
              <Link
                href="#quote"
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-gold px-5 text-sm font-black text-ink transition hover:bg-gold-dark"
              >
                Send this for a firm quote
              </Link>
            </>
          ) : (
            <>
              <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
                Price on review
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">{estimate.reason}</p>
              <Link
                href="#quote"
                className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-navy"
              >
                Request a quote
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
