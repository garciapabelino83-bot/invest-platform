import { NextResponse } from "next/server";
import { MONEDAS_IDS_VALIDOS } from "@/lib/monedas";

// Trae el historial de precios de varias monedas a la vez (para el
// comparador) y los devuelve ya normalizados a "% de cambio desde el
// inicio del período", para poder graficarlos juntos aunque una valga
// $60,000 (Bitcoin) y otra $0.0001 (una memecoin).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coinsParam = searchParams.get("coins") || "";
  const days = searchParams.get("days") || "30";

  const coins = coinsParam
    .split(",")
    .map((c) => c.trim())
    .filter((c) => MONEDAS_IDS_VALIDOS.has(c))
    // Máximo 4 monedas a la vez: alcanza para comparar y evita pegarle
    // demasiadas peticiones simultáneas a la API gratuita de CoinGecko.
    .slice(0, 4);

  if (coins.length < 2) {
    return NextResponse.json(
      { error: "Elige al menos 2 monedas para comparar" },
      { status: 400 }
    );
  }

  const diasValidos = new Set(["7", "30", "90", "365"]);
  const diasFinal = diasValidos.has(days) ? days : "30";

  try {
    const resultados = await Promise.all(
      coins.map(async (id) => {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${diasFinal}&interval=daily`,
          { next: { revalidate: 3600 } }
        );
        if (!res.ok) throw new Error(`No se pudo obtener el historial de ${id}`);
        const data = await res.json();
        const precios: { date: string; price: number }[] = data.prices.map(
          (p: [number, number]) => ({
            date: new Date(p[0]).toISOString().split("T")[0],
            price: p[1],
          })
        );
        const inicio = precios[0]?.price ?? 0;
        const actual = precios[precios.length - 1]?.price ?? 0;
        const cambioPct = inicio !== 0 ? ((actual - inicio) / inicio) * 100 : 0;

        return {
          coin: id,
          currentPrice: actual,
          changePct: cambioPct,
          // Serie normalizada: cuánto % subió o bajó cada día respecto al
          // primer precio del período, para poder graficar varias monedas
          // juntas en la misma escala.
          history: precios.map((p) => ({
            date: p.date,
            price: p.price,
            pct: inicio !== 0 ? ((p.price - inicio) / inicio) * 100 : 0,
          })),
        };
      })
    );

    return NextResponse.json({ days: diasFinal, coins: resultados });
  } catch (err) {
    console.error("Error comparando monedas:", err);
    return NextResponse.json(
      { error: "No se pudo comparar esas monedas en este momento" },
      { status: 500 }
    );
  }
}
