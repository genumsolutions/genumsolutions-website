"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  signed_in: "Signed in successfully.",
  registered: "Registration complete. You're signed in.",
  signed_out: "Signed out.",
};

export default function AuthNotice() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const key = searchParams.get("auth");
    if (!key || !MESSAGES[key]) return;
    setMessage(MESSAGES[key]);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    const timer = window.setTimeout(() => setMessage(null), 4500);
    return () => window.clearTimeout(timer);
  }, [pathname, router, searchParams]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4"
    >
      <p className="pointer-events-auto rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 shadow-lg">
        {message}
      </p>
    </div>
  );
}
