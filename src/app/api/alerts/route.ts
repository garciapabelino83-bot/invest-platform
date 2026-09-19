import { NextResponse } from "next/server";
import { sql, ensurePriceAlertsTable, ensureSubscribersTable } from "@/lib/db";

// Lista los avisos de precio guardados de un usuario (para mostrar sus
// líneas de nuevo si vuelve a entrar a la página).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ alerts: [] });
  }

  await ensurePriceAlertsTable();

  const rows = await sql`
    SELECT id, coin, price, triggered_at, created_at
    FROM price_alerts
    WHERE email = ${email}
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ alerts: rows });
}

// Crea un nuevo aviso de precio. Solo disponible para suscriptores del
// Plan Pro (activos o en periodo de prueba).
export async function POST(request: Request) {
  try {
    const { email, coin, price, subscription } = await request.json();

    if (!email || !coin || typeof price !== "number" || !subscription) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    await ensureSubscribersTable();
    await ensurePriceAlertsTable();

    const subRows = await sql`
      SELECT status FROM subscribers WHERE email = ${email}
    `;
    const status = subRows[0]?.status;
    const isPro = status === "trialing" || status === "active";

    if (!isPro) {
      return NextResponse.json(
        { error: "Los avisos de precio son parte del Plan Pro" },
        { status: 403 }
      );
    }

    const rows = await sql`
      INSERT INTO price_alerts (email, coin, price, subscription)
      VALUES (${email}, ${coin}, ${price}, ${JSON.stringify(subscription)})
      RETURNING id, coin, price, created_at
    `;

    return NextResponse.json({ alert: rows[0] });
  } catch (err) {
    console.error("Error creando aviso de precio:", err);
    return NextResponse.json({ error: "No se pudo crear el aviso" }, { status: 500 });
  }
}

// Borra un aviso (por ejemplo, si el usuario borra la línea en el gráfico).
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }

  await ensurePriceAlertsTable();
  await sql`DELETE FROM price_alerts WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
