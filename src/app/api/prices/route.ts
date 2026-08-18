import { NextResponse } from "next/server";

// Esta ruta trae precios reales y gratuitos de CoinGecko (sin necesitar API key)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coinsParam =
    searchParams.get("coins") ||
    "bitcoin,ethereum,solana,cardano,ripple,dogecoin,polkadot,avalanche-2,chainlink,litecoin";

  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinsParam}&vs_currencies=usd&include_24hr_change=true`,
    { next: { revalidate: 60 } }
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
