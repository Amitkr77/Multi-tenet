import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import {
  QUEUE_NAMES,
  EMAIL_JOB_NAMES,
  type RegisterDto,
  type LoginDto,
  type VerifyEmailDto,
  type ForgotPasswordDto,
  type ResetPasswordDto,
  type SwitchTenantDto,
  type AuthTokens,
  type MeResponse,
  type CompleteTwoFactorLoginDto,
} from '@saas/shared-types';
import { TotpService } from './totp.service';
import {
  ensurePermissionCatalogue,
  ensureDefaultRolesForTenant,
  ensureDefaultWarehouseForTenant,
  ensureDefaultPaymentAccountForTenant,
  ensureDefaultSubscriptionForTenant,
} from '@saas/database';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveGrantedPermissions } from '../../common/permissions/granted-permissions';
import { SessionsService } from './sessions.service';
import type { JwtAccessPayload } from './jwt-payload.interface';

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionsService,
    private readonly totp: TotpService,
    @InjectQueue(QUEUE_NAMES.email) private readonly emailQueue: Queue,
  ) {}

  /**
   * Bootstrap exception (arch.md §4 / this project's registration exception):
   * the tenant doesn't exist yet, so there's nothing to SET LOCAL to before
   * creating it. One transaction: create Tenant (unscoped — `tenants` has no
   * RLS policy) → SET LOCAL to the new tenant's own id → insert the owner
   * User + default roles within that SAME transaction, satisfying RLS's
   * WITH-CHECK on the inserts. This is the one hand-rolled exception to the
   * generic tenant-extension pattern — see tenant-extension.ts.
   *
   * Auto-issues tokens on success (product decision: onboarding continues
   * immediately after registration rather than blocking on email
   * verification — FR-T-07's "resumable onboarding" implies the user is
   * already past the login step). The verification email is enqueued in
   * parallel; `emailVerifiedAt` merely gets tracked, not gated on here.
   */
  async register(
    dto: RegisterDto,
    meta: RequestMeta,
  ): Promise<{ tokens: AuthTokens; tenantId: string }> {
    const passwordHash = await argon2.hash(dto.password);

    const result = await this.prisma.runScoped(null, async (tx) => {
      const existingSubdomain = await tx.tenant.findUnique({
        where: { subdomain: dto.subdomain },
      });
      if (existingSubdomain) {
        throw new BadRequestException({
          code: 'CONFLICT',
          message: 'Subdomain is already taken.',
        });
      }

      // `where: { isDefault: true }` — NOT `orderBy: { createdAt: 'asc' }` as
      // this used to read. That ordering only ever meant "the free plan"
      // because no other Plan had ever been created earlier; Phase 5's Super
      // Admin plan CRUD makes that assumption unsafe (a newly created plan
      // could sort earlier and silently become "the default"). `isDefault`
      // is an explicit, Super-Admin-set flag instead.
      const freePlan = await tx.plan.findFirst({
        where: { isDefault: true },
      });
      const tenant = await tx.tenant.create({
        data: {
          name: dto.businessName,
          subdomain: dto.subdomain,
          status: 'trial',
          currentPlanId: freePlan?.id,
        },
      });

      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);

      await ensurePermissionCatalogue(tx as any);
      const roles = await ensureDefaultRolesForTenant(tx as any, tenant.id);
      await ensureDefaultWarehouseForTenant(tx as any, tenant.id);
      await ensureDefaultPaymentAccountForTenant(tx as any, tenant.id);
      if (freePlan) {
        await ensureDefaultSubscriptionForTenant(
          tx as any,
          tenant.id,
          freePlan.id,
        );
      }

      const existingUser = await tx.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
      });
      if (existingUser) {
        throw new BadRequestException({
          code: 'CONFLICT',
          message: 'Email already registered for this tenant.',
        });
      }

      const owner = await tx.user.create({
        data: { tenantId: tenant.id, email: dto.email, passwordHash },
      });
      await tx.userRole.create({
        data: { userId: owner.id, roleId: roles.owner, tenantId: tenant.id },
      });

      return { tenant, owner };
    });

    await this.enqueueVerificationEmail(
      result.owner.id,
      result.tenant.id,
      result.owner.email,
    );

    const tokens = await this.issueTokenPair(
      {
        userId: result.owner.id,
        tenantId: result.tenant.id,
        email: result.owner.email,
      },
      meta,
    );
    return { tokens, tenantId: result.tenant.id };
  }

  /**
   * `effectiveTenantId` resolution order: explicit `dto.subdomain` (a person
   * disambiguating which of their tenant memberships to log into — FR-A-06 —
   * or, in Phase 1's dashboard with no subdomain routing yet, simply how the
   * login form identifies the tenant at all) resolved to a tenant id wins,
   * else whatever TenantResolverGuard resolved from the Host header
   * (`requestTenantId` — the production shape, once the dashboard is reached
   * at the tenant's own subdomain), else null (platform Super Admin login).
   * Deliberately NOT read from CLS/PrismaService.client here — CLS was
   * populated from `requestTenantId` by the interceptor before this ever
   * runs, which would be wrong the moment `dto.subdomain` overrides it.
   * `runScoped` sets its own SET LOCAL for exactly this reason, matching
   * `register`'s pattern.
   */
  async login(
    dto: LoginDto,
    requestTenantId: string | null,
    meta: RequestMeta,
  ): Promise<
    | ({ tokens: AuthTokens } & MeResponse)
    | { requiresTwoFactor: true; challengeToken: string }
  > {
    let effectiveTenantId = requestTenantId ?? null;
    if (dto.subdomain) {
      const tenant = await this.prisma.base.tenant.findUnique({
        where: { subdomain: dto.subdomain },
      });
      if (!tenant) {
        throw new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password.',
        });
      }
      effectiveTenantId = tenant.id;
    }

    const user = await this.prisma.runScoped(effectiveTenantId, (tx) =>
      tx.user.findFirst({
        where: { tenantId: effectiveTenantId, email: dto.email },
      }),
    );

    if (
      !user ||
      !user.passwordHash ||
      !(await argon2.verify(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password.',
      });
    }
    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'This account has been deactivated.',
      });
    }

    // If 2FA is enabled, return a short-lived challenge token instead of a
    // full session. The client must then POST /auth/2fa/login with the TOTP
    // code to complete authentication.
    if (user.twoFactorEnabled) {
      const challengeToken = this.jwt.sign(
        { sub: user.id, tid: effectiveTenantId, typ: 'mfa-challenge' },
        { expiresIn: '5m' },
      );
      return { requiresTwoFactor: true, challengeToken };
    }

    const tokens = await this.issueTokenPair(
      { userId: user.id, tenantId: effectiveTenantId, email: user.email },
      meta,
    );
    const me = await this.buildMeResponse(user.id, effectiveTenantId);
    return { tokens, ...me };
  }

  /**
   * Complete a 2FA login: verify the TOTP code against the challenge token
   * issued by `login()` when the user has 2FA enabled.
   */
  async completeTwoFactorLogin(
    dto: CompleteTwoFactorLoginDto,
    meta: RequestMeta,
  ): Promise<{ tokens: AuthTokens } & MeResponse> {
    let payload: { sub: string; tid: string | null; typ: string };
    try {
      payload = this.jwt.verify(dto.challengeToken);
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired challenge token.',
      });
    }
    if (payload.typ !== 'mfa-challenge') {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid challenge token type.',
      });
    }

    const user = await this.prisma.runScoped(payload.tid, (tx) =>
      tx.user.findUnique({ where: { id: payload.sub } }),
    );
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '2FA is not enabled on this account.',
      });
    }

    if (!this.totp.verify(user.twoFactorSecret, dto.code)) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid authenticator code.',
      });
    }

    const tokens = await this.issueTokenPair(
      { userId: user.id, tenantId: payload.tid, email: user.email },
      meta,
    );
    const me = await this.buildMeResponse(user.id, payload.tid);
    return { tokens, ...me };
  }

  /** Step 1 of 2FA setup: generate a secret and return it + the QR URI. */
  async setupTwoFactor(
    userId: string,
    tenantId: string | null,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.prisma.runScoped(tenantId, (tx) =>
      tx.user.findUnique({ where: { id: userId } }),
    );
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'User not found.' });
    if (user.twoFactorEnabled) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '2FA is already enabled on this account.',
      });
    }

    const { base32, otpauthUrl, encryptedSecret } = this.totp.generateSecret(
      user.email,
      process.env.APP_NAME ?? 'SaaS Platform',
    );

    await this.prisma.runScoped(tenantId, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: { twoFactorPendingSecret: encryptedSecret },
      }),
    );

    return { secret: base32, otpauthUrl };
  }

  /** Step 2 of 2FA setup: verify the first code to confirm the secret is correct. */
  async enableTwoFactor(
    userId: string,
    tenantId: string | null,
    code: string,
  ): Promise<void> {
    const user = await this.prisma.runScoped(tenantId, (tx) =>
      tx.user.findUnique({ where: { id: userId } }),
    );
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'User not found.' });
    if (user.twoFactorEnabled) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '2FA is already enabled.',
      });
    }
    if (!user.twoFactorPendingSecret) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No 2FA setup in progress. Call /auth/2fa/setup first.',
      });
    }

    if (!this.totp.verify(user.twoFactorPendingSecret, code)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid authenticator code. Please scan the QR code again.',
      });
    }

    await this.prisma.runScoped(tenantId, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: user.twoFactorPendingSecret,
          twoFactorPendingSecret: null,
        },
      }),
    );
  }

  /** Disable 2FA — requires a valid TOTP code as confirmation. */
  async disableTwoFactor(
    userId: string,
    tenantId: string | null,
    code: string,
  ): Promise<void> {
    const user = await this.prisma.runScoped(tenantId, (tx) =>
      tx.user.findUnique({ where: { id: userId } }),
    );
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'User not found.' });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '2FA is not enabled on this account.',
      });
    }

    if (!this.totp.verify(user.twoFactorSecret, code)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid authenticator code.',
      });
    }

    await this.prisma.runScoped(tenantId, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorPendingSecret: null,
        },
      }),
    );
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<AuthTokens> {
    const { userId, tenantId, newRefreshToken } = await this.sessions.rotate(
      refreshToken,
      meta.userAgent,
      meta.ipAddress,
    );

    // `tenantId` comes from the Session row itself (denormalized at creation
    // time — see schema.prisma's comment on Session.tenantId) precisely so
    // this can be a properly RLS-scoped read instead of an unscoped one that
    // FORCE ROW LEVEL SECURITY would silently return zero rows for.
    //
    // `findUnique`, NOT `findUniqueOrThrow` — same fix as `buildMeResponse`
    // below: a still-valid refresh token for a tenant that's since been
    // permanently deleted (FR-AU-03) must fail cleanly (401), not crash with
    // an unhandled Prisma NotFoundError.
    const user = await this.prisma.runScoped(tenantId, (tx) =>
      tx.user.findUnique({ where: { id: userId } }),
    );
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'This account no longer exists.',
      });
    }

    const accessToken = this.signAccessToken({
      userId: user.id,
      tenantId,
      email: user.email,
    });
    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.accessTtlSeconds(),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    // Look up by hash directly (not via SessionsService.revoke, which needs
    // a userId we don't necessarily have yet) — revoke whatever session this
    // exact refresh token belongs to, no-op if already gone.
    const tokenHash = hashOpaqueToken(refreshToken);
    await this.prisma.base.session.updateMany({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessions.revokeAll(userId);
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    const tokenHash = hashOpaqueToken(dto.token);
    const record = await this.prisma.base.verificationToken.findFirst({
      where: {
        tokenHash,
        type: 'email_verification',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid or expired verification token.',
      });

    // record.tenantId (denormalized at creation — see schema.prisma) is what
    // makes this a properly scoped write instead of an unscoped one RLS would
    // silently no-op for any real tenant user.
    await this.prisma.runScoped(record.tenantId, (tx) =>
      tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    );
    await this.prisma.base.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    requestTenantId: string | null,
  ): Promise<void> {
    const user = await this.prisma.runScoped(requestTenantId, (tx) =>
      tx.user.findFirst({
        where: { tenantId: requestTenantId, email: dto.email },
      }),
    );
    // Deliberately do not reveal whether the email exists — always resolve silently.
    if (!user) return;

    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.base.verificationToken.create({
      data: {
        userId: user.id,
        tenantId: requestTenantId,
        type: 'password_reset',
        tokenHash: hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    await this.emailQueue.add(EMAIL_JOB_NAMES.sendPasswordResetEmail, {
      toEmail: user.email,
      resetUrl: `${process.env.WEB_APP_URL}/reset-password?token=${rawToken}`,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = hashOpaqueToken(dto.token);
    const record = await this.prisma.base.verificationToken.findFirst({
      where: {
        tokenHash,
        type: 'password_reset',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid or expired reset token.',
      });

    const passwordHash = await argon2.hash(dto.password);
    await this.prisma.runScoped(record.tenantId, (tx) =>
      tx.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    );
    await this.prisma.base.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    // Reset password invalidates every existing session — same rationale as reuse-detection.
    await this.sessions.revokeAll(record.userId);
  }

  async switchTenant(
    currentEmail: string,
    dto: SwitchTenantDto,
    meta: RequestMeta,
  ): Promise<{ tokens: AuthTokens } & MeResponse> {
    const user = await this.prisma.runScoped(dto.tenantId, (tx) =>
      tx.user.findFirst({
        where: { tenantId: dto.tenantId, email: currentEmail },
      }),
    );
    if (!user) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'No membership in that tenant.',
      });
    }
    const tokens = await this.issueTokenPair(
      { userId: user.id, tenantId: dto.tenantId, email: user.email },
      meta,
    );
    const me = await this.buildMeResponse(user.id, dto.tenantId);
    return { tokens, ...me };
  }

  async me(userId: string, tenantId: string | null): Promise<MeResponse> {
    return this.buildMeResponse(userId, tenantId);
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  private async issueTokenPair(
    payload: { userId: string; tenantId: string | null; email: string },
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const accessToken = this.signAccessToken(payload);
    const refreshToken = await this.sessions.create(
      payload.userId,
      payload.tenantId,
      meta.userAgent,
      meta.ipAddress,
    );
    return { accessToken, refreshToken, expiresIn: this.accessTtlSeconds() };
  }

  private signAccessToken(payload: {
    userId: string;
    tenantId: string | null;
    email: string;
  }): string {
    const jwtPayload: JwtAccessPayload = {
      sub: payload.userId,
      tenantId: payload.tenantId,
      email: payload.email,
      type: 'access',
    };
    return this.jwt.sign(jwtPayload);
  }

  private accessTtlSeconds(): number {
    const ttl = process.env.JWT_ACCESS_TTL ?? '15m';
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const [, amount, unit] = match;
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 60;
    return Number(amount) * multiplier;
  }

  private async enqueueVerificationEmail(
    userId: string,
    tenantId: string | null,
    email: string,
  ): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.base.verificationToken.create({
      data: {
        userId,
        tenantId,
        type: 'email_verification',
        tokenHash: hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
    await this.emailQueue.add(EMAIL_JOB_NAMES.sendVerificationEmail, {
      toEmail: email,
      verifyUrl: `${process.env.WEB_APP_URL}/verify-email?token=${rawToken}`,
    });
  }

  private async buildMeResponse(
    userId: string,
    tenantId: string | null,
  ): Promise<MeResponse> {
    // `findUnique`, NOT `findUniqueOrThrow` — a real bug caught during the
    // compliance feature's e2e verification: a still-valid JWT for a tenant
    // that's since been permanently deleted (FR-AU-03's retention-deletion
    // job) previously hit `findUniqueOrThrow`'s Prisma NotFoundError
    // unhandled, surfacing as a raw 500 instead of a clean, expected
    // "this token no longer refers to anything real" response — same
    // category as an expired/invalid token, so the same exception applies.
    const user = await this.prisma.runScoped(tenantId, (tx) =>
      tx.user.findUnique({ where: { id: userId } }),
    );
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'This account no longer exists.',
      });
    }
    const tenant = tenantId
      ? await this.prisma.base.tenant.findUnique({ where: { id: tenantId } })
      : null;
    const { roles, permissions } = await resolveGrantedPermissions(
      this.prisma,
      userId,
      tenantId,
    );

    return {
      user: { id: user.id, email: user.email, isActive: user.isActive, twoFactorEnabled: user.twoFactorEnabled },
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            subdomain: tenant.subdomain,
            status: tenant.status,
          }
        : null,
      roles,
      permissions,
    };
  }
}
