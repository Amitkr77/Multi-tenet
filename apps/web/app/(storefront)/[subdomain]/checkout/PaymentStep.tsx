"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function PaymentForm({ returnUrl }: { returnUrl: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    if (result.error) {
      setError(result.error.message ?? "Payment could not be completed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={!stripe || submitting} className="w-full rounded-full bg-brand-600 py-3 text-sm font-medium text-white disabled:opacity-60">
        {submitting ? "Confirming payment…" : "Pay now"}
      </button>
    </form>
  );
}

export function PaymentStep({ clientSecret, returnUrl }: { clientSecret: string; returnUrl: string }) {
  if (!stripePromise) {
    return <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">Payments are unavailable because NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured.</p>;
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm returnUrl={returnUrl} />
    </Elements>
  );
}
