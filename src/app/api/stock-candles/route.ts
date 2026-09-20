import { NextResponse } from "next/server";

// Velas de acciones e índices bursátiles usando la API pública de gráficos
// de Yahoo Finance (no hace falta cuenta ni llave). Símbolos como en Yahoo:
// "AAPL", "MSFT", "^GSPC" (S&P 500), "^IBEX" (IBEX 35), "^GDAXI" (DAX), etc.
const SIMBOLO_VALIDO = /^[A-Z0-9.^=-]{1,15}$/i;

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// Nuestras temporalidades -> intervalo y rango que entiende Yahoo Finance.
// Yahoo no tiene "1 segundo" (lo más fino es 1 minuto) ni "4 horas" nativo
// (lo armamos agrupando velas de 1 hora de a 4).
const TF_A_YAHOO: Record<string, { interval: string; range: string; agrupar4h?: boolean }> = {
  "1s": { interval: "1m", range: "5d" },
  "1m": { interval: "1m", range: "5d" },
  "5m": { interval: "5m", range: "1mo" },
  "15m": { interval: "15m", range: "1mo" },
  "30m": { interval: "30m", range: "3mo" },
  "1h": { interval: "60m", range: "1y" },
  "4h": { interval: "60m", range: "2y", agrupar4h: true },
  "1d": { interval: "1d", range: "5y" },
  "1w": { interval: "1wk", range: "10y" },
  "1M": { interval: "1mo", range: "20y" },
  "1A": { interval: "1mo", range: "max" },
};

// Agrupa velas consecutivas de a N (por posición, no por reloj) — misma
// idea que usamos para armar velas anuales a partir de mensuales en
// /api/candles, aplicada aquí para armar 4h a partir de 1h.
function agrupar(candles: Candle[], n: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += n) {
    const grupo = candles.slice(i, i + n);
    if (grupo.length === 0) continue;
    out.push({
      time: grupo[0].time,
      open: grupo[0].open,
      high: Math.max(...grupo.map((c) => c.high)),
      low: Math.min(...grupo.map((c) => c.low)),
      close: grupo[grupo.length - 1].close,
      volume: grupo.reduce((sum, c) => sum + c.volume, 0),
    });
  }
  return out;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const simboloParam = (searchParams.get("symbol") || "").trim();
  const tf = searchParams.get("tf") || "1d";

  if (!simboloParam || !SIMBOLO_VALIDO.test(simboloParam)) {
    return NextResponse.json({ error: "Símbolo inválido" }, { status: 400 });
  }

  const config = TF_A_YAHOO[tf] || TF_A_YAHOO["1d"];

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simboloParam)}?interval=${config.interval}&range=${config.range}`,
      {
        headers: {
          // Yahoo Finance rechaza peticiones sin un User-Agent de navegador.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        },
        next: { revalidate: 30 },
      }
    );

    if (!res.ok) {
      throw new Error("No se pudieron obtener las velas");
    }

    const data = await res.json();
    const resultado = data?.chart?.result?.[0];
    if (!resultado) {
      throw new Error(data?.chart?.error?.description || "Símbolo no encontrado");
    }

    const timestamps: number[] = resultado.timestamp || [];
    const quote = resultado.indicators?.quote?.[0] || {};
    const { open = [], high = [], low = [], close = [], volume = [] } = quote;

    let candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (
        open[i] == null ||
        high[i] == null ||
        low[i] == null ||
        close[i] == null
      ) {
        continue; // huecos sin operaciones (fines de semana, feriados, etc.)
      }
      candles.push({
        time: timestamps[i],
        open: open[i],
        high: high[i],
        low: low[i],
        close: close[i],
        volume: volume[i] || 0,
      });
    }

    if (config.agrupar4h) {
      candles = agrupar(candles, 4);
    }

    const meta = resultado.meta || {};

    return NextResponse.json({
      candles,
      meta: {
        symbol: meta.symbol,
        nombre: meta.longName || meta.shortName || meta.symbol,
        moneda: meta.currency,
        bolsa: meta.fullExchangeName || meta.exchangeName,
      },
    });
  } catch (err) {
    console.error("Error obteniendo velas de acciones/índices:", err);
    return NextResponse.json({ error: "No se pudieron obtener las velas" }, { status: 500 });
  }
}
