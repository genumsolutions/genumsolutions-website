"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, Menu, Moon, ShoppingBag, Sun, User, X } from "lucide-react";
import HeaderSession from "./HeaderSession";
import { useCart } from "./cart-provider";
import { signOut } from "../lib/auth";
import {
  DEFAULT_THEME,
  applyThemePreference,
  nextThemePreference,
  readStoredPreference,
  writeStoredPreference,
  type ThemePreference,
} from "../lib/theme";

const nav = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Products", href: "/products" },
  { label: "Projects", href: "/projects" },
  { label: "Control Panel", href: "/tools" },
  { label: "3D Printing", href: "/3d-printing" },
  { label: "Journal", href: "/journal" },
  { label: "Contact", href: "/contact" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SessionUser = { name: string; email: string; role: string };

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const { count, hydrated, clear } = useCart();

  // Keep the mobile menu session-aware so "Sign in" only appears for guests
  // and "My Account / Log out" appears for signed-in visitors, matching the
  // desktop HeaderSession control.
  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => undefined);
  }, [pathname]);

  async function handleLogout() {
    clear();
    await signOut("/");
  }

  // Theme (W-6, 2-mode per owner decision 2026-09-22): light ⇄ dim only.
  // No "system"/OS-follow option and no OS listener; legacy 'system'
  // stored values are resolved to 'dim' on read (see readStoredPreference).
  const [preference, setPreference] = useState<ThemePreference>(DEFAULT_THEME);

  useEffect(() => {
    const stored = readStoredPreference(window.localStorage);
    setPreference(stored);
    applyThemePreference(stored, document);
  }, []);

  const cycleTheme = useCallback(() => {
    setPreference((current) => {
      const next = nextThemePreference(current);
      applyThemePreference(next, document);
      writeStoredPreference(window.localStorage, next);
      // Signed-in users get the choice mirrored to their profile so the app
      // and the website agree on one preference (Supabase is the only bridge).
      fetch("/api/customer/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      }).catch(() => undefined);
      return next;
    });
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // U-47v4: menu close behaviors — Escape (desktop-hybrid), Android BACK
  // button (history popstate guard: opening pushes a history entry, closing
  // pops it so the hardware back closes the menu instead of leaving the
  // page), outside-tap via the viewport scrim. The stale body scroll-lock
  // was removed: the popover must scroll WITH the sticky header.
  // U-47v6: the sentinel is NEVER unwound via history.back() — see the
  // effect below (reactive back raced and canceled menu-item navigation).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    function onPopState() {
      setOpen(false);
    }
    // Push a sentinel entry; hardware back => popstate => close (the
    // sentinel is consumed by that back).
    window.history.pushState({ genumMenu: true }, "");
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    // U-47v6 (owner: menu items stopped navigating to their pages): the
    // previous cleanup called history.back() to unwind the sentinel, but
    // that ASYNC navigation raced the menu item's own navigation — the
    // sentinel's back won and canceled the link's push, so every menu tap
    // landed back on the same page (Android Chrome). Fix: NEVER call
    // history.back() reactively. A popstate fired while the current state
    // is our sentinel is the hardware back (close; sentinel consumed); a
    // popstate arriving after the state has already changed is a real
    // navigation (close without touching history). A sentinel left behind
    // (user navigated by some path that didn't fire our cleanup) is
    // harmless: one extra back press returns to this page.
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, [open]);

  const linkClass = (href: string) => {
    const active = isActive(pathname ?? "", href);
    return `rounded-full px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
      active ? "text-navy font-bold" : "text-ink/60 hover:text-navy"
    }`;
  };

  return (
    <>
      {/* U-47v4 fix: the scrim must be a viewport-wide tap-catcher but it
        CANNOT live inside <header> — backdrop-blur on the header makes it
        the containing block for fixed descendants, so a fixed scrim there
        only covered the header bar itself and outside-tap never fired.
        Rendered as a sibling below the header (z-40 < header z-50) and
        only while open. */}
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
        />
      )}
      <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:gap-4 sm:py-3.5 lg:px-8">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-3"
            aria-label="GENUM SOLUTIONS home"
          >
            <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white shadow-card ring-1 ring-line transition group-hover:ring-navy/40 sm:h-14 sm:w-14">
              <Image
                src="/logo.png"
                alt="GENUM SOLUTIONS stamp"
                width={112}
                height={112}
                className="h-full w-full object-contain"
                priority
              />
            </span>
            {/* U-47v4 (owner: "Solutions Pvt. Ltd." missing on mobile): the
              wordmark now shows on ALL sizes — 'GENUM' always, tagline also
              always visible (progressively sized 320px→sm, truncate guard).
              min-w-0 + shrink keeps the fixed-width action cluster safe. */}
            <span aria-hidden="true" className="hidden h-10 w-px bg-line sm:block" />
            <span className="min-w-0 leading-none">
              <strong className="block truncate font-display text-lg font-bold tracking-tight text-ink sm:text-[22px]">
                GENUM
              </strong>
              <span className="mt-1 block truncate text-[8px] font-bold uppercase tracking-[0.18em] text-navy min-[380px]:text-[9px] min-[380px]:tracking-[0.26em] sm:text-[10px] sm:tracking-[0.32em]">
                Solutions Pvt.&thinsp;Ltd.
              </span>
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 text-sm text-ink/60 lg:flex"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(item.href)}
                aria-current={isActive(pathname ?? "", item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <HeaderSession />
            <button
              onClick={cycleTheme}
              aria-label={`Theme: ${preference}. Click to change.`}
              title={`Theme: ${preference} — click for ${nextThemePreference(preference)}`}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-muted transition hover:border-navy hover:text-navy sm:h-9 sm:w-9"
            >
              {/* W-6 2-way cycle: light ⇄ dim (owner decision 2026-09-22 —
                System removed; legacy 'system' stored values resolve to dim). */}
              {preference === "light" ? (
                <Sun size={16} aria-hidden="true" />
              ) : (
                <Moon size={16} aria-hidden="true" />
              )}
            </button>
            <Link
              href="/checkout"
              aria-label={
                hydrated && count > 0
                  ? `Open checkout, ${count} item${count === 1 ? "" : "s"}`
                  : "Open checkout"
              }
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white transition hover:bg-navy sm:h-9 sm:w-9"
            >
              <ShoppingBag size={16} aria-hidden="true" />
              {hydrated && count > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-black text-ink"
                >
                  {count}
                </span>
              )}
            </Link>
            <button
              ref={menuButtonRef}
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls="mobile-navigation"
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-navy hover:text-navy sm:h-9 sm:w-9 lg:hidden"
            >
              {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>{" "}
        {/* U-47v4 (owner): the popover must STICK with the sticky header —
          so it lives INSIDE the <header> flow positioned absolute to it
          (the header is sticky top-0, absolute children ride along). The
          viewport scrim lives OUTSIDE the header (see fragment above).
          Outside-tap closes (scrim), Android back closes (popstate),
          Escape closes. */}
        <div
          id="mobile-navigation"
          ref={mobileNavRef}
          aria-hidden={!open}
          className={`absolute inset-x-0 top-full z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
        >
          <nav
            aria-label="Mobile"
            className={`absolute right-2 w-56 overflow-hidden rounded-2xl border border-line bg-white/80 shadow-2xl backdrop-blur-xl transition-all duration-200 ease-out origin-top-right ${
              open ? "translate-y-2 scale-100 opacity-100" : "-translate-y-2 scale-95 opacity-0"
            }`}
            style={{ maxHeight: "calc(100dvh - 96px)" }}
          >
            <ul className="overflow-y-auto py-1.5 text-sm">
              {nav.map((item) => {
                const active = isActive(pathname ?? "", item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`mx-1.5 flex h-11 items-center rounded-lg px-3 font-semibold backdrop-blur-none transition ${
                        active ? "bg-navy text-white" : "bg-white text-ink hover:bg-mist"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-line p-2">
              {user ? (
                <div className="space-y-1">
                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className="flex h-11 items-center justify-center rounded-lg border border-navy bg-white px-3 text-sm font-bold text-navy hover:bg-navy-light"
                  >
                    <User size={14} aria-hidden="true" className="mr-2" />
                    My Account
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex h-11 w-full items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-sm font-bold text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={14} aria-hidden="true" className="mr-2" />
                    Log out
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center justify-center rounded-lg bg-navy px-3 text-sm font-bold text-white hover:bg-navy-dark"
                >
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}
