import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InvestPanel — Análisis técnico de cripto",
    short_name: "InvestPanel",
    description:
      "Precios, RSI, medias móviles y avisos de precio para más de 200 criptomonedas, en español.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
