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
// days=1 -> velas de 30 min | days=7 -> velas de 4 horas | days=30 -> velas de 4 horas
//
// OJO: si se pide days=90 (o más), CoinGecko cambia a velas de 4 EN 4 DÍAS y su
// última vela puede quedar "abierta" varios días, mostrando un precio de cierre
// desactualizado (por eso el gráfico de "1 Día" mostraba un precio viejo). Para
// evitar eso, para "1d" pedimos días=30 (velas de 4 horas, siempre al día) y las
// agrupamos nosotros mismos en velas diarias.
const TIMEFRAME_DAYS: Record<string, number> = {
  "1h": 1,
  "4h": 7,
  "1d": 30,
};

type Candle = { time: number; open: number; high: number; low: number; close: number };

async function fetchOhlc(coingeckoId: string, days: number): Promise<Candle[] | null> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coingeckoId}/ohlc?vs_currency=usd&days=${days}`,
    { next: { revalidate: 1800 } }
  );

  if (!res.ok) return null;

  const raw: [number, number, number, number, number][] = await res.json();

  return raw.map(([time, open, high, low, close]) => ({
    time: Math.floor(time / 1000),
    open,
    high,
    low,
    close,
  }));
}

// Junta velas de 4 horas en velas de 1 día (00:00 UTC a 00:00 UTC), para que el
// día de hoy siempre aparezca con el precio más reciente en vez de quedar vacío.
function aggregateToDaily(candles: Candle[]): Candle[] {
  const DAY = 86400;
  const buckets = new Map<number, Candle>();

  for (const c of candles) {
    const dayStart = Math.floor(c.time / DAY) * DAY;
    const existing = buckets.get(dayStart);
    if (!existing) {
      buckets.set(dayStart, { time: dayStart, open: c.open, high: c.high, low: c.low, close: c.close });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get("coin") || "bitcoin";
  const timeframe = searchParams.get("tf") || "1d";
  const coingeckoId = COINGECKO_IDS[coin] || "bitcoin";
  const days = TIMEFRAME_DAYS[timeframe] || 30;

  const raw = await fetchOhlc(coingeckoId, days);

  if (!raw) {
    return NextResponse.json({ error: "No se pudieron obtener las velas" }, { status: 500 });
  }

  const candles = timeframe === "1d" ? aggregateToDaily(raw) : raw;

  return NextResponse.json({ candles });
}
