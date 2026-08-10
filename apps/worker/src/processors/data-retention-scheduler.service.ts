import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { QUEUE_NAMES, COMPLIANCE_JOB_NAMES } from "@saas/shared-types";

/**
 * Registers DataRetentionProcessor's recurring retention-expiry check on
 * worker boot. Same shape as `DunningSchedulerService` exactly — BullMQ
 * dedupes repeatable jobs by (name, repeat options, jobId), so
 * re-registering on every boot is safe.
 */
@Injectable()
export class DataRetentionSchedulerService implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUE_NAMES.dataRetention)
    private readonly dataRetentionQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dataRetentionQueue.add(
      COMPLIANCE_JOB_NAMES.checkRetentionDeletes,
      {},
      {
        jobId: "data-retention-check-recurring",
        repeat: {
          every: Number(
            process.env.DATA_RETENTION_CHECK_INTERVAL_MS ?? 86_400_000,
          ),
        },
      },
    );
  }
}
