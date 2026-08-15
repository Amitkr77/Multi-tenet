import "dotenv/config"; // must be the first import — every other module's env reads depend on this having already run
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { QUEUE_NAMES } from "@saas/shared-types";
import { WorkerModule } from "./worker.module";
import { validateWorkerEnvironment } from "./validate-environment";

/**
 * No HTTP listener — this process only consumes BullMQ queues.
 * `createApplicationContext` boots Nest's DI container without an HTTP server.
 */
async function bootstrap() {
  validateWorkerEnvironment();
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.enableShutdownHooks();

  // Single-object-arg form: nestjs-pino's `Logger` (implementing Nest's
  // LoggerService contract) treats a trailing string argument as "context",
  // not a message — passing `msg` inside the object is how pino sets the
  // log line's message text while still attaching structured fields.
  logger.log({
    msg: "[worker] listening for jobs",
    queues: Object.keys(QUEUE_NAMES),
  });
}
bootstrap();
