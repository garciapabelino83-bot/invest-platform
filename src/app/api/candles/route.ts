import { NextResponse } from "next/server";

const COINGECKO_IDS: Record<string, string> = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  solana: "solana",
  cardano: "cardano",
  ripple: "ripple",
  dogecoin: "dogecoin",
  polkadot: "polkadot",
  avalanche: "avalanche-2",
  chainlink: "chainlink",
  litecoin: "litecoin",
};

// Mapea el timeframe elegido al parámetro "days" que espera CoinGecko.
// CoinGecko ajusta la granularidad automáticamente:
// days=1 -> velas de 30 min | days=7 -> velas de 4 horas | days=90 -> velas de varios días
const TIMEFRAME_DAYS: Record<string, number> = {
  "1h": 1,
  "4h": 7,
  "1d": 90,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get("coin") || "bitcoin";
  const timeframe = searchParams.get("tf") || "1d";
  const coingeckoId = COINGECKO_IDS[coin] || "bitcoin";
  const days = TIMEFRAME_DAYS[timeframe] || 90;

  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coingeckoId}/ohlc?vs_currency=usd&days=${days}`,
    { next: { revalidate: 1800 } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "No se pudieron obtener las velas" }, { status: 500 });
  }

  const raw: [number, number, number, number, number][] = await res.json();

  const candles = raw.map(([time, open, high, low, close]) => ({
    time: Math.floor(time / 1000),
    open,
    high,
    low,
    close,
  }));

  return NextResponse.json({ candles });
}
