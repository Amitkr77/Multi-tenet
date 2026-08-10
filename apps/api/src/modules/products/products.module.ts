import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { WebhookSubscriptionsModule } from '../webhook-subscriptions/webhook-subscriptions.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { AttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';
import { ProductsController } from './products.controller';
import { StorefrontProductsController } from './storefront-products.controller';
import { StorefrontCategoriesController } from './storefront-categories.controller';
import { StorefrontInfoController } from './storefront-info.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [StorageModule, WebhookSubscriptionsModule],
  controllers: [
    CategoriesController,
    BrandsController,
    AttributesController,
    ProductsController,
    StorefrontProductsController,
    StorefrontCategoriesController,
    StorefrontInfoController,
  ],
  providers: [
    CategoriesService,
    BrandsService,
    AttributesService,
    ProductsService,
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
