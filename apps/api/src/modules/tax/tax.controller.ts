import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createTaxRuleSchema, updateTaxRuleSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { TaxService } from './tax.service';

@ApiTags('Shipping & Tax')
@Controller('tax-rules')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get()
  @RequirePermissions('tax.view')
  list(@CurrentTenantId() tenantId: string) {
    return this.taxService.list(tenantId);
  }

  @ZodBody(createTaxRuleSchema)
  @Post()
  @RequirePermissions('tax.manage')
  create(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(createTaxRuleSchema)) dto: any,
  ) {
    return this.taxService.create(tenantId, dto);
  }

  @ZodBody(updateTaxRuleSchema)
  @Patch(':id')
  @RequirePermissions('tax.manage')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTaxRuleSchema)) dto: any,
  ) {
    return this.taxService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tax.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.taxService.remove(tenantId, id);
  }
}
