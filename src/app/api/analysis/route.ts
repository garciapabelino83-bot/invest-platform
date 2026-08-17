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

const COINGECKO_IDS: Record<string, string> = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  solana: "solana",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get("coin") || "bitcoin";
  const coingeckoId = COINGECKO_IDS[coin] || "bitcoin";

  // Trae 30 días de precios históricos (gratis, sin API key)
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=30&interval=daily`,
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

  return NextResponse.json({
    coin,
    currentPrice,
    rsi: rsi !== null ? Math.round(rsi * 100) / 100 : null,
    rsiSignal: rsi !== null ? interpretRSI(rsi) : null,
    sma7: sma7 !== null ? Math.round(sma7 * 100) / 100 : null,
    sma30: sma30 !== null ? Math.round(sma30 * 100) / 100 : null,
    trend: sma7 && sma30 ? (sma7 > sma30 ? "alcista" : "bajista") : null,
  });
}
