import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  switchTenantSchema,
  verifyTotpSchema,
  completeTwoFactorLoginSchema,
} from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';

const REFRESH_COOKIE_NAME = 'refresh_token';

function requestMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

/**
 * The web client never touches the refresh token in JS — it's set as an
 * httpOnly cookie here (XSS resistance, per this project's stated
 * recommendation over localStorage) and the browser sends it automatically
 * on `/api/v1/auth/*` requests via `credentials: 'include'`. Non-browser
 * clients (mobile, machine-to-machine) that can't rely on cookies still get
 * the raw value in the JSON response body and pass it back explicitly.
 */
function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge:
      Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
}

/** Cookie wins (browser flow); body is the non-browser fallback. */
function resolveRefreshToken(
  req: Request,
  dto: { refreshToken?: string },
): string {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] ?? dto.refreshToken;
  if (!token) {
    throw new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: 'No refresh token provided.',
    });
  }
  return token;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Public()
  @ZodBody(registerSchema)
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, requestMeta(req));
    setRefreshCookie(res, result.tokens.refreshToken);
    return result;
  }

  @Public()
  @ZodBody(loginSchema)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: any,
    @CurrentTenantId() tenantId: string | null,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto,
      tenantId,
      requestMeta(req),
    );
    if (!('requiresTwoFactor' in result)) {
      setRefreshCookie(res, result.tokens.refreshToken);
    }
    return result;
  }

  @Public()
  @ZodBody(refreshSchema)
  @Post('refresh')
  async refresh(
    @Body(new ZodValidationPipe(refreshSchema)) dto: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = resolveRefreshToken(req, dto);
    const tokens = await this.authService.refresh(token, requestMeta(req));
    setRefreshCookie(res, tokens.refreshToken);
    return tokens;
  }

  @ZodBody(logoutSchema)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(logoutSchema)) dto: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] ?? dto.refreshToken;
    if (token) await this.authService.logout(token);
    clearRefreshCookie(res);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(user.userId);
    clearRefreshCookie(res);
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.list(user.userId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
  ) {
    await this.sessionsService.revoke(user.userId, sessionId);
  }

  @Public()
  @ZodBody(verifyEmailSchema)
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body(new ZodValidationPipe(verifyEmailSchema)) dto: any) {
    await this.authService.verifyEmail(dto);
  }

  @Public()
  @ZodBody(forgotPasswordSchema)
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) dto: any,
    @CurrentTenantId() tenantId: string | null,
  ) {
    await this.authService.forgotPassword(dto, tenantId);
  }

  @Public()
  @ZodBody(resetPasswordSchema)
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: any,
  ) {
    await this.authService.resetPassword(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.userId, user.tenantId);
  }

  @ZodBody(switchTenantSchema)
  @Post('switch-tenant')
  async switchTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(switchTenantSchema)) dto: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.switchTenant(
      user.email,
      dto,
      requestMeta(req),
    );
    setRefreshCookie(res, result.tokens.refreshToken);
    return result;
  }

  // --- 2FA (TOTP) ---

  /** Step 1: Generate a TOTP secret and QR URI (user not yet enrolled). */
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  setup2fa(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenantId() tenantId: string | null,
  ) {
    return this.authService.setupTwoFactor(user.userId, tenantId);
  }

  /** Step 2: Verify the first TOTP code to confirm enrollment. */
  @ZodBody(verifyTotpSchema)
  @Post('2fa/enable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async enable2fa(
    @Body(new ZodValidationPipe(verifyTotpSchema)) dto: { code: string },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenantId() tenantId: string | null,
  ) {
    await this.authService.enableTwoFactor(user.userId, tenantId, dto.code);
  }

  /** Disable 2FA — requires current TOTP code as confirmation. */
  @ZodBody(verifyTotpSchema)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disable2fa(
    @Body(new ZodValidationPipe(verifyTotpSchema)) dto: { code: string },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenantId() tenantId: string | null,
  ) {
    await this.authService.disableTwoFactor(user.userId, tenantId, dto.code);
  }

  /**
   * Complete a 2FA login challenge — call this after a `login()` response
   * returns `{ requiresTwoFactor: true, challengeToken }`.
   */
  @Public()
  @ZodBody(completeTwoFactorLoginSchema)
  @Post('2fa/login')
  @HttpCode(HttpStatus.OK)
  completeTwoFactorLogin(
    @Body(new ZodValidationPipe(completeTwoFactorLoginSchema)) dto: { challengeToken: string; code: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: any,
  ) {
    return this.authService.completeTwoFactorLogin(dto, requestMeta(req as any)).then((result) => {
      setRefreshCookie(res, result.tokens.refreshToken);
      return result;
    });
  }
}
