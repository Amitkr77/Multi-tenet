import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Histogram } from 'prom-client';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { HTTP_REQUEST_DURATION_METRIC } from '../../modules/metrics/metrics.module';

/**
 * Records `http_request_duration_seconds`, replacing the old placeholder
 * LoggingInterceptor's job of observing request duration (the access-log
 * side of that is now pino-http's own automatic completion log — see
 * app.module.ts's LoggerModule config).
 *
 * The `route` label MUST be the Express route template (e.g.
 * `/products/:id`), never `request.url` (which contains real UUIDs) — a
 * label per unique product/customer/etc. id would make this metric's
 * cardinality unbounded. `request.route?.path` is Express's own resolved
 * template, already free of that risk.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_REQUEST_DURATION_METRIC)
    private readonly histogram: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        // Success: the exception filter never ran, so response.statusCode
        // (set by the handler/framework) is already final.
        next: () => this.record(context, request, start, undefined),
        // Error: this fires while the error is still propagating up through
        // RxJS, BEFORE HttpExceptionFilter runs and actually writes
        // response.statusCode — reading it here would always see the
        // pre-error default (200). Derive the status from the error itself
        // instead (HttpException.getStatus(), else 500 for anything else).
        error: (err) => this.record(context, request, start, err),
      }),
    );
  }

  private record(
    context: ExecutionContext,
    request: any,
    start: bigint,
    err: unknown,
  ) {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = request.route?.path ?? 'unknown';
    const statusCode =
      err === undefined
        ? context.switchToHttp().getResponse().statusCode
        : err instanceof HttpException
          ? err.getStatus()
          : 500;
    this.histogram.observe(
      { method: request.method, route, status_code: statusCode },
      durationSeconds,
    );
  }
}
