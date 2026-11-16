import type { Metadata } from "next";
import { AiPublicPage } from "../../components/ai-public-page";

export const metadata: Metadata = {
  title: "Inteligência artificial jurídica",
  description:
    "Recursos de inteligência artificial do VerasJuris: finalidade, limites e necessidade de revisão humana.",
};

export default function InteligenciaArtificialPage() {
  return <AiPublicPage />;
}
