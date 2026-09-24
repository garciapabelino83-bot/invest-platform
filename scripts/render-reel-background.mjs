import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Genera la imagen de fondo del Reel (formato vertical 9:16), en el
// mismo estilo que la tarjeta de Facebook pero pensada para pantalla
// completa de celular. Se renderiza a 2x de resolucion (2160x3840) para
// que el efecto de zoom lento en el video no se vea pixelado.
//
// Genera DOS variantes del mismo diseno (identicas salvo por la zona del
// grafico): una "vacia" (solo una cuadricula tenue) y otra "completa" (con
// las velas japonesas ya dibujadas). El script que arma el video usa las
// dos para animar una revelacion de izquierda a derecha, simulando que el
// grafico de velas "se dibuja" y sube/baja en vivo.

let fontCache = null;
async function loadFontsBase64() {
  if (fontCache) return fontCache;
  const dir = path.join(__dirname, "fonts");
  const [bold, medium, regular] = await Promise.all([
    readFile(path.join(dir, "Poppins-Bold.ttf")),
    readFile(path.join(dir, "Poppins-Medium.ttf")),
    readFile(path.join(dir, "Poppins-Regular.ttf")),
  ]);
  fontCache = {
    bold: bold.toString("base64"),
    medium: medium.toString("base64"),
    regular: regular.toString("base64"),
  };
  return fontCache;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Pequena etiqueta con fondo solido, para que el texto se siga leyendo
// bien aunque una mecha de vela (u otra linea) pase por detras.
function labelPill(x, y, text, { fontSize = 32, color = "#ffffff", anchor = "start" } = {}) {
  const charW = fontSize * 0.6;
  const textW = text.length * charW;
  const padX = 16;
  const boxH = fontSize * 1.5;
  let boxX;
  if (anchor === "end") boxX = x - textW - padX;
  else if (anchor === "middle") boxX = x - textW / 2 - padX;
  else boxX = x - padX;
  const boxW = textW + padX * 2;
  const boxY = y - fontSize * 1.05;
  return (
    `<rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH.toFixed(1)}" rx="10" fill="#05060a" fill-opacity="0.78"/>` +
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${fontSize}" font-weight="700" fill="${color}" text-anchor="${anchor}">${escapeXml(text)}</text>`
  );
}

function formatUSD(n) {
  if (n === null || n === undefined) return "N/D";
  if (n < 1) return `$${n.toFixed(6)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

const COIN_COLORS = {
  bitcoin: ["#f7931a", "#c2680a"],
  ethereum: ["#8fa3ff", "#525ea8"],
  solana: ["#9945ff", "#14f195"],
  ripple: ["#4f6bff", "#1c2340"],
  dogecoin: ["#e8c14a", "#a68221"],
  cardano: ["#3a6ff5", "#1e3a8a"],
  binancecoin: ["#f3ba2f", "#a97a12"],
  "avalanche-2": ["#e84142", "#8a1315"],
  chainlink: ["#4a7ff7", "#1c3f9c"],
  polkadot: ["#ff2fb1", "#96155f"],
};
const DEFAULT_COLORS = ["#60a5fa", "#4338ca"];

const RSI_COLORS = {
  sobrecompra: { bg: "#3a1418", fg: "#ff7a7a", label: "Sobrecompra" },
  sobreventa: { bg: "#0f2e1d", fg: "#4ade80", label: "Sobreventa" },
  neutral: { bg: "#332a0c", fg: "#facc15", label: "Neutral" },
};

const TREND_COLORS = {
  alcista: { fg: "#4ade80", label: "Alcista" },
  bajista: { fg: "#ff7a7a", label: "Bajista" },
};

// Convierte el historial de precios (cierres) en velas japonesas
// sinteticas: open = cierre anterior, close = cierre actual, y una mecha
// (high/low) proporcional al movimiento, para que se vea como un grafico
// de trading real que sube y baja.
function computeCandles(history) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const closes = history.slice(-24).map((p) => p.price);
  const globalRange = Math.max(...closes) - Math.min(...closes) || 1;

  return closes.map((close, i) => {
    const open = i === 0 ? closes[0] : closes[i - 1];
    const isUp = close >= open;
    const bodyTop = Math.max(open, close);
    const bodyBottom = Math.min(open, close);
    const wick = Math.max(Math.abs(close - open) * 0.7, globalRange * 0.03);
    return { open, close, high: bodyTop + wick, low: bodyBottom - wick, bodyTop, bodyBottom, isUp };
  });
}

function makeScaleY(candles, y, h) {
  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const range = max - min || 1;
  return (v) => y + h - ((v - min) / range) * h;
}

// Calcula, a partir de las mismas velas sinteticas que se dibujan en la
// tarjeta, los niveles de soporte/resistencia y una posible zona de
// Volume Imbalance (VI) — el mismo concepto que ya explicamos en el
// dashboard de InvestPanel (hueco entre el cuerpo de una vela y el de la
// vela dos posiciones despues, en la misma direccion, sin contar la
// mecha). Se calcula una sola vez y se reutiliza tanto para dibujarlo en
// el video como para mencionarlo en la descripcion del Reel, asi el
// video y el texto siempre coinciden.
function computeChartInsights(history) {
  const candles = computeCandles(history);
  if (!candles || candles.length < 3) {
    return { candles, support: null, resistance: null, vi: null };
  }

  // Soporte/resistencia: minimo y maximo de la estructura previa (sin
  // contar las ultimas 3 velas), para que representen niveles anteriores
  // que el precio mas reciente podria estar retesteando, en vez de
  // simplemente el extremo de la ultima vela.
  const structural = candles.length > 6 ? candles.slice(0, -3) : candles;
  const resistance = Math.max(...structural.map((c) => c.bodyTop));
  const support = Math.min(...structural.map((c) => c.bodyBottom));

  // Volume Imbalance: se busca, entre todas las velas, el hueco mas
  // grande entre el cuerpo de una vela y el cuerpo de la vela dos
  // posiciones despues (misma direccion). Si no hay ningun hueco por
  // encima del umbral minimo, no se marca ninguna zona — no se inventa.
  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const range = max - min || 1;
  const minGap = range * 0.05;

  let vi = null;
  for (let i = 0; i < candles.length - 2; i++) {
    const a = candles[i];
    const c = candles[i + 2];
    const gapUp = c.bodyBottom - a.bodyTop;
    const gapDown = a.bodyBottom - c.bodyTop;
    if (gapUp > minGap && (!vi || gapUp > vi.gap)) {
      vi = { i, gap: gapUp, bias: "alcista", zoneLow: a.bodyTop, zoneHigh: c.bodyBottom };
    }
    if (gapDown > minGap && (!vi || gapDown > vi.gap)) {
      vi = { i, gap: gapDown, bias: "bajista", zoneLow: c.bodyTop, zoneHigh: a.bodyBottom };
    }
  }

  return { candles, support, resistance, vi };
}

// --- Estructura de mercado estilo SMC (Smart Money Concepts) ---
//
// Ademas del soporte/resistencia y la zona VI de mas arriba, se calcula
// una lectura de estructura mas completa sobre las mismas velas:
// swing highs/lows, un BOS (Break of Structure — el precio rompiendo un
// maximo o minimo previo), el Order Block que origino ese movimiento, un
// nivel de liquidez (un swing anterior, todavia no visitado, donde se
// acumulan stops) y una entrada con relacion riesgo/beneficio (RR) hacia
// el otro extremo del rango. Todo esto sale de los precios reales — si
// no hay una ruptura clara, simplemente no se dibuja nada de esto.
function findSwingPoints(candles, k = 2) {
  const highs = [];
  const lows = [];
  for (let i = k; i < candles.length - k; i++) {
    const windowSlice = candles.slice(i - k, i + k + 1);
    if (candles[i].high === Math.max(...windowSlice.map((c) => c.high))) {
      highs.push({ index: i, price: candles[i].high });
    }
    if (candles[i].low === Math.min(...windowSlice.map((c) => c.low))) {
      lows.push({ index: i, price: candles[i].low });
    }
  }
  return {
