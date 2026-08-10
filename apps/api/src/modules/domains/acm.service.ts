import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

/**
 * TLS certificate provisioning for a verified custom domain. Same
 * `isStubMode` shape as `StripeService`
 * (apps/api/src/modules/payments/stripe.service.ts): active whenever
 * `AWS_ACCESS_KEY_ID` is unset (true for this repo/environment — no AWS
 * credentials available), every method that would make a real call to
 * `acm.amazonaws.com`/`route53.amazonaws.com` returns a deterministic,
 * correctly-shaped stand-in instead. Swapping in real credentials plus a
 * real `@aws-sdk/client-acm` call (`RequestCertificateCommand` +
 * `DescribeCertificateCommand` polling for `ISSUED`) is an env-var-and-one-
 * method change only, not a redesign — this class is the documented swap-in
 * point (`files/07-folder-module-architecture.md`'s planned
 * `domains/acm.service.ts`).
 *
 * Deliberately narrow scope for this round: this class only proves out the
 * stub-mode *shape* (a real cert reference is never actually needed by
 * anything downstream this round — no reverse proxy/CDN wiring reads it
 * back). Storing/rotating the resulting certificate reference and wiring it
 * into a real TLS-terminating edge are out of scope, disclosed in the Phase
 * 6 plan alongside the Next.js Host-header routing gap.
 */
@Injectable()
export class AcmService {
  private readonly logger = new Logger(AcmService.name);
  readonly isStubMode: boolean;

  constructor() {
    this.isStubMode = !process.env.AWS_ACCESS_KEY_ID;
    if (this.isStubMode) {
      this.logger.warn(
        'AWS_ACCESS_KEY_ID not set — AcmService running in stub mode (no real network calls to AWS ACM).',
      );
    }
  }

  /**
   * Returns a certificate ARN once "issued." Stub mode never actually
   * waits/polls — it's synchronously "issued" immediately, so `domain`
   * itself is unused on that path (only the real-mode path below, which
   * never executes in this environment, would read it — kept in the
   * signature to document the real call shape).
   */
  async provisionCertificate(
    _domain: string,
  ): Promise<{ certificateArn: string; status: 'issued' }> {
    if (this.isStubMode) {
      return {
        certificateArn: `arn:aws:acm:stub:000000000000:certificate/${randomUUID()}`,
        status: 'issued',
      };
    }
    // Real path (not exercised in this environment): request a DNS-validated
    // ACM certificate for `domain`, then poll DescribeCertificate until
    // Status === 'ISSUED'. Left undocumented beyond this comment — no AWS
    // SDK dependency is added to package.json for a path that can't be
    // exercised or tested here (mirrors StripeService never adding
    // Stripe-CLI-only tooling for the same reason).
    throw new Error(
      'AcmService real-mode certificate provisioning is not implemented — no AWS credentials available in this environment.',
    );
  }
}
