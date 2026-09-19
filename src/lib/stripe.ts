import Stripe from "stripe";

// Cliente de Stripe para el servidor. Usa la clave secreta desde las
// variables de entorno de Vercel (nunca la escribas directo en el codigo).
// Se crea solo cuando realmente se usa, para que la app no truene al
// compilar si todavia no has configurado la clave en Vercel.
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error(
        "Falta configurar STRIPE_SECRET_KEY en las variables de entorno."
        );
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

// ID del precio del Plan Pro (creado en el Dashboard de Stripe).
// No es un dato secreto, por eso puede vivir como variable publica.
export const PRO_PLAN_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || "";
