import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  setAttributeValueSchema,
  presignImageSchema,
  confirmImageSchema,
  importProductsSchema,
} from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { EnforcePlanLimit } from '../../common/decorators/enforce-plan-limit.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions('products.view')
  list(
    @CurrentTenantId() tenantId: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.list(tenantId, {
      categoryId,
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // Registered before ":id" so the literal path always wins — same
  // ordering discipline as tenants.module.ts's /me-vs-/:id note in Phase 1.
  @Get('export')
  @RequirePermissions('products.manage')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="products.csv"')
  async export(@CurrentTenantId() tenantId: string) {
    return this.productsService.bulkExport(tenantId);
  }

  @ZodBody(importProductsSchema)
  @Post('import')
  @RequirePermissions('products.manage')
  async import(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(importProductsSchema)) dto: any,
  ) {
    return this.productsService.bulkImport(tenantId, dto.csv);
  }

  @Get(':id')
  @RequirePermissions('products.view')
  getOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.productsService.getById(tenantId, id);
  }

  @ZodBody(createProductSchema)
  @Post()
  @RequirePermissions('products.manage')
  @EnforcePlanLimit('product_count')
  create(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(createProductSchema)) dto: any,
  ) {
    return this.productsService.create(tenantId, dto);
  }

  @ZodBody(updateProductSchema)
  @Patch(':id')
  @RequirePermissions('products.manage')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: any,
  ) {
    return this.productsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('products.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.productsService.remove(tenantId, id);
  }

  @ZodBody(createVariantSchema)
  @Post(':id/variants')
  @RequirePermissions('products.manage')
  addVariant(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createVariantSchema)) dto: any,
  ) {
    return this.productsService.addVariant(tenantId, id, dto);
  }

  @ZodBody(updateVariantSchema)
  @Patch(':id/variants/:variantId')
  @RequirePermissions('products.manage')
  updateVariant(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body(new ZodValidationPipe(updateVariantSchema)) dto: any,
  ) {
    return this.productsService.updateVariant(tenantId, id, variantId, dto);
  }

  @ZodBody(setAttributeValueSchema)
  @Post(':id/attributes')
  @RequirePermissions('products.manage')
  setAttributeValue(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setAttributeValueSchema)) dto: any,
  ) {
    return this.productsService.setAttributeValue(tenantId, id, dto);
  }

  @ZodBody(presignImageSchema)
  @Post(':id/images/presign')
  @RequirePermissions('products.manage')
  presignImage(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(presignImageSchema)) dto: any,
  ) {
    return this.productsService.presignImage(tenantId, id, dto);
  }

  @ZodBody(confirmImageSchema)
  @Post(':id/images')
  @RequirePermissions('products.manage')
  confirmImage(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(confirmImageSchema)) dto: any,
  ) {
    return this.productsService.confirmImage(tenantId, id, dto);
  }

  @Delete(':id/images/:imageId')
  @RequirePermissions('products.manage')
  removeImage(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.productsService.removeImage(tenantId, id, imageId);
  }
}
