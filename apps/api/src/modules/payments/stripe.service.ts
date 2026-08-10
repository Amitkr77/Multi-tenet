import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';

/**
 * The ONE place in this codebase that touches the `stripe` SDK. Built
 * against Stripe's real types throughout (Stripe.Account, Stripe.PaymentIntent,
 * Stripe.Refund, Stripe.Event) — no home-grown DTOs standing in for them —
 * so every caller elsewhere in the app already speaks the real shapes and
 * needs zero changes once real credentials exist.
 *
 * STUB MODE: active whenever STRIPE_SECRET_KEY is unset (true for this repo
 * today — no test-mode credentials available). Every method that would make
 * a real network call to api.stripe.com is guarded and returns a
 * deterministic, correctly-shaped stand-in instead. `constructWebhookEvent`
 * and `generateTestWebhookHeader` are NEVER stubbed — signature
 * verification/generation is a local HMAC operation (no network involved
 * either way), so the idempotency/signature logic gets genuine coverage
 * even in stub mode.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  readonly isStubMode: boolean;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    this.isStubMode = !secretKey;
    if (this.isStubMode) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — StripeService running in stub mode (no real network calls to Stripe).',
      );
    }
    // A real Stripe instance is still constructed even in stub mode (using a
    // placeholder key) so `this.stripe.webhooks` — genuinely local, never
    // stubbed — is always available.
    this.stripe = new Stripe(secretKey ?? 'sk_test_stub_mode_placeholder');
  }

  async createConnectAccount(tenantId: string): Promise<Stripe.Account> {
    if (this.isStubMode) {
      return this.stubAccount(tenantId);
    }
    return this.stripe.accounts.create({
      type: 'express',
      metadata: { tenantId },
    });
  }

  async createAccountOnboardingLink(
    stripeAccountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<Stripe.AccountLink> {
    if (this.isStubMode) {
      return {
        object: 'account_link',
        created: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 300,
        url: `https://connect.stripe.com/stub-onboarding/${stripeAccountId}`,
      } as Stripe.AccountLink;
    }
    return this.stripe.accountLinks.create({
      account: stripeAccountId,
      type: 'account_onboarding',
      refresh_url: refreshUrl,
      return_url: returnUrl,
    });
  }

  async createPaymentIntent(params: {
    amount: number; // smallest currency unit (cents)
    currency: string;
    connectedAccountId: string;
    applicationFeeAmount: number;
    metadata: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    if (this.isStubMode) {
      return this.stubPaymentIntent(params.amount, params.currency);
    }
    return this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      application_fee_amount: params.applicationFeeAmount,
      transfer_data: { destination: params.connectedAccountId },
      metadata: params.metadata,
    });
  }

  async createRefund(params: {
    paymentIntentId: string;
    amount: number; // smallest currency unit (cents)
    metadata: Record<string, string>;
  }): Promise<Stripe.Refund> {
    if (this.isStubMode) {
      return {
        id: `re_stub_${randomUUID()}`,
        object: 'refund',
        amount: params.amount,
        payment_intent: params.paymentIntentId,
        status: 'pending',
        metadata: params.metadata,
        created: Math.floor(Date.now() / 1000),
      } as unknown as Stripe.Refund;
    }
    return this.stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      amount: params.amount,
      metadata: params.metadata,
    });
  }

  // --- Phase 5 — platform Stripe Billing (subscription charges to tenants) ---

  async createCustomer(
    tenantId: string,
    email: string,
    name: string,
  ): Promise<Stripe.Customer> {
    if (this.isStubMode) {
      return {
        id: `cus_stub_${randomUUID()}`,
        object: 'customer',
        email,
        name,
        metadata: { tenantId },
        created: Math.floor(Date.now() / 1000),
      } as unknown as Stripe.Customer;
    }
    return this.stripe.customers.create({
      email,
      name,
      metadata: { tenantId },
    });
  }

  /**
   * Covers both signup (no `existingSubscriptionId`, plain create) and
   * upgrade/downgrade (an existing subscription's price is swapped in
   * place, not canceled+recreated — preserves billing-cycle continuity).
   */
  async upsertSubscription(params: {
    customerId: string;
    priceId: string;
    tenantId: string;
    existingSubscriptionId?: string | null;
  }): Promise<Stripe.Subscription> {
    if (this.isStubMode) {
      return this.stubSubscription(params);
    }
    if (params.existingSubscriptionId) {
      const sub = await this.stripe.subscriptions.retrieve(
        params.existingSubscriptionId,
      );
      return this.stripe.subscriptions.update(params.existingSubscriptionId, {
        items: [{ id: sub.items.data[0].id, price: params.priceId }],
        metadata: { tenantId: params.tenantId },
      });
    }
    return this.stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      metadata: { tenantId: params.tenantId },
    });
  }

  async cancelSubscription(
    stripeSubscriptionId: string,
  ): Promise<Stripe.Subscription> {
    if (this.isStubMode) {
      return {
        id: stripeSubscriptionId,
        object: 'subscription',
        status: 'canceled',
      } as unknown as Stripe.Subscription;
    }
    return this.stripe.subscriptions.cancel(stripeSubscriptionId);
  }

  /** Real in every mode — a local HMAC verification, not a network call. Throws on an invalid/missing signature. */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  /**
   * Test-only helper (used by e2e tests / manual verification, never by
   * production code paths) — generates a genuinely valid `Stripe-Signature`
   * header for a synthetic event payload, using the SDK's own local signing
   * logic. This is how Phase 3's "purchase/refund completes" verification
   * exercises the real idempotent webhook path without live Stripe
   * credentials: POST a synthetic, correctly-signed event at the webhook
   * endpoint, exactly like Stripe itself would.
   */
  generateTestWebhookHeader(payload: string, secret: string): string {
    return this.stripe.webhooks.generateTestHeaderString({ payload, secret });
  }

  private stubAccount(tenantId: string): Stripe.Account {
    // `as unknown as` — a stub deliberately doesn't populate every field of
    // the real Stripe.Account shape (only what this codebase's callers
    // actually read: id/metadata/*_enabled), so a direct `as` cast correctly
    // fails TS's excess-property/missing-property overlap check.
    return {
      id: `acct_stub_${randomUUID()}`,
      object: 'account',
      type: 'express',
      metadata: { tenantId },
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    } as unknown as Stripe.Account;
  }

  private stubSubscription(params: {
    customerId: string;
    tenantId: string;
    existingSubscriptionId?: string | null;
  }): Stripe.Subscription {
    const id = params.existingSubscriptionId ?? `sub_stub_${randomUUID()}`;
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
    return {
      id,
      object: 'subscription',
      customer: params.customerId,
      status: 'active',
      metadata: { tenantId: params.tenantId },
      current_period_end: periodEnd,
      items: { data: [{ id: `si_stub_${randomUUID()}` }] },
    } as unknown as Stripe.Subscription;
  }

  private stubPaymentIntent(
    amount: number,
    currency: string,
  ): Stripe.PaymentIntent {
    const id = `pi_stub_${randomUUID()}`;
    return {
      id,
      object: 'payment_intent',
      amount,
      currency,
      status: 'requires_payment_method',
      client_secret: `${id}_secret_stub`,
      created: Math.floor(Date.now() / 1000),
    } as Stripe.PaymentIntent;
  }
}
