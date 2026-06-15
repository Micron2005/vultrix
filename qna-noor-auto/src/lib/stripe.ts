import Stripe from "stripe";

// Lazily-constructed Stripe client. Billing is optional: if STRIPE_SECRET_KEY
// isn't set the app still runs (manual businesses created from /admin work
// fine), and billing surfaces degrade gracefully. Call getStripe() only after
// checking billingConfigured().

let client: Stripe | null = null;

export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set — billing is not configured.");
  }
  if (!client) {
    client = new Stripe(key);
  }
  return client;
}
