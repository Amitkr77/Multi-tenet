import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Liveness/readiness endpoint for container orchestration + Prometheus
 * alerting (NFR-O-02/03). `@Public()` and excluded from the `api/v1` global
 * prefix (see main.ts) — orchestrators and scrapers expect a bare, stable
 * path with no auth.
 *
 * Pings the DB via `PrismaService.base` (the un-extended client — a
 * liveness probe needs no tenant scope) using Terminus's first-party
 * `PrismaHealthIndicator`. Redis has no first-party indicator here, so it
 * gets a throwaway connection + `ping()` via `HealthIndicatorService`.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma.base),
      () => this.checkRedis(),
    ]);
  }

  private async checkRedis() {
    const indicator = this.healthIndicatorService.check('redis');
    const redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    try {
      await redis.connect();
      await redis.ping();
      return indicator.up();
    } catch (err) {
      return indicator.down({ message: (err as Error).message });
    } finally {
      redis.disconnect();
    }
  }
}
