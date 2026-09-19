import { neon } from "@neondatabase/serverless";

// Esta funcion crea la conexion a tu base de datos de Neon.tech
// usando la variable de entorno DATABASE_URL (definida en .env.local)
export const sql = neon(process.env.DATABASE_URL!);

// Crea la tabla de suscriptores del Plan Pro si todavia no existe.
// Es seguro llamar esta funcion varias veces (no borra nada si ya existe).
export async function ensureSubscribersTable() {
  await sql`
  CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'incomplete',
  current_period_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `;
}
