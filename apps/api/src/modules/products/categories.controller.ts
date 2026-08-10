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
import { createCategorySchema, updateCategorySchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { CategoriesService } from './categories.service';

@ApiTags('Products')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermissions('products.view')
  list(@CurrentTenantId() tenantId: string) {
    return this.categoriesService.list(tenantId);
  }

  @ZodBody(createCategorySchema)
  @Post()
  @RequirePermissions('products.manage')
  create(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(createCategorySchema)) dto: any,
  ) {
    return this.categoriesService.create(tenantId, dto);
  }

  @ZodBody(updateCategorySchema)
  @Patch(':id')
  @RequirePermissions('products.manage')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) dto: any,
  ) {
    return this.categoriesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('products.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.categoriesService.remove(tenantId, id);
  }
}
