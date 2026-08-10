import { Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeHistogramProvider,
  getToken,
} from '@willsoto/nestjs-prometheus';
import { MetricsController } from './metrics.controller';

export const HTTP_REQUEST_DURATION_METRIC = 'http_request_duration_seconds';

@Module({
  imports: [
    PrometheusModule.register({
      controller: MetricsController,
      defaultMetrics: { enabled: true }, // Node process metrics: heap, event loop lag, GC, etc.
    }),
  ],
  providers: [
    // Labeled only by {method, route, status_code} — NEVER tenant_id (or any
    // other high-cardinality value) here. Prometheus label cardinality is
    // the metric-store's actual failure mode; per-tenant breakdowns belong
    // in the structured logs (M-O1), not in metrics.
    makeHistogramProvider({
      name: HTTP_REQUEST_DURATION_METRIC,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
  ],
  // Exported so HttpMetricsInterceptor — a plain AppModule-level provider,
  // not a member of this module — can @InjectMetric(...) it (Nest DI: a
  // provider declared in AppModule can inject anything exported by a module
  // AppModule imports).
  exports: [getToken(HTTP_REQUEST_DURATION_METRIC)],
})
export class MetricsModule {}
