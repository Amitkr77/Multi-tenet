import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // The Phase 1 stub `GET /health` that lived here (hardcoded `{status:
  // 'ok'}`, no actual checks) has been superseded by modules/health —
  // a real Terminus health check pinging Postgres + Redis (M-O3). It was
  // silently shadowing the new route (both `@Controller('health') @Get()`
  // in health.controller.ts and this stub matched `GET /health`; Nest/Express
  // match registration order, and AppController is declared first in
  // app.module.ts) — removed here rather than left as dead, misleading code.
}
