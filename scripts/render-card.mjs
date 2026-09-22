import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Genera una tarjeta (imagen PNG) con el analisis tecnico de una moneda,
// con un acabado tipo app fintech: tipografia propia (Poppins embebida,
// para que se vea igual en cualquier maquina que corra el script), color
// de marca por moneda, mini-grafico de la tendencia reciente y jerarquia
// visual clara (precio grande, RSI y tendencia como badges).

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

// Colores de marca aproximados por moneda; las que no esten en la lista
// usan un degrade neutro azul/violeta que igual se ve bien.
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

// Construye un mini-grafico de linea con relleno degradado a partir del
// historial de precios (usa como maximo los ultimos 30 puntos).
function buildSparkline(history, color, x, y, w, h) {
  if (!Array.isArray(history) || history.length < 2) return "";
  const points = history.slice(-30).map((p) => p.price);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const px = x + (i / (points.length - 1)) * w;
    const py = y + h - ((p - min) / range) * h;
    return [px, py];
  });

  const linePath = coords
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(" ");

  const areaPath =
    `M${coords[0][0].toFixed(1)},${(y + h).toFixed(1)} ` +
    coords.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join(" ") +
    ` L${coords[coords.length - 1][0].toFixed(1)},${(y + h).toFixed(1)} Z`;

  return `
    <path d="${areaPath}" fill="url(#sparkFill)" opacity="0.35"/>
    <path d="${linePath}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

export async function renderAnalysisCard(coin, data) {
  const fonts = await loadFontsBase64();

  const W = 1080;
  const H = 1350;
  const pad = 64;

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
    changePct === null ? "" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}% (30d)`;

  const sparkColor = trendInfo ? trendInfo.fg : "#60a5fa";
  const sparkline = buildSparkline(history, sparkColor, pad, 700, W - pad * 2, 170);

  const initials = escapeXml(coin.symbol.slice(0, 4));
  const today = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const svg = `
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

    <radialGradient id="glow" cx="15%" cy="18%" r="55%">
      <stop offset="0%" stop-color="${c1}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${c1}" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="coinBadge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>

    <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sparkColor}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${sparkColor}" stop-opacity="0"/>
    </linearGradient>

    <linearGradient id="cardBorder" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a2c33"/>
      <stop offset="100%" stop-color="#16171b"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="36" fill="none" stroke="url(#cardBorder)" stroke-width="2"/>

  <!-- Header -->
  <g>
    <rect x="${pad}" y="66" width="34" height="34" rx="9" fill="url(#coinBadge)"/>
    <text x="${pad + 46}" y="93" font-size="34" font-weight="700" fill="#ffffff">InvestPanel</text>
    <text x="${W - pad}" y="93" font-size="24" font-weight="400" fill="#71747c" text-anchor="end">${escapeXml(today)}</text>
  </g>
  <line x1="${pad}" y1="128" x2="${W - pad}" y2="128" stroke="#1c1d21" stroke-width="2"/>

  <!-- Coin -->
  <g>
    <rect x="${pad}" y="176" width="132" height="132" rx="32" fill="url(#coinBadge)"/>
    <text x="${pad + 66}" y="256" font-size="46" font-weight="700" fill="#0a0a0b" text-anchor="middle">${initials}</text>

    <text x="${pad + 156}" y="230" font-size="52" font-weight="700" fill="#ffffff">${escapeXml(coin.name)}</text>
    <text x="${pad + 156}" y="270" font-size="30" font-weight="400" fill="#8a8d93">${escapeXml(coin.symbol)} / USD &#183; Analisis tecnico</text>
  </g>

  <!-- Price -->
  <text x="${pad}" y="420" font-size="28" font-weight="600" fill="#71747c" letter-spacing="2">PRECIO ACTUAL</text>
  <text x="${pad}" y="512" font-size="104" font-weight="700" fill="#ffffff">${escapeXml(price)}</text>
  ${
    changePct !== null
      ? `<rect x="${pad}" y="536" width="${changeLabel.length * 15 + 40}" height="52" rx="26" fill="#16171b"/>
         <text x="${pad + 20}" y="571" font-size="26" font-weight="600" fill="${changeColor}">${changeLabel}</text>`
      : ""
  }

  <!-- Sparkline -->
  ${sparkline}
  <line x1="${pad}" y1="878" x2="${W - pad}" y2="878" stroke="#1c1d21" stroke-width="2"/>

  <!-- RSI + Trend badges (texto en lineas separadas para que nunca se corte) -->
  <rect x="${pad}" y="920" width="440" height="160" rx="24" fill="${rsiInfo ? rsiInfo.bg : "#16171b"}"/>
  <text x="${pad + 32}" y="964" font-size="25" font-weight="600" fill="${rsiInfo ? rsiInfo.fg : "#8a8d93"}" opacity="0.85">RSI (14)</text>
  <text x="${pad + 32}" y="1018" font-size="46" font-weight="700" fill="${rsiInfo ? rsiInfo.fg : "#ffffff"}">${rsiValue}</text>
  <text x="${pad + 32}" y="1054" font-size="26" font-weight="600" fill="${rsiInfo ? rsiInfo.fg : "#8a8d93"}">${rsiInfo ? rsiInfo.label : ""}</text>

  <rect x="${pad + 460}" y="920" width="440" height="160" rx="24" fill="#16171b"/>
  <text x="${pad + 492}" y="964" font-size="25" font-weight="600" fill="#8a8d93">Tendencia (SMA 7/30)</text>
  <text x="${pad + 492}" y="1018" font-size="46" font-weight="700" fill="${trendInfo ? trendInfo.fg : "#ffffff"}">${trendInfo ? (data.trend === "alcista" ? "&#9650;" : "&#9660;") : ""} ${trendInfo ? trendInfo.label : "N/D"}</text>

  <!-- Footer -->
  <text x="${pad}" y="1160" font-size="34" font-weight="700" fill="#ffffff">+45 criptomonedas &#183; graficos en vivo &#183; gratis</text>
  <text x="${pad}" y="1202" font-size="30" font-weight="600" fill="${c1}">invest-platform-chi.vercel.app</text>

  <text x="${pad}" y="1272" font-size="22" font-weight="400" fill="#5b5e66">No es asesoria financiera. Informate y decide con responsabilidad.</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
