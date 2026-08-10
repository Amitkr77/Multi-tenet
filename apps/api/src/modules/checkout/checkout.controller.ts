import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { checkoutRequestSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentCustomer,
  type AuthenticatedCustomer,
} from '../../common/decorators/current-customer.decorator';
import { CustomerJwtGuard } from '../../common/guards/customer-jwt.guard';
import { CheckoutService } from './checkout.service';

@ApiTags('Checkout')
@Controller('checkout')
@Public()
@UseGuards(CustomerJwtGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @ZodBody(checkoutRequestSchema)
  @Post('quote')
  quote(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(checkoutRequestSchema)) dto: any,
  ) {
    return this.checkoutService.quote(
      customer.tenantId,
      customer.customerId,
      dto,
    );
  }

  @ZodBody(checkoutRequestSchema)
  @Post('complete')
  complete(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(checkoutRequestSchema)) dto: any,
  ) {
    return this.checkoutService.complete(
      customer.tenantId,
      customer.customerId,
      dto,
    );
  }
}
