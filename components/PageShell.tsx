import type { ReactNode } from "react";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";
import { CollectionProvider } from "./collection-provider";

export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <CollectionProvider>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </CollectionProvider>
  );
}
