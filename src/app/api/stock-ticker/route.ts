import { NextResponse } from "next/server";

// Estadísticas del día (precio, cambio %, máximo, mínimo, volumen) para
// acciones e índices bursátiles, para la misma barra de precio estilo
// exchange que ya usamos para cripto. Yahoo trae todo esto en el bloque
// "meta" de su API de gráficos, así que no hace falta una llamada aparte.
const SIMBOLO_VALIDO = /^[A-Z0-9.^=-]{1,15}$/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const simboloParam = (searchParams.get("symbol") || "").trim();

  if (!simboloParam || !SIMBOLO_VALIDO.test(simboloParam)) {
    return NextResponse.json({ error: "Símbolo inválido" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simboloParam)}?interval=1d&range=5d`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        },
        next: { revalidate: 15 },
      }
    );

    if (!res.ok) {
      throw new Error("No se pudieron obtener las estadísticas");
    }

    const data = await res.json();
    const resultado = data?.chart?.result?.[0];
    if (!resultado) {
      throw new Error(data?.chart?.error?.description || "Símbolo no encontrado");
    }

    const meta = resultado.meta || {};
    const lastPrice = meta.regularMarketPrice ?? null;
    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const changePercent =
      lastPrice != null && previousClose ? ((lastPrice - previousClose) / previousClose) * 100 : null;

    return NextResponse.json({
      symbol: meta.symbol,
      nombre: meta.longName || meta.shortName || meta.symbol,
      moneda: meta.currency,
      bolsa: meta.fullExchangeName || meta.exchangeName,
      lastPrice,
      changePercent,
      high: meta.regularMarketDayHigh ?? null,
      low: meta.regularMarketDayLow ?? null,
      volume: meta.regularMarketVolume ?? null,
      mercadoAbierto: meta.marketState === "REGULAR",
    });
  } catch (err) {
    console.error("Error obteniendo estadísticas de acción/índice:", err);
    return NextResponse.json({ error: "No se pudieron obtener las estadísticas" }, { status: 500 });
  }
}
