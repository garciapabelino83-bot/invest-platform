import { NextResponse } from "next/server";

// Tipos de cambio de monedas fiat (dólar, euro, pesos latinoamericanos...)
// para el convertidor de monedas. Usamos una API gratuita que no necesita
// llave (open.er-api.com), con el dólar como base, y la cacheamos una hora
// porque el tipo de cambio entre monedas fiat no cambia tan seguido.
export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error("No se pudo obtener el tipo de cambio");
    }

    const data = await res.json();
    if (!data.rates) {
      throw new Error("Respuesta inválida del servicio de tipo de cambio");
    }

    return NextResponse.json({ base: "USD", rates: data.rates });
  } catch (err) {
    console.error("Error obteniendo tipos de cambio:", err);
    return NextResponse.json(
      { error: "No se pudo obtener el tipo de cambio en este momento" },
      { status: 500 }
    );
  }
}
