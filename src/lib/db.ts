import { neon } from "@neondatabase/serverless";

// Esta función crea la conexión a tu base de datos de Neon.tech
// usando la variable de entorno DATABASE_URL (definida en .env.local)
export const sql = neon(process.env.DATABASE_URL!);
