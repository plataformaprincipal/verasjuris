import type { ReactNode } from "react";
import { PublicSiteHeader } from "../../components/public-site-header";

export default function PlanosPublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="vj-public-shell">
      <PublicSiteHeader />
      {children}
    </div>
  );
}
