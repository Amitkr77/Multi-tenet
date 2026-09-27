import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import {
  CurrentCustomer,
  type AuthenticatedCustomer,
} from '../../common/decorators/current-customer.decorator';
import { CustomerJwtGuard } from '../../common/guards/customer-jwt.guard';
import { PrismaService } from '../../prisma/prisma.service';

function requireTenant(tenantId: string | null): asserts tenantId is string {
  if (!tenantId) {
    throw new NotFoundException({
      code: 'TENANT_NOT_FOUND',
      message: 'No store resolved for this request.',
    });
  }
}

/**
 * Public product Q&A for storefront customers.
 * List is always public (answered questions only); posting requires a
 * customer JWT (CustomerJwtGuard applied per-method within @Public() class).
 */
@ApiTags('Storefront')
@Public()
@Controller('storefront/products')
export class StorefrontQaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':productId/questions')
  listQuestions(
    @CurrentTenantId() tenantId: string | null,
    @Param('productId') productId: string,
  ): Promise<any[]> {
    requireTenant(tenantId);
    return this.prisma.runScoped(tenantId, (tx) =>
      tx.productQuestion.findMany({
        where: { tenantId, productId, status: 'answered' },
        select: {
          id: true,
          question: true,
          answer: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  @UseGuards(CustomerJwtGuard)
  @Post(':productId/questions')
  async askQuestion(
    @CurrentTenantId() tenantId: string | null,
    @Param('productId') productId: string,
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body('question') question: string,
  ): Promise<any> {
    requireTenant(tenantId);
    if (!question?.trim()) {
      throw new NotFoundException({
        code: 'VALIDATION_ERROR',
        message: 'Question text is required.',
      });
    }
    return this.prisma.runScoped(tenantId, (tx) =>
      tx.productQuestion.create({
        data: {
          tenantId,
          productId,
          customerId: customer.customerId,
          question: question.trim(),
          status: 'pending',
        },
        select: { id: true, question: true, status: true, createdAt: true },
      }),
    );
  }
}
