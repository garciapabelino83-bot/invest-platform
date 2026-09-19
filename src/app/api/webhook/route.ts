import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { sql, ensureSubscribersTable } from "@/lib/db";

// Stripe nos avisa aqui cada vez que pasa algo con un pago o una
// suscripcion (se pago, se renovo, se cancelo, etc). Esta ruta valida
// que el aviso realmente venga de Stripe y actualiza nuestra base de datos.
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!signature || !webhookSecret) {
  return NextResponse.json(
    { error: "Falta configuracion del webhook" },
    { status: 400 }
    );
}

const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Firma de webhook invalida:", err);
    return NextResponse.json({ error: "Firma invalida" }, { status: 400 });
  }

await ensureSubscribersTable();

try {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email || session.customer_email;
      if (email && session.subscription && session.customer) {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
          );
        await sql`
        INSERT INTO subscribers (email, stripe_customer_id, stripe_subscription_id, status, current_period_end, updated_at)
        VALUES (${email}, ${session.customer as string}, ${subscription.id}, ${subscription.status}, to_timestamp(${subscription.items.data[0].current_period_end}), now())
        ON CONFLICT (email) DO UPDATE SET
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = now()
        `;
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customer = await stripe.customers.retrieve(
        subscription.customer as string
        );
      const email = !customer.deleted ? customer.email : null;
      if (email) {
        await sql`
        UPDATE subscribers
        SET status = ${subscription.status},
        current_period_end = to_timestamp(${subscription.items.data[0].current_period_end}),
        updated_at = now()
        WHERE email = ${email}
        `;
      }
      break;
    }

    default:
      break;
  }
} catch (err) {
  console.error("Error procesando el webhook:", err);
  return NextResponse.json(
    { error: "Error interno procesando el evento" },
    { status: 500 }
    );
}

return NextResponse.json({ received: true });
}
