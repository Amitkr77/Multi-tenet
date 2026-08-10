import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { QUEUE_NAMES, BILLING_JOB_NAMES } from "@saas/shared-types";

/**
 * Registers DunningProcessor's recurring grace-period check on worker boot.
 * The FIRST scheduled/repeating BullMQ job in this codebase — no existing
 * precedent, established fresh here. BullMQ dedupes repeatable jobs by
 * (name, repeat options, jobId), so re-registering on every boot is safe —
 * it will not double-schedule.
 */
@Injectable()
export class DunningSchedulerService implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUE_NAMES.billing) private readonly billingQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.billingQueue.add(
      BILLING_JOB_NAMES.checkPastDueTenants,
      {},
      {
        jobId: "dunning-check-recurring",
        repeat: {
          every: Number(process.env.DUNNING_CHECK_INTERVAL_MS ?? 3_600_000),
        },
      },
    );
  }
}
