import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Marketplace jurídico",
  description:
    "Apresentação pública do marketplace VerasJuris com exemplos fictícios. Contratações reais exigem autenticação.",
};

export default function MarketplaceJuridicoLayout({ children }: { children: ReactNode }) {
  return children;
}
