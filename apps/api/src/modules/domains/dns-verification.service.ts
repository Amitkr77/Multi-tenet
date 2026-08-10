import { Injectable, Logger } from '@nestjs/common';
import { resolveTxt } from 'node:dns/promises';

/**
 * Real, unstubbed — a DNS TXT lookup is a plain, free, public network
 * operation (no cloud account/credentials needed, unlike AcmService's TLS
 * provisioning below), so unlike StripeService/AcmService there is no
 * `isStubMode` here at all. Ownership is proven the same way every major
 * custom-domain product (Vercel, Netlify, Cloudflare) does it: ask the
 * domain owner to publish a TXT record only they could publish, at a
 * well-known subdomain of the domain being verified.
 */
@Injectable()
export class DnsVerificationService {
  private readonly logger = new Logger(DnsVerificationService.name);

  /** The record name a tenant is instructed to create: `_saas-verify.<domain>`. */
  recordNameFor(domain: string): string {
    return `_saas-verify.${domain}`;
  }

  /**
   * Resolves the TXT records at `_saas-verify.<domain>` and checks whether
   * any of them equals `expectedToken`. `resolveTxt` returns
   * `string[][]` (each TXT record can itself be split into multiple
   * quoted-string segments, which Node already joins per-record) — a
   * record matches if its full value equals the token exactly.
   *
   * Returns `false` (never throws) on any DNS failure (NXDOMAIN, no TXT
   * records, timeout, etc.) — "verification hasn't succeeded yet" is a
   * completely ordinary, expected outcome for a domain the tenant hasn't
   * finished configuring, not an application error.
   */
  async verify(domain: string, expectedToken: string): Promise<boolean> {
    try {
      const records = await resolveTxt(this.recordNameFor(domain));
      return records.some((segments) => segments.join('') === expectedToken);
    } catch (err) {
      this.logger.debug(
        `DNS TXT lookup for ${this.recordNameFor(domain)} did not resolve (expected while unverified): ${(err as Error).message}`,
      );
      return false;
    }
  }
}
