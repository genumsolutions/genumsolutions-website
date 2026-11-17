import type { Metadata } from "next";
import PageShell from "../../components/PageShell";
import AuthPanel from "../../components/AuthPanel";

// U-48: the sign-in surface has no public content worth indexing and
// robots.txt disallows it — the noindex tag makes that binding.
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

const modes = ["signin", "signup", "forgot"] as const;

// ?mode=signup|forgot deep-links (e.g. from marketing CTAs) land on the right tab.
// Next 16 hands searchParams in as a Promise.
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  const requested = (await searchParams)?.mode as (typeof modes)[number] | undefined;
  const initialMode = requested && modes.includes(requested) ? requested : "signin";
  return (
    <PageShell>
      <AuthPanel initialMode={initialMode} />
    </PageShell>
  );
}
