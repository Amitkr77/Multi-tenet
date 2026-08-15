import 'dotenv/config'; // must be the first import — every other module's env reads depend on this having already run
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { buildSwaggerConfig } from './swagger-config';
import { validateApiEnvironment } from './config/validate-environment';

async function bootstrap() {
  validateApiEnvironment();
  // bufferLogs holds Nest's early bootstrap logs until useLogger below swaps
  // in the pino-backed logger, so nothing gets lost or double-formatted.
  // rawBody: true populates `req.rawBody` on every request (alongside the
  // normal parsed `req.body`) — the Stripe webhook controller needs the
  // exact raw bytes to verify the signature; JSON.stringify-ing the parsed
  // body back would not byte-for-byte match what Stripe actually signed.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));

  app.use(helmet());
  app.use(cookieParser()); // reads the httpOnly refresh_token cookie — see auth.controller.ts

  app.enableCors({
    origin: process.env.WEB_CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  // `metrics`/`health` stay unprefixed — Prometheus scrape configs and
  // container orchestrator health checks expect conventional bare paths,
  // not `/api/v1/...`.
  app.setGlobalPrefix('api/v1', { exclude: ['metrics', 'health'] });

  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
