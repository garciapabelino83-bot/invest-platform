import { NextResponse } from "next/server";

// Lista completa de monedas que se pueden elegir en /graficos: le pedimos a
// Binance los precios de las últimas 24 horas de TODOS los pares contra
// USDT (bitcoin, ethereum, altcoins, memecoins, lo que sea que Binance
// tenga listado) y las ordenamos por volumen de operaciones, para que las
// más usadas/conocidas aparezcan primero.
export async function GET() {
  try {
    const res = await fetch("https://data-api.binance.vision/api/v3/ticker/24hr", {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error("No se pudo obtener la lista de activos");
    }

    const raw: { symbol: string; quoteVolume: string }[] = await res.json();

    const vistos = new Set<string>();
    const monedas: { symbol: string; volumen: number }[] = [];

    for (const t of raw) {
      if (!t.symbol.endsWith("USDT")) continue;
      // Excluimos los "tokens apalancados" (ej. BTCUPUSDT) que no son
      // criptomonedas normales, sino productos apalancados de Binance.
      if (/(UP|DOWN|BULL|BEAR)USDT$/.test(t.symbol)) continue;

      const base = t.symbol.slice(0, -4); // quita "USDT" del final
      if (!base || vistos.has(base)) continue;
      vistos.add(base);

      monedas.push({ symbol: base, volumen: Number(t.quoteVolume) || 0 });
    }

    monedas.sort((a, b) => b.volumen - a.volumen);

    return NextResponse.json({ coins: monedas.slice(0, 250).map((m) => m.symbol) });
  } catch (err) {
    console.error("Error obteniendo lista de monedas:", err);
    return NextResponse.json({ error: "No se pudo obtener la lista de activos" }, { status: 500 });
  }
}
