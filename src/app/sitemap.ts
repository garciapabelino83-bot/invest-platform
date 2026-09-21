import type { MetadataRoute } from "next";

const SITE_URL = "https://invest-platform-chi.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const rutas = ["", "/graficos", "/ayuda", "/herramientas"];
  return rutas.map((ruta) => ({
    url: `${SITE_URL}${ruta}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: ruta === "" ? 1 : 0.7,
  }));
}
