import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";
import { PlatformChrome } from "../components/platform-chrome";
import "@verasjuris/ui/styles.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--vj-font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--vj-font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "VerasJuris", template: "%s · VerasJuris" },
  description:
    "Plataforma jurídica para organizar processos, clientes, documentos, atendimentos e operações, com automação e inteligência artificial assistida.",
  applicationName: "VerasJuris",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#06295B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} ${mono.variable}`}>
        <div className="vj-stripe" />
        <PlatformChrome>{children}</PlatformChrome>
      </body>
    </html>
  );
}
