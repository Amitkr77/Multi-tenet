import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { buildSwaggerConfig } from '../src/swagger-config';

/**
 * Regression gate for 08-development-roadmap.md's cross-cutting milestone
 * "OpenAPI/Swagger spec kept in sync — checked in CI." Every one of this
 * codebase's routes validates its body via `@Body(new
 * ZodValidationPipe(schema)) dto: any` — Nest's Swagger introspection can't
 * see `any` on its own, so the actual bug this guards against is the spec
 * silently regressing to empty (or missing) request-body schemas for every
 * route, the way it was before `ZodBody`/`ZodQuery` (see
 * common/decorators/zod-body.decorator.ts) were added next to each one.
 *
 * Boots the REAL compiled AppModule (same pattern as
 * tenant-isolation.e2e-spec.ts) rather than a mocked shortcut — this is a
 * spec generated from live, resolved controller metadata, not a static file.
 */
/**
 * `requestBody` is typed as `RequestBodyObject | ReferenceObject` — this
 * suite only ever deals with resolved, non-`$ref` bodies (nothing here uses
 * `ApiExtraModels`/shared component refs), so narrowing via `any` at this
 * one boundary is simpler than repeating a type guard at every call site.
 */
function requestBodySchema(
  document: ReturnType<typeof SwaggerModule.createDocument>,
  path: string,
): { properties?: Record<string, unknown> } | undefined {
  const op = (document.paths[path] as any)?.post;
  return op?.requestBody?.content?.['application/json']?.schema;
}

describe('OpenAPI spec (e2e)', () => {
  let app: INestApplication;
  let document: ReturnType<typeof SwaggerModule.createDocument>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['metrics', 'health'] });
    await app.init();

    document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates a document without throwing, with a non-trivial path count', () => {
    expect(document).toBeDefined();
    expect(Object.keys(document.paths).length).toBeGreaterThan(30);
  });

  it("/products POST body schema reflects createProductSchema's real fields", () => {
    const schema = requestBodySchema(document, '/api/v1/products');
    expect(schema?.properties).toBeDefined();
    expect(Object.keys(schema!.properties!)).toEqual(
      expect.arrayContaining(['name', 'slug', 'basePrice']),
    );
  });

  it("/customers/register POST body schema reflects customerRegisterSchema's real fields", () => {
    const schema = requestBodySchema(document, '/api/v1/customers/register');
    expect(schema?.properties).toBeDefined();
    expect(Object.keys(schema!.properties!)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it("/auth/register POST body schema reflects registerSchema's real fields (never regresses to an empty {} body)", () => {
    const schema = requestBodySchema(document, '/api/v1/auth/register');
    expect(schema?.properties).toBeDefined();
    expect(Object.keys(schema!.properties!).length).toBeGreaterThan(0);
  });

  it('routes are grouped under real tags, not just the Swagger default', () => {
    const tagNames = document.tags?.map((t) => t.name) ?? [];
    expect(tagNames).toEqual(
      expect.arrayContaining(['Auth', 'Products', 'Customers', 'Inventory']),
    );
  });
});
