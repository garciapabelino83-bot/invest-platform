import { NextResponse } from "next/server";

// Usamos los datos públicos de mercado de Binance (no hace falta cuenta ni
// llave): traen precio Y volumen, y soportan temporalidades desde segundos
// hasta meses, algo que la fuente anterior (CoinGecko) no podía dar todo
// junto de forma gratuita.
const BINANCE_SYMBOLS: Record<string, string> = {
  bitcoin: "BTCUSDT",
  ethereum: "ETHUSDT",
  solana: "SOLUSDT",
  cardano: "ADAUSDT",
  ripple: "XRPUSDT",
  dogecoin: "DOGEUSDT",
  polkadot: "DOTUSDT",
  avalanche: "AVAXUSDT",
  chainlink: "LINKUSDT",
  litecoin: "LTCUSDT",
};

// Temporalidades que Binance entiende directamente.
const BINANCE_INTERVALS = new Set([
  "1s",
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
]);

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// Usamos el dominio "data-api.binance.vision": es la misma información de
// mercado pública de Binance, pero sin el bloqueo geográfico que tiene
// api.binance.com para servidores en Estados Unidos (donde corre Vercel).
async function fetchKlines(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const res = await fetch(
    `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    { next: { revalidate: interval === "1s" ? 5 : 30 } }
  );

  if (!res.ok) {
    throw new Error("No se pudieron obtener las velas");
  }

  const raw: (string | number)[][] = await res.json();

  return raw.map((k) => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

// "1A" (temporalidad de años) no existe en Binance: pedimos velas
// mensuales y las agrupamos nosotros mismos de 12 en 12 meses.
function aggregateYearly(candles: Candle[]): Candle[] {
  const buckets = new Map<number, Candle>();

  for (const c of candles) {
    const year = new Date(c.time * 1000).getUTCFullYear();
    const key = Date.UTC(year, 0, 1) / 1000;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { ...c, time: key });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume += c.volume;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get("coin") || "bitcoin";
  const tf = searchParams.get("tf") || "1d";
  const symbol = BINANCE_SYMBOLS[coin] || "BTCUSDT";

  try {
    if (tf === "1A") {
      const raw = await fetchKlines(symbol, "1M", 1000);
      return NextResponse.json({ candles: aggregateYearly(raw) });
    }

    const interval = BINANCE_INTERVALS.has(tf) ? tf : "1d";
    const limit = interval === "1s" ? 1000 : 500;
    const candles = await fetchKlines(symbol, interval, limit);
    return NextResponse.json({ candles });
  } catch (err) {
    console.error("Error obteniendo velas:", err);
    return NextResponse.json({ error: "No se pudieron obtener las velas" }, { status: 500 });
  }
}
