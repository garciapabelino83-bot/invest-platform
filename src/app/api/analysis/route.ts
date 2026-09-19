import { NextResponse } from "next/server";

// Calcula el RSI (Índice de Fuerza Relativa) de una serie de precios
function calculateRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Calcula la media móvil simple de los últimos N precios
function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

function interpretRSI(rsi: number): string {
  if (rsi >= 70) return "sobrecompra";
  if (rsi <= 30) return "sobreventa";
  return "neutral";
}

// Ids válidos de CoinGecko — debe incluir todas las monedas que ofrecemos
// en ALL_COINS (src/app/page.tsx). Antes este mapa usaba claves cortas
// ("avalanche") que no coincidían con los ids reales que manda el
// dashboard ("avalanche-2"), así que el análisis técnico de varias
// monedas caía siempre al "|| bitcoin" y mostraba los datos de Bitcoin
// por error. Ahora validamos el id tal cual llega.
const COINGECKO_IDS_VALIDOS = new Set([
  "bitcoin", "ethereum", "solana", "cardano", "ripple", "dogecoin",
  "polkadot", "avalanche-2", "chainlink", "litecoin", "binancecoin",
  "tron", "the-open-network", "matic-network", "cosmos", "near",
  "arbitrum", "optimism", "sui", "aptos", "injective-protocol",
  "uniswap", "aave", "the-sandbox", "decentraland", "fantom",
  "algorand", "vechain", "internet-computer", "filecoin",
  "hedera-hashgraph", "stellar", "ethereum-classic", "bitcoin-cash",
  "eos", "the-graph", "lido-dao", "thorchain", "celestia",
  "sei-network", "worldcoin-wld", "shiba-inu", "pepe", "floki",
  "bonk", "dogwifcoin", "pudgy-penguins", "ordi",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get("coin") || "bitcoin";
  const coingeckoId = COINGECKO_IDS_VALIDOS.has(coin) ? coin : "bitcoin";

  // Trae 30 días de precios históricos (gratis, sin API key)
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=90&interval=daily`,
    { next: { revalidate: 3600 } } // se actualiza cada hora
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "No se pudo obtener el historial de precios" },
      { status: 500 }
    );
  }

  const data = await res.json();
  const prices: number[] = data.prices.map((p: [number, number]) => p[1]);

  const rsi = calculateRSI(prices, 14);
  const sma7 = calculateSMA(prices, 7);
  const sma30 = calculateSMA(prices, 30);
  const currentPrice = prices[prices.length - 1];

  // Historial diario para graficar (fecha + precio). Antes esto redondeaba
  // a 2 decimales fijos (Math.round(p*100)/100), lo cual está bien para
  // Bitcoin pero convierte en "0" el precio de cualquier memecoin que
  // valga fracciones de centavo (ej. PEPE a $0.0000123). Mandamos el
  // precio completo sin redondear y dejamos que la interfaz decida cuántos
  // decimales mostrar según la magnitud de cada moneda.
  const history = data.prices.map((p: [number, number]) => ({
    date: new Date(p[0]).toISOString().split("T")[0],
    price: p[1],
  }));

  return NextResponse.json({
    coin,
    currentPrice,
    rsi: rsi !== null ? Math.round(rsi * 100) / 100 : null,
    rsiSignal: rsi !== null ? interpretRSI(rsi) : null,
    sma7,
    sma30,
    trend: sma7 && sma30 ? (sma7 > sma30 ? "alcista" : "bajista") : null,
    history,
  });
}
