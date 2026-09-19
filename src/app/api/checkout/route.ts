import { NextResponse } from "next/server";
import { getStripe, PRO_PLAN_PRICE_ID } from "@/lib/stripe";

// Crea una sesión de pago de Stripe para suscribirse al Plan Pro.
// El frontend llama esta ruta con el correo del usuario y lo redirige
// a la página de pago segura de Stripe.
export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Correo inválido" },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") || "";
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: PRO_PLAN_PRICE_ID, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
      },
      allow_promotion_codes: true,
      // Managed Payments (nuevo en Stripe) exige un código de impuesto en el
      // producto. Como esto no es una tienda física con impuestos, lo
      // desactivamos para esta sesión de pago.
      managed_payments: { enabled: false },
      success_url: `${origin}/?checkout=exito&email=${encodeURIComponent(email)}`,
      cancel_url: `${origin}/?checkout=cancelado`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Error creando la sesión de pago:", err);
    return NextResponse.json(
      { error: "No se pudo iniciar el pago" },
      { status: 500 }
    );
  }
}
