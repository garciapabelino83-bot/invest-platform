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

function buildCandlesSvg(candles, x, y, w, h) {
  const scaleY = makeScaleY(candles, y, h);
  const n = candles.length;
  const slot = w / n;
  const bodyWidth = Math.max(slot * 0.5, 8);

  return candles
    .map((c, i) => {
      const cx = x + slot * (i + 0.5);
      const color = c.isUp ? "#4ade80" : "#ff7a7a";
      const yHigh = scaleY(c.high);
      const yLow = scaleY(c.low);
      const yTop = scaleY(c.bodyTop);
      const yBottom = scaleY(c.bodyBottom);
      const bodyH = Math.max(yBottom - yTop, 8);
      return (
        `<line x1="${cx.toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${yLow.toFixed(1)}" stroke="${color}" stroke-width="6"/>` +
        `<rect x="${(cx - bodyWidth / 2).toFixed(1)}" y="${yTop.toFixed(1)}" width="${bodyWidth.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="5" fill="${color}"/>`
      );
    })
    .join("");
}

// Lineas punteadas de soporte (verde) y resistencia (roja) sobre el
// grafico, con su precio, dibujadas detras de las velas.
function buildLevelsSvg(candles, insights, x, y, w, h) {
  if (!insights || insights.support === null || insights.resistance === null) return "";
  const scaleY = makeScaleY(candles, y, h);

  const line = (value, color, label) => {
    const ly = scaleY(value);
    const ty = ly - 16 > y ? ly - 16 : ly + 40;
    return (
      `<line x1="${x}" y1="${ly.toFixed(1)}" x2="${x + w}" y2="${ly.toFixed(1)}" stroke="${color}" stroke-width="4" stroke-dasharray="14 12" opacity="0.85"/>` +
      `<text x="${x + w}" y="${ty.toFixed(1)}" font-size="38" font-weight="600" fill="${color}" text-anchor="end">${label} ${escapeXml(formatUSD(value))}</text>`
    );
  };

  return line(insights.resistance, "#ff7a7a", "Resistencia") + line(insights.support, "#4ade80", "Soporte");
}

// Zona de Volume Imbalance: un rectangulo punteado semitransparente
// detras de las velas que la formaron, con una pequena etiqueta "VI".
function buildViSvg(candles, insights, x, y, w, h) {
  if (!insights || !insights.vi) return "";
  const { i, bias, zoneLow, zoneHigh } = insights.vi;
  const scaleY = makeScaleY(candles, y, h);
  const n = candles.length;
  const slot = w / n;
  const xStart = x + slot * i;
  const xEnd = x + slot * (i + 3);
  const yTop = scaleY(zoneHigh);
  const yBottom = scaleY(zoneLow);
  const rectH = Math.max(yBottom - yTop, 6);
  const color = bias === "alcista" ? "#4ade80" : "#ff7a7a";
  const labelY = yTop + rectH / 2 + 12;

  return (
    `<rect x="${xStart.toFixed(1)}" y="${yTop.toFixed(1)}" width="${(xEnd - xStart).toFixed(1)}" height="${rectH.toFixed(1)}" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="3" stroke-dasharray="10 8"/>` +
    `<text x="${(xStart + 14).toFixed(1)}" y="${labelY.toFixed(1)}" font-size="34" font-weight="700" fill="${color}">VI</text>`
  );
}

// Cuadricula tenue que ocupa el mismo espacio que las velas, para que la
// variante "vacia" no se vea como un hueco sino como un grafico esperando
// a dibujarse.
function buildGrid(x, y, w, h) {
  const rows = 4;
  let lines = "";
  for (let i = 0; i <= rows; i++) {
    const ly = y + (h / rows) * i;
    lines += `<line x1="${x}" y1="${ly.toFixed(1)}" x2="${x + w}" y2="${ly.toFixed(1)}" stroke="#1c1d21" stroke-width="3" stroke-dasharray="16 18"/>`;
  }
  return lines;
}

function buildCardSvg(coin, data, { withCandles }) {
  return loadFontsBase64().then((fonts) => {
    const W = 2160;
    const H = 3840;
    const pad = 128;
    const chartX = pad;
    const chartY = 2050;
    const chartW = W - pad * 2;
    const chartH = 460;

    const price = formatUSD(data.currentPrice);
    const rsiInfo = data.rsiSignal ? RSI_COLORS[data.rsiSignal] : null;
    const rsiValue = data.rsi !== null && data.rsi !== undefined ? data.rsi.toFixed(1) : "N/D";
    const trendInfo = data.trend ? TREND_COLORS[data.trend] : null;
    const [c1, c2] = COIN_COLORS[coin.id] || DEFAULT_COLORS;

    const history = Array.isArray(data.history) ? data.history.slice(-30) : [];
    let changePct = null;
    if (history.length >= 2) {
      const first = history[0].price;
      const last = history[history.length - 1].price;
      if (first) changePct = ((last - first) / first) * 100;
    }
    const changeColor = changePct === null ? "#8a8d93" : changePct >= 0 ? "#4ade80" : "#ff7a7a";
    const changeLabel =
      changePct === null ? "" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}% en 30 dias`;

    const insights = computeChartInsights(history);
    const chartContent =
      withCandles && insights.candles
        ? buildLevelsSvg(insights.candles, insights, chartX, chartY, chartW, chartH) +
          buildViSvg(insights.candles, insights, chartX, chartY, chartW, chartH) +
          buildCandlesSvg(insights.candles, chartX, chartY, chartW, chartH)
        : buildGrid(chartX, chartY, chartW, chartH);
    const viLine = insights.vi
      ? `<text x="${pad}" y="3400" font-size="46" font-weight="600" fill="${insights.vi.bias === "alcista" ? "#4ade80" : "#ff7a7a"}">Zona VI detectada &#183; sesgo ${insights.vi.bias}</text>`
      : "";

    const initials = escapeXml(coin.symbol.slice(0, 4));

    return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face { font-family: 'Poppins'; font-weight: 700; src: url(data:font/ttf;base64,${fonts.bold}) format('truetype'); }
      @font-face { font-family: 'Poppins'; font-weight: 600; src: url(data:font/ttf;base64,${fonts.medium}) format('truetype'); }
      @font-face { font-family: 'Poppins'; font-weight: 400; src: url(data:font/ttf;base64,${fonts.regular}) format('truetype'); }
      text { font-family: 'Poppins', 'Arial', sans-serif; }
    </style>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#111319"/>
      <stop offset="55%" stop-color="#0a0b0e"/>
      <stop offset="100%" stop-color="#050506"/>
    </linearGradient>
    <radialGradient id="glow" cx="20%" cy="14%" r="45%">
      <stop offset="0%" stop-color="${c1}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${c1}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="coinBadge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Header -->
  <rect x="${pad}" y="150" width="70" height="70" rx="18" fill="url(#coinBadge)"/>
  <text x="${pad + 92}" y="205" font-size="68" font-weight="700" fill="#ffffff">InvestPanel</text>
  <line x1="${pad}" y1="270" x2="${W - pad}" y2="270" stroke="#1c1d21" stroke-width="4"/>

  <!-- Coin -->
  <rect x="${pad}" y="360" width="260" height="260" rx="60" fill="url(#coinBadge)"/>
  <text x="${pad + 130}" y="510" font-size="88" font-weight="700" fill="#0a0a0b" text-anchor="middle">${initials}</text>
  <text x="${pad + 300}" y="450" font-size="104" font-weight="700" fill="#ffffff">${escapeXml(coin.name)}</text>
  <text x="${pad + 300}" y="530" font-size="58" font-weight="400" fill="#8a8d93">${escapeXml(coin.symbol)} / USD &#183; Analisis tecnico</text>

  <!-- Price -->
  <text x="${pad}" y="880" font-size="54" font-weight="600" fill="#71747c" letter-spacing="3">PRECIO ACTUAL</text>
  <text x="${pad}" y="1060" font-size="210" font-weight="700" fill="#ffffff">${escapeXml(price)}</text>
  ${
    changePct !== null
      ? `<rect x="${pad}" y="1110" width="${changeLabel.length * 30 + 80}" height="100" rx="50" fill="#16171b"/>
         <text x="${pad + 40}" y="1178" font-size="50" font-weight="600" fill="${changeColor}">${changeLabel}</text>`
      : ""
  }

  <!-- Grafico de velas -->
  ${chartContent}
  <line x1="${pad}" y1="2560" x2="${W - pad}" y2="2560" stroke="#1c1d21" stroke-width="4"/>

  <!-- RSI + Trend -->
  <rect x="${pad}" y="2640" width="${W - pad * 2}" height="320" rx="48" fill="${rsiInfo ? rsiInfo.bg : "#16171b"}"/>
  <text x="${pad + 64}" y="2740" font-size="50" font-weight="600" fill="${rsiInfo ? rsiInfo.fg : "#8a8d93"}" opacity="0.85">RSI (14)</text>
  <text x="${pad + 64}" y="2840" font-size="92" font-weight="700" fill="${rsiInfo ? rsiInfo.fg : "#ffffff"}">${rsiValue} ${rsiInfo ? "&#183; " + rsiInfo.label : ""}</text>

  <rect x="${pad}" y="3000" width="${W - pad * 2}" height="320" rx="48" fill="#16171b"/>
  <text x="${pad + 64}" y="3100" font-size="50" font-weight="600" fill="#8a8d93">Tendencia (SMA 7/30)</text>
  <text x="${pad + 64}" y="3200" font-size="92" font-weight="700" fill="${trendInfo ? trendInfo.fg : "#ffffff"}">${trendInfo ? (data.trend === "alcista" ? "&#9650;" : "&#9660;") : ""} ${trendInfo ? trendInfo.label : "N/D"}</text>

  <!-- Volume Imbalance (VI), solo si se detecto una zona en el historial -->
  ${viLine}

  <!-- Footer -->
  <text x="${pad}" y="3460" font-size="70" font-weight="700" fill="#ffffff">+45 criptomonedas &#183; graficos en vivo &#183; gratis</text>
  <text x="${pad}" y="3540" font-size="60" font-weight="600" fill="${c1}">invest-platform-chi.vercel.app</text>
  <text x="${pad}" y="3660" font-size="42" font-weight="400" fill="#5b5e66">No es asesoria financiera. Informate y decide con responsabilidad.</text>
</svg>`;
  });
}

// Devuelve las dos variantes (PNG) que necesita el video: "empty" (sin
// velas, para el instante inicial) y "full" (con las velas ya dibujadas,
// que se revela progresivamente encima de la vacia).
export async function renderReelLayers(coin, data) {
  const [emptySvg, fullSvg] = await Promise.all([
    buildCardSvg(coin, data, { withCandles: false }),
    buildCardSvg(coin, data, { withCandles: true }),
  ]);
  const [empty, full] = await Promise.all([
    sharp(Buffer.from(emptySvg)).png().toBuffer(),
    sharp(Buffer.from(fullSvg)).png().toBuffer(),
  ]);
  return { empty, full };
}

// Se mantiene por compatibilidad: la tarjeta completa (con velas) sola.
export async function renderReelBackground(coin, data) {
  const { full } = await renderReelLayers(coin, data);
  return full;
}

// Se exporta tambien para que el script que arma la descripcion del Reel
// pueda mencionar el mismo soporte/resistencia y la misma zona VI que se
// dibujan en el video (un solo calculo, sin duplicar logica).
export { computeChartInsights, formatUSD };
