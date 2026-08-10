import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type {
  CustomerRegisterDto,
  CustomerLoginDto,
  CustomerSelfUpdateDto,
} from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerSessionsService } from './customer-sessions.service';
import type { JwtCustomerPayload } from './customer-jwt-payload.interface';
import { omitPasswordHash } from './strip-password-hash';

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface CustomerTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Unlike AuthService, this never needs the `runScoped`/bootstrap-exception
 * pattern — a customer only ever registers into a tenant that already
 * exists (the storefront they're browsing), so by the time any of these
 * methods run, TenantResolverGuard + TenantContextInterceptor have already
 * populated CLS with a real tenantId and `this.prisma.client` is correctly
 * scoped. Controllers are responsible for rejecting a null tenantId before
 * calling in here (see storefront-products.controller.ts's identical
 * `requireTenant` pattern) — these methods assume it's already a real id.
 */
@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sessions: CustomerSessionsService,
  ) {}

  async register(
    tenantId: string,
    dto: CustomerRegisterDto,
    meta: RequestMeta,
  ): Promise<{ tokens: CustomerTokens }> {
    const existing = await this.prisma.client.customer.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (existing)
      throw new BadRequestException({
        code: 'CONFLICT',
        message: 'An account with this email already exists.',
      });

    const passwordHash = await argon2.hash(dto.password);
    const customer = await this.prisma.client.customer.create({
      data: {
        tenantId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      },
    });

    const tokens = await this.issueTokenPair(
      customer.id,
      tenantId,
      customer.email,
      meta,
    );
    return { tokens };
  }

  async login(
    tenantId: string,
    dto: CustomerLoginDto,
    meta: RequestMeta,
  ): Promise<{ tokens: CustomerTokens }> {
    const customer = await this.prisma.client.customer.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (
      !customer ||
      !customer.passwordHash ||
      !(await argon2.verify(customer.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password.',
      });
    }
    if (!customer.isActive) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'This account has been deactivated.',
      });
    }

    const tokens = await this.issueTokenPair(
      customer.id,
      tenantId,
      customer.email,
      meta,
    );
    return { tokens };
  }

  async refresh(
    refreshToken: string,
    meta: RequestMeta,
  ): Promise<CustomerTokens> {
    const { customerId, tenantId, newRefreshToken } =
      await this.sessions.rotate(refreshToken, meta.userAgent, meta.ipAddress);
    const customer = await this.prisma.runScoped(tenantId, (tx) =>
      tx.customer.findUniqueOrThrow({ where: { id: customerId } }),
    );
    const accessToken = this.signAccessToken(
      customer.id,
      tenantId,
      customer.email,
    );
    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.accessTtlSeconds(),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.sessions.revokeByToken(refreshToken);
  }

  async me(tenantId: string, customerId: string): Promise<any> {
    const customer = await this.prisma.client.customer.findUniqueOrThrow({
      where: { id: customerId },
      include: { addresses: true },
    });
    return omitPasswordHash(customer);
  }

  async updateMe(
    tenantId: string,
    customerId: string,
    dto: CustomerSelfUpdateDto,
  ): Promise<any> {
    const customer = await this.prisma.client.customer.update({
      where: { id: customerId },
      data: dto,
    });
    return omitPasswordHash(customer);
  }

  private async issueTokenPair(
    customerId: string,
    tenantId: string,
    email: string,
    meta: RequestMeta,
  ): Promise<CustomerTokens> {
    const accessToken = this.signAccessToken(customerId, tenantId, email);
    const refreshToken = await this.sessions.create(
      customerId,
      tenantId,
      meta.userAgent,
      meta.ipAddress,
    );
    return { accessToken, refreshToken, expiresIn: this.accessTtlSeconds() };
  }

  private signAccessToken(
    customerId: string,
    tenantId: string,
    email: string,
  ): string {
    const payload: JwtCustomerPayload = {
      sub: customerId,
      tenantId,
      email,
      type: 'customer',
    };
    return this.jwt.sign(payload, {
      secret:
        process.env.CUSTOMER_JWT_SECRET ?? 'dev-customer-secret-change-me',
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });
  }

  private accessTtlSeconds(): number {
    const ttl = process.env.JWT_ACCESS_TTL ?? '15m';
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const [, amount, unit] = match;
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 60;
    return Number(amount) * multiplier;
  }
}
