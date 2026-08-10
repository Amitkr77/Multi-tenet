import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { LoggerModule } from "nestjs-pino";
import { QUEUE_NAMES } from "@saas/shared-types";
import { EmailProcessor } from "./processors/email.processor";
import { DunningProcessor } from "./processors/dunning.processor";
import { DunningSchedulerService } from "./processors/dunning-scheduler.service";
import { WebhookDeliveryProcessor } from "./processors/webhook-delivery.processor";
import { DataExportProcessor } from "./processors/data-export.processor";
import { DataRetentionProcessor } from "./processors/data-retention.processor";
import { DataRetentionSchedulerService } from "./processors/data-retention-scheduler.service";

@Module({
  imports: [
    // No `pinoHttp` config — this process has no HTTP surface
    // (createApplicationContext, see main.ts). Just structured `Logger`/
    // `PinoLogger` injection, replacing plain console/Nest-console output.
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === "production"
            ? undefined
            : { target: "pino-pretty", options: { singleLine: true } },
      },
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.email }),
    BullModule.registerQueue({ name: QUEUE_NAMES.billing }),
    BullModule.registerQueue({ name: QUEUE_NAMES.webhookDelivery }),
    BullModule.registerQueue({ name: QUEUE_NAMES.dataExport }),
    BullModule.registerQueue({ name: QUEUE_NAMES.dataRetention }),
  ],
  providers: [
    EmailProcessor,
    DunningProcessor,
    DunningSchedulerService,
    WebhookDeliveryProcessor,
    DataExportProcessor,
    DataRetentionProcessor,
    DataRetentionSchedulerService,
  ],
})
export class WorkerModule {}
