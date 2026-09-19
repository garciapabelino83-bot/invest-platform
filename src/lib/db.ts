import { neon } from "@neondatabase/serverless";

// Esta función crea la conexión a tu base de datos de Neon.tech
// usando la variable de entorno DATABASE_URL (definida en .env.local)
export const sql = neon(process.env.DATABASE_URL!);

// Crea la tabla de suscriptores del Plan Pro si todavía no existe.
// Es seguro llamar esta función varias veces (no borra nada si ya existe).
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

// Guarda los avisos de precio (soporte/resistencia) que marcan los usuarios
// del Plan Pro, junto con los datos para poder mandarles una notificación
// push cuando el precio llegue a esa línea.
export async function ensurePriceAlertsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS price_alerts (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      coin TEXT NOT NULL,
      price NUMERIC NOT NULL,
      subscription JSONB NOT NULL,
      triggered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

// Guarda el último precio conocido de cada activo, para poder detectar
// cuándo el precio "cruza" una línea marcada (y no solo si está cerca).
export async function ensureCoinPriceStateTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS coin_price_state (
      coin TEXT PRIMARY KEY,
      last_price NUMERIC NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}
