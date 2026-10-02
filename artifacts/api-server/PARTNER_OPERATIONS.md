# MASAR Partners backend operations

## Authorization and data

Partner identities are existing Clerk users. The first company member is created as owner in the same database transaction as company registration; further members must already exist in Clerk. Backend role checks are owner/planner/worker, while review, eligibility, offering, and audit routes require `privateMetadata.dispatchOperator === true`. No API accepts a client-selected owner, company status, owner role, or operator flag.

Partner jobs are assignments against `roadside_requests`, not a second customer-request store. Offer/decision/status operations lock the central request and partner-job rows, validate current status/version, and write audit and push-outbox records transactionally. Legacy individual-provider and operator mutations are fenced from active company assignments. Offers expire in the server scheduler and during partner queue reads; accepted assignments are never expired or reassigned automatically.

Company documents are private and may be read only by company owners or dispatch operators. Approved active company photos/logos use short-lived signed reads; public directory responses redact owner identity, personal contact fields, and all documents. GCS upload paths are generated server-side and persisted with their company, owner, kind, file name, and declared content type before a signed PUT is returned.

## Configuration and readiness

- `DATABASE_URL` must point to the central MASAR database. No mock or local fallback data is used.
- `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` enable authenticated routes. If absent, `/api/healthz` and the sanitized public partner directory remain reachable; protected API routes return `503`.
- `PRIVATE_OBJECT_DIR` must point to the provisioned Replit private object-storage directory for uploads and signed asset reads.
- Push outbox rows are durable. Development does not send pushes unless `MASAR_PARTNER_PUSH_ENABLED=true`; production attempts Expo delivery, tracks tickets/receipts, retries transient failures, and deactivates `DeviceNotRegistered` tokens. Push payloads contain only a job ID.
- AI integration initialization is deferred until an assistant request and reports `503` when its integration environment is absent.

The initially empty development database has received the imported MASAR schema and partner extensions using Drizzle schema push. No customer records were imported. Do not execute DDL at server startup or manually alter production. The existing `migrateMembership` helper remains source-only and is no longer called during startup.

## Rollout and verification boundaries

This API code must be integrated and published in the original central MASAR backend for the customer and operator apps to share these routes and tables. Development schema push is not a production deployment or migration. A native MASAR Partners build must be configured with the same central API and Clerk tenant. Expo/native push delivery has not been validated on a physical device or closed app; Apple/Google native build credentials and end-to-end client verification remain separate rollout steps.