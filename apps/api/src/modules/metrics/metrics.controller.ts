import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Thin `@Public()` subclass of the library's default controller —
 * `PrometheusModule.register()` (see metrics.module.ts) applies its `path`
 * option's route metadata directly onto whichever controller class it's
 * given via `Reflect.defineMetadata`, so passing this one is how the
 * `/metrics` route is exempted from JwtAuthGuard (an APP_GUARD, applies
 * regardless of which module the controller lives in).
 */
@ApiExcludeController()
@Controller()
export class MetricsController extends PrometheusController {
  @Public()
  @Get()
  index(@Res({ passthrough: true }) response: Response) {
    return super.index(response);
  }
}
