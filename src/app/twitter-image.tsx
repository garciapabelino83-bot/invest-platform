import { ImageResponse } from "next/og";

export const alt = "InvestPanel — Análisis técnico de cripto y acciones en tiempo real, en español";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VERDE = "#0ecb81";
const ROJO = "#f6465d";

// Mini "gráfico de velas" decorativo hecho a puro CSS (no es una captura de
// pantalla real, pero da la idea visual del producto sin depender de un
// archivo de imagen externo).
const VELAS = [
  { h: 40, sube: true }, { h: 65, sube: true }, { h: 35, sube: false }, { h: 80, sube: true },
  { h: 55, sube: false }, { h: 90, sube: true }, { h: 45, sube: false }, { h: 70, sube: true },
  { h: 100, sube: true }, { h: 60, sube: false }, { h: 85, sube: true }, { h: 50, sube: false },
  { h: 120, sube: true }, { h: 75, sube: false }, { h: 95, sube: true }, { h: 130, sube: true },
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000000",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: VERDE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 700,
                color: "#000",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="14" width="4" height="7" rx="1" fill="#000" />
                <rect x="10" y="9" width="4" height="12" rx="1" fill="#000" />
                <rect x="17" y="3" width="4" height="18" rx="1" fill="#000" />
              </svg>
            </div>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: "#fff" }}>
              InvestPanel
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 52, fontWeight: 800, color: "#fff", marginTop: 34, lineHeight: 1.15, maxWidth: 980 }}>
            Análisis técnico de cripto y acciones, en español
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#a1a1aa", marginTop: 20, maxWidth: 820 }}>
            Gráficos en tiempo real, RSI, medias móviles, alertas de precio y más de 200 monedas — gratis para empezar.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 150 }}>
          {VELAS.map((v, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                width: 30,
                height: v.h,
                borderRadius: 3,
                background: v.sube ? VERDE : ROJO,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
