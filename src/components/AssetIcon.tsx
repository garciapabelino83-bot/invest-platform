"use client";

import { useState } from "react";

// Colores de respaldo (estilo TradingView) para cuando no encontramos un
// logo real: cada símbolo siempre cae en el mismo color, para que se vea
// intencional y no aleatorio entre recargas.
const COLORES_FALLBACK = [
  "#f7931a", "#627eea", "#00ffa3", "#0033ad", "#23292f",
  "#ba9f33", "#e6007a", "#e84142", "#2a5ada", "#345d9d",
  "#8247e5", "#26a17b", "#ff007a", "#f0b90b", "#14f195",
  "#375bd2", "#00d395", "#ff5900", "#7b3fe4", "#00b4d8",
];

function colorParaSimbolo(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  return COLORES_FALLBACK[Math.abs(hash) % COLORES_FALLBACK.length];
}

export type TipoActivo = "cripto" | "accion" | "indice";

// Logo de una cripto, acción o índice, con degradación elegante: si no
// encontramos un logo real (fuentes públicas y gratis, sin API key) caemos
// en un círculo de color con la inicial del símbolo, igual que hacen los
// exchanges cuando no tienen el ícono de una moneda nueva.
export default function AssetIcon({
  symbol,
  tipo,
  size = 28,
}: {
  symbol: string;
  tipo: TipoActivo;
  size?: number;
}) {
  const limpio = symbol.replace(/^\^/, "").replace(/\.[A-Z]+$/i, "");
  const [fallo, setFallo] = useState(tipo === "indice");

  if (fallo) {
    return (
      <span
        className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
        style={{ width: size, height: size, background: colorParaSimbolo(limpio), fontSize: size * 0.38 }}
      >
        {limpio.slice(0, tipo === "indice" ? 1 : 2)}
      </span>
    );
  }

  const src =
    tipo === "cripto"
      ? `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${limpio.toLowerCase()}.svg`
      : `https://financialmodelingprep.com/image-stock/${limpio}.png`;

  return (
    <span
      className={`rounded-full overflow-hidden flex items-center justify-center shrink-0 ${
        tipo === "cripto" ? "" : "bg-white"
      }`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={symbol}
        width={size}
        height={size}
        className={tipo === "cripto" ? "w-full h-full object-cover" : "w-full h-full object-contain p-1"}
        onError={() => setFallo(true)}
      />
    </span>
  );
}
