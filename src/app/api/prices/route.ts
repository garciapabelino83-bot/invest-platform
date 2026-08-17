import { NextResponse } from "next/server";

// Esta ruta trae precios reales y gratuitos de CoinGecko (sin necesitar API key)
export async function GET() {
  const coins = "bitcoin,ethereum,solana";

  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=usd&include_24hr_change=true`,
    { next: { revalidate: 60 } } // guarda el resultado 60 segundos para no saturar la API gratuita
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "No se pudieron obtener los precios" },
      { status: 500 }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
