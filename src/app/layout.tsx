import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://invest-platform-chi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "InvestPanel — Análisis técnico de cripto en tiempo real",
    template: "%s — InvestPanel",
  },
  description:
    "Sigue el precio de Bitcoin, Ethereum y más de 200 altcoins y memecoins, con análisis técnico (RSI, medias móviles, MACD, Bandas de Bollinger) y avisos de precio, todo en español.",
  keywords: [
    "cripto",
    "análisis técnico",
    "bitcoin",
    "altcoins",
    "memecoins",
    "RSI",
    "gráficos de velas",
  ],
  applicationName: "InvestPanel",
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "InvestPanel",
    title: "InvestPanel — Análisis técnico de cripto en tiempo real",
    description:
      "Precios, RSI, medias móviles y avisos de precio para más de 200 criptomonedas, en español.",
  },
  twitter: {
    card: "summary",
    title: "InvestPanel — Análisis técnico de cripto en tiempo real",
    description:
      "Precios, RSI, medias móviles y avisos de precio para más de 200 criptomonedas, en español.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
