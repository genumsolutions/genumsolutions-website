"use client";

import { useState } from "react";
import {
  MAX_QUOTE_FILES,
  MAX_QUOTE_FILE_BYTES,
  QUOTE_FILE_ACCEPT,
  quoteFileExtension,
} from "../../lib/print-quote";
import type { PrintMaterial } from "../../lib/print";

const field =
  "mt-2 w-full rounded-lg border border-line bg-white px-4 py-3 text-sm font-medium outline-none transition placeholder:text-muted focus:border-navy focus:ring-2 focus:ring-navy/20";

export default function PrintQuoteForm({ materials }: { materials: PrintMaterial[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setDone("");

    const files = data.getAll("files").filter((entry): entry is File => entry instanceof File);
    const realFiles = files.filter((file) => file.size > 0);
    if (realFiles.length > MAX_QUOTE_FILES) {
      setError(`Attach up to ${MAX_QUOTE_FILES} files.`);
      return;
    }
    for (const file of realFiles) {
      if (file.size > MAX_QUOTE_FILE_BYTES) {
        setError("Each file must be smaller than 10 MB.");
        return;
      }
      if (!quoteFileExtension(file.name)) {
        setError("Attach STL, OBJ, 3MF, STEP, ZIP, PDF, JPG, PNG or WebP files.");
        return;
      }
    }
    // Empty file inputs still send a zero-byte File in some browsers.
    data.delete("files");
    realFiles.forEach((file) => data.append("files", file));

    setBusy(true);
    try {
      const response = await fetch("/api/print/quote", { method: "POST", body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "Could not send the request. Please try again.");
        return;
      }
      setDone(result.message || "Thanks — your request is in.");
      form.reset();
    } catch {
      setError("Could not reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="quote" className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-10 lg:px-8">
      <div className="grid gap-6 rounded-2xl bg-ink p-6 text-white sm:p-8 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-gold">Send a file</p>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            Tell us what you need printed.
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/70">
            Attach a model, sketch or reference photo. We review the geometry, material and
            orientation, then send back a firm quote — nothing is printed before you approve it.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-white/70">
            <li>· Up to {MAX_QUOTE_FILES} files, 10 MB each</li>
            <li>· STL, OBJ, 3MF, STEP, ZIP, PDF, JPG, PNG, WebP</li>
            <li>· Files stay private — only staff can open them</li>
          </ul>
        </div>

        <form onSubmit={submit} className="grid gap-4 text-ink sm:grid-cols-2">
          <label className="min-w-0 text-sm font-bold text-white">
            Name
            <input name="name" required maxLength={100} className={field} autoComplete="name" />
          </label>
          <label className="min-w-0 text-sm font-bold text-white">
            Email
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              className={field}
              autoComplete="email"
            />
          </label>
          <label className="min-w-0 text-sm font-bold text-white">
            Phone (optional)
            <input name="phone" maxLength={30} className={field} autoComplete="tel" />
          </label>
          <label className="min-w-0 text-sm font-bold text-white">
            Material
            <select name="material" className={field} defaultValue="">
              <option value="">Not sure — recommend one</option>
              {materials.map((material) => (
                <option key={material.id} value={material.name}>
                  {material.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-sm font-bold text-white">
            Quantity
            <input
              name="quantity"
              type="number"
              min={1}
              max={10000}
              defaultValue={1}
              className={field}
            />
          </label>
          <label className="min-w-0 text-sm font-bold text-white">
            Size / dimensions (optional)
            <input
              name="dimensions"
              maxLength={120}
              placeholder="e.g. 12 × 8 × 10 cm"
              className={field}
            />
          </label>
          <label className="min-w-0 text-sm font-bold text-white">
            Needed by (optional)
            <input
              name="timeline"
              maxLength={80}
              placeholder="e.g. within 2 weeks"
              className={field}
            />
          </label>
          <label className="min-w-0 text-sm font-bold text-white">
            Files
            <input
              name="files"
              type="file"
              multiple
              accept={QUOTE_FILE_ACCEPT}
              className="mt-2 block w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-xs font-medium text-white/80 file:mr-3 file:rounded-full file:border-0 file:bg-gold file:px-3 file:py-1.5 file:text-xs file:font-black file:text-ink"
            />
          </label>
          <label className="min-w-0 text-sm font-bold text-white sm:col-span-2">
            Describe the part
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={4000}
              rows={4}
              placeholder="What is it for, and does it need to fit or hold anything?"
              className={field}
            />
          </label>
          <label className="min-w-0 text-sm font-bold text-white sm:col-span-2">
            Reference links (optional, one per line)
            <textarea name="referenceUrls" rows={2} placeholder="https://..." className={field} />
          </label>

          {error && (
            <p
              role="alert"
              className="sm:col-span-2 rounded-lg bg-red-500/15 px-4 py-3 text-sm font-bold text-red-300"
            >
              {error}
            </p>
          )}
          {done && (
            <p
              role="status"
              className="sm:col-span-2 rounded-lg bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-300"
            >
              {done}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-12 items-center justify-center rounded-full bg-gold px-6 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60"
            >
              {busy ? "Sending..." : "Request a quote"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
