import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async getAccount(tenantId: string): Promise<any> {
    const account = await this.prisma.client.paymentAccount.findUnique({
      where: { tenantId },
    });
    if (!account)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'No payment account found for this tenant.',
      });
    return account;
  }

  /**
   * Creates the Stripe Connect Express account on first call (idempotent —
   * reuses the existing stripeAccountId on subsequent calls), then always
   * issues a fresh onboarding link (Stripe account links expire quickly).
   */
  async startOnboarding(tenantId: string): Promise<{ url: string }> {
    let account = await this.getAccount(tenantId);

    if (!account.stripeAccountId) {
      const stripeAccount =
        await this.stripeService.createConnectAccount(tenantId);
      account = await this.prisma.client.paymentAccount.update({
        where: { tenantId },
        data: {
          stripeAccountId: stripeAccount.id,
          onboardingStatus: 'pending',
        },
      });
    }

    const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:3000';
    const link = await this.stripeService.createAccountOnboardingLink(
      account.stripeAccountId,
      `${webAppUrl}/dashboard/settings/payments`,
      `${webAppUrl}/dashboard/settings/payments`,
    );
    return { url: link.url };
  }

  listPayouts(tenantId: string): Promise<any> {
    return this.prisma.client.paymentTransaction.findMany({
      where: { tenantId },
      include: { order: { select: { id: true, grandTotal: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
