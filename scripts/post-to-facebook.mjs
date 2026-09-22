import { renderAnalysisCard } from "./render-card.mjs";

const PAGE_ID = process.env.FB_PAGE_ID || "1361643533693650";
const ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const SITE_URL = "https://invest-platform-chi.vercel.app";

if (!ACCESS_TOKEN) {
  console.error("Falta la variable FB_PAGE_ACCESS_TOKEN");
  process.exit(1);
}

// Lista de monedas que vamos rotando para no publicar siempre lo mismo
const COINS = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH" },
  { id: "solana", name: "Solana", symbol: "SOL" },
  { id: "ripple", name: "XRP", symbol: "XRP" },
  { id: "dogecoin", name: "Dogecoin", symbol: "DOGE" },
  { id: "cardano", name: "Cardano", symbol: "ADA" },
  { id: "binancecoin", name: "BNB", symbol: "BNB" },
  { id: "avalanche-2", name: "Avalanche", symbol: "AVAX" },
  { id: "chainlink", name: "Chainlink", symbol: "LINK" },
  { id: "polkadot", name: "Polkadot", symbol: "DOT" },
];

// Elige una moneda distinta segun el dia del anio y la hora, para variar
// el contenido publicado sin necesidad de guardar estado en ningun lado.
function pickCoinOfTheRun() {
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 0));
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86400000);
  const hourSlot = new Date().getUTCHours() < 18 ? 0 : 1; // 2 publicaciones al dia
  const index = (dayOfYear * 2 + hourSlot) % COINS.length;
  return COINS[index];
}

function formatUSD(n) {
  if (n === null || n === undefined) return "N/D";
  if (n < 1) return `$${n.toFixed(6)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

async function fetchAnalysis(coinId) {
  const res = await fetch(`${SITE_URL}/api/analysis?coin=${coinId}`);
  if (!res.ok) {
    throw new Error(`No se pudo obtener el analisis (status ${res.status})`);
  }
  return res.json();
}

function buildCaption(coin, data) {
  const price = formatUSD(data.currentPrice);
  const rsiTxt = data.rsiSignal
    ? `RSI ${data.rsi} (${data.rsiSignal})`
    : "RSI no disponible por ahora";
  const trendTxt = data.trend ? `Tendencia ${data.trend}` : "Tendencia no disponible por ahora";

  return [
    `${coin.name} (${coin.symbol}) - Analisis tecnico`,
    "",
    `Precio actual: ${price}`,
    rsiTxt,
    trendTxt,
    "",
    "Consulta el analisis completo, graficos en vivo y mas de 45 criptomonedas gratis en InvestPanel:",
    SITE_URL,
    "",
    "#Bitcoin #Criptomonedas #Trading #InvestPanel",
  ].join("\n");
}

async function postPhotoToFacebook(imageBuffer, caption) {
  const url = `https://graph.facebook.com/v21.0/${PAGE_ID}/photos`;
  const form = new FormData();
  form.append("caption", caption);
  form.append("access_token", ACCESS_TOKEN);
  form.append("source", new Blob([imageBuffer], { type: "image/png" }), "analisis.png");

  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Error al publicar en Facebook: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const coin = pickCoinOfTheRun();
  console.log(`Publicando analisis de ${coin.name}...`);
  const data = await fetchAnalysis(coin.id);
  const caption = buildCaption(coin, data);
  console.log("Descripcion:\n" + caption);

  const imageBuffer = await renderAnalysisCard(coin, data);
  console.log(`Imagen generada (${imageBuffer.length} bytes)`);

  const result = await postPhotoToFacebook(imageBuffer, caption);
  console.log("Publicado con exito. Post ID:", result.post_id || result.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
