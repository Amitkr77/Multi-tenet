import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createReviewSchema, moderateReviewSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import {
  CurrentCustomer,
  type AuthenticatedCustomer,
} from '../../common/decorators/current-customer.decorator';
import { CustomerJwtGuard } from '../../common/guards/customer-jwt.guard';
import { ReviewsService } from './reviews.service';

/**
 * One controller for all three routes — `GET /products/:id/reviews`
 * (Public), `POST /products/:id/reviews` (customer), `PATCH
 * /reviews/:id/moderate` (staff) are three different HTTP methods, not the
 * same path+method needing two incompatible guard chains (the actual reason
 * Products/Orders were split). `@Public()`/`@UseGuards(CustomerJwtGuard)`/
 * `@RequirePermissions(...)` co-exist fine at the method level here.
 */
@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get('products/:id/reviews')
  listApproved(
    @CurrentTenantId() tenantId: string | null,
    @Param('id') productId: string,
  ) {
    this.requireTenant(tenantId);
    return this.reviewsService.listApproved(tenantId!, productId);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @ZodBody(createReviewSchema)
  @Post('products/:id/reviews')
  create(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id') productId: string,
    @Body(new ZodValidationPipe(createReviewSchema)) dto: any,
  ) {
    return this.reviewsService.create(
      customer.tenantId,
      customer.customerId,
      productId,
      dto,
    );
  }

  @Get('reviews')
  @RequirePermissions('reviews.view')
  listForModeration(
    @CurrentTenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('productId') productId?: string,
  ) {
    return this.reviewsService.listForModeration(tenantId, {
      status,
      productId,
    });
  }

  @ZodBody(moderateReviewSchema)
  @Patch('reviews/:id/moderate')
  @RequirePermissions('reviews.moderate')
  moderate(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderateReviewSchema)) dto: any,
  ) {
    return this.reviewsService.moderate(tenantId, id, dto);
  }

  private requireTenant(tenantId: string | null): void {
    if (!tenantId) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'No store resolved for this request.',
      });
    }
  }
}
