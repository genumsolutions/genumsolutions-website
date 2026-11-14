"use client";

import { FormEvent, useEffect, useState } from "react";
import { inputClass } from "../../lib/styles";
import { LoadingRow, PanelCard, SaveBar, editorCardTitle, panelId } from "./admin-helpers";
import { tabBase, tabActive, tabInactive } from "../../lib/styles";

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
};

const SECTIONS = [
  { id: "details", label: "Company details", hint: "Name, address and tax details." },
  { id: "contact", label: "Contact", hint: "Email, phone and public description." },
  { id: "social", label: "Social & messaging", hint: "WhatsApp and social profile links." },
] as const;

// U-UI2 (2026-11-14): sub-tabs for Settings tab — mirroring the 3D Products pattern.
// Only one sub-tab is visible at a time, sub-tabs are sticky while scrolling.
const SETTINGS_SUBTABS = ["Details", "Contact", "Social"] as const;
type SettingsSubTab = (typeof SETTINGS_SUBTABS)[number];

export default function AdminSettings({ setMessage }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [company, setCompany] = useState<CompanyInfo>(emptyCompany);
  const [busy, setBusy] = useState(false);
  const [subTab, setSubTab] = useState<SettingsSubTab>("Details");

  useEffect(() => {
    void fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setCompany({ ...emptyCompany, ...(data.company ?? {}) }))
      .catch(() => setMessage("Could not load company information."))
      .finally(() => setLoaded(true));
  }, [setMessage]);

  async function saveCompany(event?: FormEvent) {
    event?.preventDefault();
    if (!company.name.trim() || !company.email.trim()) {
      setMessage("Company name and email are required.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "company",
          company: { ...company, name: company.name.trim(), email: company.email.trim() },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error || "Could not save company information.");
        return;
      }
      setMessage("Company information saved.");
    } catch {
      setMessage("Could not reach the server to save the company information.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* U-UI2 sub-tabs strip - sticky, one at a time */}
      <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
        <div
          role="tablist"
          aria-label="Settings sub-tabs"
          className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SETTINGS_SUBTABS.map((sub: SettingsSubTab, _: number) => (
            <button
              key={sub}
              role="tab"
              aria-selected={subTab === sub}
              aria-controls={`settings-subpanel-${panelId(sub)}`}
              tabIndex={subTab === sub ? 0 : -1}
              onClick={() => setSubTab(sub)}
              className={`${tabBase} text-[10px] ${subTab === sub ? tabActive : tabInactive}`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {subTab === "Details" && (
        <div className="mt-4 space-y-4">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Company information sections"
          >
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={false}
                onClick={() => {}}
                className={`min-h-[36px] rounded-full border px-4 text-xs font-black transition ${
                  false
                    ? "border-navy bg-navy text-white"
                    : "border-line bg-white text-navy hover:border-navy"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">{SECTIONS.find((s) => s.id === "details")?.hint}</p>
          {!loaded ? (
            <LoadingRow className="mt-3" />
          ) : (
            <form onSubmit={saveCompany} className="space-y-4">
              <PanelCard>
                <h2 className={editorCardTitle}>Company details</h2>
                <div className="grid gap-4">
                  <label className="min-w-0 text-sm font-bold">
                    Name
                    <input
                      value={company.name}
                      onChange={(e) => setCompany({ ...company, name: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Short name
                    <input
                      value={company.shortName}
                      onChange={(e) => setCompany({ ...company, shortName: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Address
                    <textarea
                      value={company.address}
                      onChange={(e) => setCompany({ ...company, address: e.target.value })}
                      rows={2}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    City
                    <input
                      value={company.city}
                      onChange={(e) => setCompany({ ...company, city: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Country
                    <input
                      value={company.country}
                      onChange={(e) => setCompany({ ...company, country: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    PAN
                    <input
                      value={company.pan}
                      onChange={(e) => setCompany({ ...company, pan: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    VAT label
                    <input
                      value={company.vatLabel}
                      onChange={(e) => setCompany({ ...company, vatLabel: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                </div>
              </PanelCard>
              <SaveBar>
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-navy px-5 py-3 text-sm font-black text-white transition hover:bg-navy/90 disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Save company"}
                </button>
              </SaveBar>
            </form>
          )}
        </div>
      )}

      {subTab === "Contact" && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-500">{SECTIONS.find((s) => s.id === "contact")?.hint}</p>
          {!loaded ? (
            <LoadingRow className="mt-3" />
          ) : (
            <form onSubmit={saveCompany} className="space-y-4">
              <PanelCard>
                <h2 className={editorCardTitle}>Contact</h2>
                <div className="grid gap-4">
                  <label className="min-w-0 text-sm font-bold">
                    Email
                    <input
                      type="email"
                      value={company.email}
                      onChange={(e) => setCompany({ ...company, email: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Phone
                    <input
                      value={company.phone}
                      onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Description
                    <textarea
                      value={company.description}
                      onChange={(e) => setCompany({ ...company, description: e.target.value })}
                      rows={3}
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                </div>
              </PanelCard>
              <SaveBar>
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-navy px-5 py-3 text-sm font-black text-white transition hover:bg-navy/90 disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Save company"}
                </button>
              </SaveBar>
            </form>
          )}
        </div>
      )}

      {subTab === "Social" && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-500">{SECTIONS.find((s) => s.id === "social")?.hint}</p>
          {!loaded ? (
            <LoadingRow className="mt-3" />
          ) : (
            <form onSubmit={saveCompany} className="space-y-4">
              <PanelCard>
                <h2 className={editorCardTitle}>Social & messaging</h2>
                <div className="grid gap-4">
                  <label className="min-w-0 text-sm font-bold">
                    WhatsApp number
                    <input
                      value={company.whatsappNumber}
                      onChange={(e) => setCompany({ ...company, whatsappNumber: e.target.value })}
                      placeholder="97798XXXXXXXX"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Facebook URL
                    <input
                      value={company.facebookUrl}
                      onChange={(e) => setCompany({ ...company, facebookUrl: e.target.value })}
                      placeholder="https://facebook.com/…"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    Instagram URL
                    <input
                      value={company.instagramUrl}
                      onChange={(e) => setCompany({ ...company, instagramUrl: e.target.value })}
                      placeholder="https://instagram.com/…"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    TikTok URL
                    <input
                      value={company.tiktokUrl}
                      onChange={(e) => setCompany({ ...company, tiktokUrl: e.target.value })}
                      placeholder="https://tiktok.com/@…"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    LinkedIn URL
                    <input
                      value={company.linkedinUrl}
                      onChange={(e) => setCompany({ ...company, linkedinUrl: e.target.value })}
                      placeholder="https://linkedin.com/company/…"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                  <label className="min-w-0 text-sm font-bold">
                    YouTube URL
                    <input
                      value={company.youtubeUrl}
                      onChange={(e) => setCompany({ ...company, youtubeUrl: e.target.value })}
                      placeholder="https://youtube.com/@…"
                      className={`mt-2 w-full ${inputClass}`}
                    />
                  </label>
                </div>
              </PanelCard>
              <SaveBar>
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-navy px-5 py-3 text-sm font-black text-white transition hover:bg-navy/90 disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Save company"}
                </button>
              </SaveBar>
            </form>
          )}
        </div>
      )}
    </>
  );
}
