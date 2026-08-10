# Non-Functional Requirements (NFR)

## Multi-Tenant SaaS Commerce Platform

---

## 1. Performance

| ID | Requirement |
|---|---|
| NFR-PF-01 | Storefront pages must render (LCP) in under 2.5 seconds on a standard broadband connection |
| NFR-PF-02 | API p95 response time must be under 300ms for read endpoints, under 600ms for write endpoints |
| NFR-PF-03 | Product images and static assets are served via CDN, not directly from origin storage |
| NFR-PF-04 | Database queries on tenant-scoped tables use composite indexes led by `tenant_id` |
| NFR-PF-05 | High-frequency counters (e.g., order volume for limit checks) are tracked in Redis, not read synchronously from Postgres on every request |
| NFR-PF-06 | Background jobs (emails, invoice generation, image processing) must not block the request/response cycle |

## 2. Scalability

| ID | Requirement |
|---|---|
| NFR-SC-01 | The API layer must be horizontally scalable (stateless NestJS instances behind a load balancer) |
| NFR-SC-02 | The system must support at least 10,000 active tenants and 1M+ products in the shared schema without architectural change |
| NFR-SC-03 | Background job workers must scale independently from the API (separate process/container) |
| NFR-SC-04 | Database read replicas can be introduced for analytics/reporting queries without application changes beyond connection routing |
| NFR-SC-05 | The architecture must allow specific modules (e.g., search, image processing) to be extracted into standalone services if they become bottlenecks, without a full rewrite |

## 3. Security

| ID | Requirement |
|---|---|
| NFR-SE-01 | Tenant data isolation must be enforced at the database layer (Row-Level Security), not application logic alone |
| NFR-SE-02 | `tenant_id` must never be accepted from client input; it is always derived from authenticated context |
| NFR-SE-03 | Passwords are hashed with Argon2 or bcrypt; plaintext passwords are never logged or stored |
| NFR-SE-04 | All traffic is served over HTTPS/TLS 1.2+ |
| NFR-SE-05 | All API inputs are validated (schema validation) and sanitized against injection and XSS |
| NFR-SE-06 | Rate limiting is applied per-tenant and per-IP on authentication and public endpoints |
| NFR-SE-07 | Secrets (API keys, DB credentials, Stripe keys) are stored in a secrets manager, never in source control |
| NFR-SE-08 | Cross-tenant data leakage is covered by automated tests as a required CI gate |
| NFR-SE-09 | Role-based access control is enforced on every API endpoint, verified server-side (never trusting client-side role checks) |
| NFR-SE-10 | Security headers (CSP, HSTS, X-Frame-Options, etc.) are applied via Helmet or equivalent |
| NFR-SE-11 | Sensitive actions are captured in immutable audit logs |

## 4. Availability & Reliability

| ID | Requirement |
|---|---|
| NFR-AV-01 | Target uptime SLA: 99.9% for the platform API and storefronts |
| NFR-AV-02 | Database backups run automatically with point-in-time recovery capability |
| NFR-AV-03 | Payment webhook processing is idempotent to survive retries without duplicate side effects |
| NFR-AV-04 | The system degrades gracefully — e.g., a search outage should not take down checkout |
| NFR-AV-05 | Health checks and readiness probes are exposed for all deployable services |
| NFR-AV-06 | Suspended or past-due tenants display a graceful "store unavailable" state rather than an error page |

## 5. Maintainability

| ID | Requirement |
|---|---|
| NFR-M-01 | Codebase follows a modular structure with clear module boundaries (see Folder/Module Architecture doc) |
| NFR-M-02 | All business logic has unit test coverage; all API endpoints have integration test coverage |
| NFR-M-03 | Database schema changes are managed through version-controlled migrations |
| NFR-M-04 | API is documented via OpenAPI/Swagger and kept in sync with implementation |
| NFR-M-05 | Shared types/DTOs between frontend and backend are centralized to prevent drift |

## 6. Observability

| ID | Requirement |
|---|---|
| NFR-O-01 | All logs are structured (JSON) and include `tenant_id`, `request_id`, and `user_id` where applicable |
| NFR-O-02 | System metrics (latency, error rate, throughput) are collected and visualized (Prometheus/Grafana or managed equivalent) |
| NFR-O-03 | Alerting is configured for elevated error rates, failed payments, and certificate renewal failures |

## 7. Compliance & Data Governance

| ID | Requirement |
|---|---|
| NFR-CP-01 | Tenant data export must be available on request (data portability) |
| NFR-CP-02 | Tenant offboarding includes a defined data retention/deletion timeline |
| NFR-CP-03 | Personally identifiable customer information is encrypted at rest |
| NFR-CP-04 | Payment data is never stored directly — handled via Stripe's PCI-compliant infrastructure |

## 8. Usability

| ID | Requirement |
|---|---|
| NFR-U-01 | Tenant dashboard and storefront must be responsive across desktop, tablet, and mobile viewports |
| NFR-U-02 | Storefronts must meet WCAG 2.1 AA accessibility standards |
| NFR-U-03 | Critical actions (delete product, issue refund, remove staff) require confirmation |
