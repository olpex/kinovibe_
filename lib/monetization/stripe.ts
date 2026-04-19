import "server-only";
import Stripe from "stripe";

let cachedStripeClient: Stripe | null | undefined;

export function getStripeServerClient(): Stripe | null {
  if (cachedStripeClient !== undefined) {
    return cachedStripeClient;
  }

  const secretKey = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!secretKey) {
    cachedStripeClient = null;
    return null;
  }

  cachedStripeClient = new Stripe(secretKey);
  return cachedStripeClient;
}

export function getStripeWebhookSecret(): string | null {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  return secret || null;
}
