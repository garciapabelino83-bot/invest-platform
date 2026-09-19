import { NextResponse } from "next/server";
import { sql, ensureSubscribersTable } from "@/lib/db";

// Le dice al frontend si un correo tiene el Plan Pro activo
// (incluye el periodo de prueba gratis).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

if (!email) {
  return NextResponse.json({ isPro: false });
}

await ensureSubscribersTable();

const rows = await sql`
SELECT status FROM subscribers WHERE email = ${email}
`;

const status = rows[0]?.status as string | undefined;
  const isPro = status === "active" || status === "trialing";

return NextResponse.json({ isPro, status: status || null });
}
