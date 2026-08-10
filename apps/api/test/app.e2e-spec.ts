import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirrors main.ts's real bootstrap — `metrics`/`health` stay unprefixed
    // (see M-O3/main.ts's comment: scrapers/orchestrators expect bare paths).
    app.setGlobalPrefix('api/v1', { exclude: ['metrics', 'health'] });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // A real Terminus check (Postgres + Redis pings) replaced the Phase 1
  // hardcoded `{status: 'ok'}` stub — see modules/health/* (M-O3). Asserting
  // on the full shape here, not just `status`, is what would have caught
  // this test still passing against a fake response.
  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        status: 'ok',
        info: { database: { status: 'up' }, redis: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' }, redis: { status: 'up' } },
      });
  });
});
