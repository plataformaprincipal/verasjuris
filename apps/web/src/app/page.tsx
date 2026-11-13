import type { Metadata } from "next";
import { HomeCommercial } from "../components/home-commercial";

export const metadata: Metadata = {
  title: "VerasJuris — O universo jurídico em uma única plataforma",
  description:
    "Gestão, inteligência artificial, serviços jurídicos e ferramentas digitais para profissionais, empresas e clientes.",
  openGraph: {
    title: "VerasJuris",
    description:
      "Gestão, inteligência artificial, serviços jurídicos e ferramentas digitais em uma plataforma.",
  },
};

export default function HomePage() {
  return <HomeCommercial />;
}
