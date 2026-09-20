import { NextResponse } from "next/server";

// Estadísticas de 24 horas (cambio %, máximo, mínimo, volumen) para la barra
// de precio estilo BingX/Binance encima del gráfico. Mismo origen de datos
// que /api/candles (Binance, sin necesitar cuenta ni llave) y mismo dominio
// "data-api.binance.vision" para evitar el bloqueo geográfico de
// api.binance.com en los servidores de Vercel (EE. UU.).
const SIMBOLO_VALIDO = /^[A-Z0-9]{1,20}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coin = (searchParams.get("coin") || "BTC").toUpperCase();
  const symbol = `${SIMBOLO_VALIDO.test(coin) ? coin : "BTC"}USDT`;

  try {
    const res = await fetch(
      `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol}`,
      { next: { revalidate: 10 } }
    );

    if (!res.ok) {
      throw new Error("No se pudieron obtener las estadísticas de 24h");
    }

    const raw = await res.json();

    return NextResponse.json({
      lastPrice: Number(raw.lastPrice),
      changePercent: Number(raw.priceChangePercent),
      high: Number(raw.highPrice),
      low: Number(raw.lowPrice),
      volume: Number(raw.volume),
      quoteVolume: Number(raw.quoteVolume),
    });
  } catch (err) {
    console.error("Error obteniendo estadísticas de 24h:", err);
    return NextResponse.json(
      { error: "No se pudieron obtener las estadísticas de 24h" },
      { status: 500 }
    );
  }
}
