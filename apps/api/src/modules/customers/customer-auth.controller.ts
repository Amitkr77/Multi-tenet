import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  customerRegisterSchema,
  customerLoginSchema,
  customerSelfUpdateSchema,
  createAddressSchema,
  updateAddressSchema,
} from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import {
  CurrentCustomer,
  type AuthenticatedCustomer,
} from '../../common/decorators/current-customer.decorator';
import { CustomerJwtGuard } from '../../common/guards/customer-jwt.guard';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAddressesService } from './customer-addresses.service';

const REFRESH_COOKIE_NAME = 'customer_refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/customers';

function requestMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge:
      Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

function requireTenant(tenantId: string | null): asserts tenantId is string {
  if (!tenantId) {
    throw new NotFoundException({
      code: 'TENANT_NOT_FOUND',
      message: 'No store resolved for this request.',
    });
  }
}

/**
 * Storefront-facing (public) customer auth — 06-api-specification.md §6.
 * Registered before customers.controller.ts's `:id` route (see that file's
 * comment) so these literal paths always win.
 */
@ApiTags('Customers')
@Controller('customers')
export class CustomerAuthController {
  constructor(
    private readonly customerAuthService: CustomerAuthService,
    private readonly addressesService: CustomerAddressesService,
  ) {}

  @Public()
  @ZodBody(customerRegisterSchema)
  @Post('register')
  async register(
    @CurrentTenantId() tenantId: string | null,
    @Body(new ZodValidationPipe(customerRegisterSchema)) dto: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    requireTenant(tenantId);
    const result = await this.customerAuthService.register(
      tenantId,
      dto,
      requestMeta(req),
    );
    setRefreshCookie(res, result.tokens.refreshToken);
    return result;
  }

  @Public()
  @ZodBody(customerLoginSchema)
  @Post('login')
  async login(
    @CurrentTenantId() tenantId: string | null,
    @Body(new ZodValidationPipe(customerLoginSchema)) dto: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    requireTenant(tenantId);
    const result = await this.customerAuthService.login(
      tenantId,
      dto,
      requestMeta(req),
    );
    setRefreshCookie(res, result.tokens.refreshToken);
    return result;
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token)
      throw new NotFoundException({
        code: 'UNAUTHORIZED',
        message: 'No refresh token provided.',
      });
    const tokens = await this.customerAuthService.refresh(
      token,
      requestMeta(req),
    );
    setRefreshCookie(res, tokens.refreshToken);
    return tokens;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) await this.customerAuthService.logout(token);
    clearRefreshCookie(res);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Get('me')
  me(
    @CurrentTenantId() tenantId: string | null,
    @CurrentCustomer() customer: AuthenticatedCustomer,
  ) {
    requireTenant(tenantId);
    return this.customerAuthService.me(tenantId, customer.customerId);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @ZodBody(customerSelfUpdateSchema)
  @Patch('me')
  updateMe(
    @CurrentTenantId() tenantId: string | null,
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(customerSelfUpdateSchema)) dto: any,
  ) {
    requireTenant(tenantId);
    return this.customerAuthService.updateMe(
      tenantId,
      customer.customerId,
      dto,
    );
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Get('me/addresses')
  listAddresses(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.addressesService.list(customer.customerId);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @ZodBody(createAddressSchema)
  @Post('me/addresses')
  addAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(createAddressSchema)) dto: any,
  ) {
    return this.addressesService.create(
      customer.tenantId,
      customer.customerId,
      dto,
    );
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @ZodBody(updateAddressSchema)
  @Patch('me/addresses/:addressId')
  updateAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('addressId') addressId: string,
    @Body(new ZodValidationPipe(updateAddressSchema)) dto: any,
  ) {
    return this.addressesService.update(customer.customerId, addressId, dto);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Delete('me/addresses/:addressId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('addressId') addressId: string,
  ) {
    await this.addressesService.remove(customer.customerId, addressId);
  }
}
