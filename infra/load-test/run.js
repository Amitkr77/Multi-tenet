/**
 * Load-test runner — Load & Performance Testing Against NFR Targets.
 *
 * Four scenarios, matching the approved plan:
 *   1. single-tenant read   — GET /products, one tenant, all traffic against it.
 *   2. single-tenant write  — POST /coupons, one tenant.
 *   3. multi-tenant read    — GET /products, concurrent requests spread across
 *      all seeded tenants (each connection uses a different tenant's JWT +
 *      X-Tenant-Subdomain), the architecture-specific question: does
 *      per-request `SET LOCAL app.tenant_id` add meaningful overhead when
 *      many different tenant contexts are interleaved on a shared pool?
 *   4. multi-tenant write   — POST /coupons, same multi-tenant spread.
 *
 * Run against the PRODUCTION build (`node dist/main.js`), not `nest start
 * --watch` — see seed.js's header comment and the plan's own disclosed
 * methodology note.
 *
 * Requires `tenants.json` (produced by seed.js) in this same directory.
 */
const fs = require('node:fs');
const path = require('node:path');
const autocannon = require('autocannon');

const API_BASE = process.env.LOAD_TEST_API_BASE ?? 'http://localhost:3010/api/v1';
const DURATION_SEC = Number(process.env.LOAD_TEST_DURATION ?? 15);
const CONNECTIONS = Number(process.env.LOAD_TEST_CONNECTIONS ?? 20);

const tenants = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tenants.json'), 'utf8'),
);

function run(opts) {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

function summarize(name, result) {
  return {
    name,
    requests_total: result.requests.total,
    throughput_req_per_sec: result.requests.average,
    latency_p50_ms: result.latency.p50,
    latency_p95_ms: result.latency.p97_5 ?? result.latency.p95, // autocannon reports p97_5, not p95, natively
    latency_p99_ms: result.latency.p99,
    latency_mean_ms: result.latency.mean,
    non2xx: result.non2xx,
    errors: result.errors,
  };
}

async function scenarioSingleTenantRead() {
  const t = tenants[0];
  return run({
    url: `${API_BASE}/products`,
    connections: CONNECTIONS,
    duration: DURATION_SEC,
    headers: {
      Authorization: `Bearer ${t.accessToken}`,
      'X-Tenant-Subdomain': t.subdomain,
    },
  });
}

// `setupClient` (used for headers, which are fine to share across every
// request on a connection) runs ONCE per connection, not per request — a
// static body set there gets replayed identically on every subsequent
// request within that connection's `duration`-based run. For a write
// endpoint enforcing a per-tenant unique `code`, that means every request
// after a connection's first one collides (409) — measuring a benchmark
// bug, not the app. `requests[].setupRequest` runs per REQUEST, so a fresh
// unique code goes out every time.
let writeCounter = 0;
function uniqueCouponBody(prefix) {
  writeCounter++;
  return JSON.stringify({
    code: `${prefix}-${process.pid}-${writeCounter}-${Math.random().toString(36).slice(2)}`,
    type: 'percentage',
    value: 10,
  });
}

// NOTE: when `requests[]` is used, each entry's own `path` is the FULL
// request path sent on the wire — it does NOT append to the top-level
// `url`'s pathname (confirmed by a direct debug run: `url:
// '.../api/v1/coupons'` + `requests: [{path: '/coupons'}]` actually sent
// `POST /coupons`, a bare 404, not `/api/v1/coupons`). So `url` here is
// origin-only and every `requests[].path` below carries the full
// `/api/v1/...` prefix explicitly.
const ORIGIN = new URL(API_BASE).origin;
const API_PREFIX = new URL(API_BASE).pathname; // '/api/v1'

async function scenarioSingleTenantWrite() {
  const t = tenants[0];
  return run({
    url: ORIGIN,
    connections: CONNECTIONS,
    duration: DURATION_SEC,
    headers: {
      Authorization: `Bearer ${t.accessToken}`,
      'X-Tenant-Subdomain': t.subdomain,
      'Content-Type': 'application/json',
    },
    requests: [
      {
        method: 'POST',
        path: `${API_PREFIX}/coupons`,
        setupRequest: (request) => {
          request.body = uniqueCouponBody('LOADTEST-ST');
          return request;
        },
      },
    ],
  });
}

async function scenarioMultiTenantRead() {
  let i = 0;
  return run({
    url: `${API_BASE}/products`,
    connections: CONNECTIONS,
    duration: DURATION_SEC,
    setupClient: (client) => {
      const t = tenants[i % tenants.length];
      i++;
      client.setHeaders({
        Authorization: `Bearer ${t.accessToken}`,
        'X-Tenant-Subdomain': t.subdomain,
      });
    },
  });
}

async function scenarioMultiTenantWrite() {
  let i = 0;
  return run({
    url: ORIGIN,
    connections: CONNECTIONS,
    duration: DURATION_SEC,
    setupClient: (client) => {
      // Headers ARE fine to fix per-connection (each connection = one
      // simulated tenant for its whole run) — only the body needs to vary
      // per request, handled by setupRequest below.
      const t = tenants[i % tenants.length];
      i++;
      client.setHeaders({
        Authorization: `Bearer ${t.accessToken}`,
        'X-Tenant-Subdomain': t.subdomain,
        'Content-Type': 'application/json',
      });
    },
    requests: [
      {
        method: 'POST',
        path: `${API_PREFIX}/coupons`,
        setupRequest: (request) => {
          request.body = uniqueCouponBody('LOADTEST-MT');
          return request;
        },
      },
    ],
  });
}

async function main() {
  const results = [];

  console.log('Running scenario 1/4: single-tenant read (GET /products)...');
  results.push(summarize('single-tenant read', await scenarioSingleTenantRead()));

  console.log('Running scenario 2/4: single-tenant write (POST /coupons)...');
  results.push(summarize('single-tenant write', await scenarioSingleTenantWrite()));

  console.log('Running scenario 3/4: multi-tenant-concurrent read (GET /products)...');
  results.push(summarize('multi-tenant read', await scenarioMultiTenantRead()));

  console.log('Running scenario 4/4: multi-tenant-concurrent write (POST /coupons)...');
  results.push(summarize('multi-tenant write', await scenarioMultiTenantWrite()));

  console.log('\n=== RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
