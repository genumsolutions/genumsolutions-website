"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  adminSectionPill,
  adminSectionPillActive,
  adminSectionPillInactive,
  adminSectionStrip,
  inputClass,
} from "../../lib/styles";
import { LoadingRow, PanelCard, SaveBar, editorCardTitle } from "./admin-helpers";
import { AdminEditorSheet } from "./AdminEditorSheet";

type Props = { setMessage: (msg: string) => void; canDelete: boolean };

type CompanyInfo = {
  name: string;
  shortName: string;
  address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  pan: string;
  vatLabel: string;
  description: string;
  whatsappNumber: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  url: string;
};

const emptyCompany: CompanyInfo = {
  name: "",
  shortName: "",
  address: "",
  city: "",
  country: "",
  email: "",
  phone: "",
  pan: "",
  vatLabel: "",
  description: "",
  whatsappNumber: "",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  linkedinUrl: "",
  youtubeUrl: "",
  url: "",
};

const SECTIONS = [
  { id: "details", label: "Company details", hint: "Name, address and tax details." },
  { id: "contact", label: "Contact", hint: "Email, phone and public description." },
  { id: "social", label: "Social & messaging", hint: "WhatsApp and social profile links." },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function AdminSettings({ setMessage, canDelete: _canDelete }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [company, setCompany] = useState<CompanyInfo>(emptyCompany);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<SectionId>("details");
  // Fieldsets are only rendered after Edit is pressed, matching the app console
  // and every other admin editor on the site.
  const [editing, setEditing] = useState(false);
  // 2026-11-18: edits happen on a DRAFT. Typing used to write straight into
  // `company`, so Cancel left the read-only view showing unsaved values and a
  // failed save looked identical to a successful one. Now nothing reaches the
  // saved record until a validated Save, and the database error is shown in
  // the sheet instead of only in the page message.
  const [draft, setDraft] = useState<CompanyInfo>(emptyCompany);
  const [saveError, setSaveError] = useState<string | null>(null);

  function startEditing() {
    setDraft({ ...company });
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setDraft({ ...company });
    setSaveError(null);
    setEditing(false);
  }

  useEffect(() => {
    void fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setCompany({ ...emptyCompany, ...(data.company ?? {}) }))
      .catch(() => setMessage("Could not load company information."))
      .finally(() => setLoaded(true));
  }, [setMessage]);

  async function saveCompany(event?: FormEvent) {
    event?.preventDefault();
    const missing: string[] = [];
    if (!draft.name.trim()) missing.push("company name");
    if (!draft.email.trim()) missing.push("email");
    if (missing.length > 0) {
      setSaveError(`Add the ${missing.join(" and ")} before saving.`);
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) {
      setSaveError("That email does not look right — it needs an @ and a domain.");
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      const next: CompanyInfo = {
        ...draft,
        name: draft.name.trim(),
        email: draft.email.trim(),
        whatsappNumber: draft.whatsappNumber.replace(/[^\d]/g, ""),
      };
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "company", company: next }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveError(result.error || "Could not save company information.");
        return;
      }
      setCompany(next);
      setEditing(false);
      setMessage("Company information saved.");
    } catch {
      setSaveError("Could not reach the server to save the company information.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className={adminSectionStrip} role="group" aria-label="Company information sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={section === item.id}
            onClick={() => setSection(item.id)}
            className={`${adminSectionPill} ${
              section === item.id ? adminSectionPillActive : adminSectionPillInactive
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{SECTIONS.find((s) => s.id === section)?.hint}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
          {editing ? "Editing" : "Read-only"}
        </span>
        <button
          type="button"
          onClick={() => (editing ? cancelEditing() : startEditing())}
          className={
            editing
              ? `${adminSectionPill} ${adminSectionPillInactive}`
              : `${adminSectionPill} ${adminSectionPillActive}`
          }
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      {!loaded ? (
        <LoadingRow className="mt-3" />
      ) : editing ? (
        <AdminEditorSheet
          title={SECTIONS.find((s) => s.id === section)?.label ?? "Company information"}
          hint="Saves to the shared company record the app and website both read."
          onClose={cancelEditing}
        >
          <form onSubmit={saveCompany} className="space-y-4">
            <PanelCard>
              {section === "details" && (
                <div className="grid gap-4">
                  <h2 className={editorCardTitle}>Company details</h2>
                  <label className="min-w-0 text-sm font-bold">
                    Name
                    <span className="mt-1 block text-xs font-normal text-muted">
                      Prints on invoices and order summaries; shown on the About and Legal pages.
                    </span>
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Short name
                    <span className="mt-1 block text-xs font-normal text-muted">
                      Used where space is tight — the footer, app icon label and receipts.
                    </span>
                    <input
                      value={draft.shortName}
                      onChange={(e) => setDraft({ ...draft, shortName: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Address
                    <span className="mt-1 block text-xs font-normal text-muted">
                      Posted address on the Contact page and order confirmation emails.
                    </span>
                    <textarea
                      value={draft.address}
                      onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                      rows={2}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    City
                    <span className="mt-1 block text-xs font-normal text-muted">
                      Shown with the address; also used for the local-delivery note.
                    </span>
                    <input
                      value={draft.city}
                      onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Country
                    <span className="mt-1 block text-xs font-normal text-muted">
                      Shown with the address and used for the VAT line.
                    </span>
                    <input
                      value={draft.country}
                      onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    PAN
                    <span className="mt-1 block text-xs font-normal text-muted">
                      Tax registration number printed on invoices. Leave empty if not registered.
                    </span>
                    <input
                      value={draft.pan}
                      onChange={(e) => setDraft({ ...draft, pan: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    VAT label
                    <span className="mt-1 block text-xs font-normal text-muted">
                      The tax wording on invoices, e.g. &quot;VAT / 13%&quot;.
                    </span>
                    <input
                      value={draft.vatLabel}
                      onChange={(e) => setDraft({ ...draft, vatLabel: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                </div>
              )}
              {section === "contact" && (
                <div className="grid gap-4">
                  <h2 className={editorCardTitle}>Contact</h2>
                  <label className="min-w-0 text-sm font-bold">
                    Email
                    <span className="mt-1 block text-xs font-normal text-muted">
                      The public contact address for messages, quotes and order questions.
                    </span>
                    <input
                      type="email"
                      value={draft.email}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Phone
                    <span className="mt-1 block text-xs font-normal text-muted">
                      Shown on the Contact page. Leave empty to hide the call button.
                    </span>
                    <input
                      value={draft.phone}
                      onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Description
                    <span className="mt-1 block text-xs font-normal text-muted">
                      Two or three sentences for the Contact page and search-engine summaries.
                    </span>
                    <textarea
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      rows={3}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                </div>
              )}
              {section === "social" && (
                <div className="grid gap-4">
                  <h2 className={editorCardTitle}>Social & messaging</h2>
                  <label className="min-w-0 text-sm font-bold">
                    WhatsApp number
                    <span className="mt-1 block text-xs font-normal text-muted">
                      Digits only with the country code and no plus sign. Empty hides the WhatsApp
                      button.
                    </span>
                    <input
                      value={draft.whatsappNumber}
                      onChange={(e) => setDraft({ ...draft, whatsappNumber: e.target.value })}
                      placeholder="97798XXXXXXXX"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Facebook URL
                    <input
                      value={draft.facebookUrl}
                      onChange={(e) => setDraft({ ...draft, facebookUrl: e.target.value })}
                      placeholder="https://facebook.com/…"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Instagram URL
                    <input
                      value={draft.instagramUrl}
                      onChange={(e) => setDraft({ ...draft, instagramUrl: e.target.value })}
                      placeholder="https://instagram.com/…"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    TikTok URL
                    <input
                      value={draft.tiktokUrl}
                      onChange={(e) => setDraft({ ...draft, tiktokUrl: e.target.value })}
                      placeholder="https://tiktok.com/@…"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    LinkedIn URL
                    <input
                      value={draft.linkedinUrl}
                      onChange={(e) => setDraft({ ...draft, linkedinUrl: e.target.value })}
                      placeholder="https://linkedin.com/company/…"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    YouTube URL
                    <input
                      value={draft.youtubeUrl}
                      onChange={(e) => setDraft({ ...draft, youtubeUrl: e.target.value })}
                      placeholder="https://youtube.com/@…"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  {/* Same field as the app's Settings → Social & messaging, so the
                    two consoles hold the identical company record. */}
                  <label className="min-w-0 text-sm font-bold">
                    Website URL
                    <span className="mt-1 block text-xs font-normal text-muted">
                      Linked from the app&apos;s About screen and the site footer.
                    </span>
                    <input
                      value={draft.url}
                      onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                      placeholder="https://example.com"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                </div>
              )}
            </PanelCard>
            {saveError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {saveError}
              </p>
            ) : null}
            <SaveBar>
              <button
                type="submit"
                disabled={busy}
                className="bg-navy px-5 py-3 text-sm font-black text-white transition hover:bg-navy/90 disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save company"}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-navy"
              >
                Cancel
              </button>
            </SaveBar>
          </form>
        </AdminEditorSheet>
      ) : (
        <ReadOnlyCompany
          company={company}
          section={section}
          label={SECTIONS.find((s) => s.id === section)?.label ?? "Company information"}
        />
      )}
    </div>
  );
}

/** Read-only company record: the same groups, values as plain rows. */
function ReadOnlyCompany({
  company,
  section,
  label,
}: {
  company: CompanyInfo;
  section: SectionId;
  label: string;
}) {
  const rows: [string, string][] =
    section === "details"
      ? [
          ["Name", company.name],
          ["Short name", company.shortName],
          ["Address", company.address],
          ["City", company.city],
          ["Country", company.country],
          ["PAN", company.pan],
          ["VAT label", company.vatLabel],
        ]
      : section === "contact"
        ? [
            ["Email", company.email],
            ["Phone", company.phone],
            ["Description", company.description],
          ]
        : [
            ["WhatsApp number", company.whatsappNumber],
            ["Website URL", company.url],
            ["Facebook URL", company.facebookUrl],
            ["Instagram URL", company.instagramUrl],
            ["TikTok URL", company.tiktokUrl],
            ["LinkedIn URL", company.linkedinUrl],
            ["YouTube URL", company.youtubeUrl],
          ];
  return (
    <PanelCard>
      <h2 className={editorCardTitle}>{label}</h2>
      <dl className="mt-3 divide-y divide-line">
        {rows.map(([rowLabel, value]) => (
          <div key={rowLabel} className="flex items-start gap-3 py-2">
            <dt className="w-32 shrink-0 text-xs text-muted">{rowLabel}</dt>
            <dd className="min-w-0 flex-1 break-words text-right text-sm text-ink">
              {value || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </PanelCard>
  );
}
