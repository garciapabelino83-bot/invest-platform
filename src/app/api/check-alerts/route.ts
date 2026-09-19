import { NextResponse } from "next/server";
import { sql, ensurePriceAlertsTable, ensureCoinPriceStateTable } from "@/lib/db";
import { getWebPush } from "@/lib/push";

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

// Este endpoint lo llama un robot externo (GitHub Actions) cada varios
// minutos. Revisa si el precio de algún activo "cruzó" una línea de
// soporte/resistencia marcada por un usuario del Plan Pro, y si es así le
// manda una notificación push.
async function checkAlerts() {
  await ensurePriceAlertsTable();
  await ensureCoinPriceStateTable();

  const pending = await sql`
    SELECT DISTINCT coin FROM price_alerts WHERE triggered_at IS NULL
  `;
  const coins: string[] = pending.map((r: Record<string, unknown>) => r.coin as string);

  if (coins.length === 0) {
    return { checked: 0, notified: 0 };
  }

  const geckoIds = coins.map((c) => COINGECKO_IDS[c] || c).join(",");
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds}&vs_currencies=usd`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("No se pudieron obtener los precios actuales");
  }

  const prices: Record<string, { usd: number }> = await res.json();
  const webpush = getWebPush();

  let notified = 0;

  for (const coin of coins) {
    const geckoId = COINGECKO_IDS[coin] || coin;
    const current = prices[geckoId]?.usd;
    if (typeof current !== "number") continue;

    const stateRows = await sql`
      SELECT last_price FROM coin_price_state WHERE coin = ${coin}
    `;
    const previous: number | null =
      stateRows[0]?.last_price !== undefined ? Number(stateRows[0].last_price) : null;

    await sql`
      INSERT INTO coin_price_state (coin, last_price, updated_at)
      VALUES (${coin}, ${current}, now())
      ON CONFLICT (coin) DO UPDATE SET last_price = ${current}, updated_at = now()
    `;

    // La primera vez que vemos un activo solo guardamos su precio base,
    // para poder detectar un cruce real la próxima vez.
    if (previous === null) continue;

    const alerts = await sql`
      SELECT id, price, subscription FROM price_alerts
      WHERE coin = ${coin} AND triggered_at IS NULL
    `;

    for (const alert of alerts) {
      const target = Number(alert.price);
      const crossed =
        (previous <= target && current >= target) ||
        (previous >= target && current <= target);

      if (!crossed) continue;

      try {
        await webpush.sendNotification(
          alert.subscription,
          JSON.stringify({
            title: "InvestPanel — aviso de precio",
            body: `${coin.toUpperCase()} llegó a $${target.toLocaleString(
              "es"
            )} (precio actual: $${current.toLocaleString("es")})`,
          })
        );
        notified++;
      } catch (err) {
        console.error("Error enviando notificación push:", err);
      }

      await sql`UPDATE price_alerts SET triggered_at = now() WHERE id = ${alert.id}`;
    }
  }

  return { checked: coins.length, notified };
}

export async function POST() {
  try {
    const result = await checkAlerts();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Error revisando avisos de precio:", err);
    return NextResponse.json({ error: "No se pudieron revisar los avisos" }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
