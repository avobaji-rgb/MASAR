# MASAR Partners

A native Expo partner app for Syrian towing companies and garages, with extensions to the imported MASAR API and customer web app.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server through its managed workflow
- `pnpm --filter @workspace/masar-partners run dev` — Expo native development and web preview
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `node --test artifacts/api-server/src/lib/partnerPolicy.test.mjs lib/db/src/partner-persistence.test.mjs` — policy and development-only database invariant tests
- Required configuration and rollout checklist: `MASAR_PARTNERS_PILOT.md`

## Stack

- pnpm workspaces, Node.js 24, TypeScript
- Mobile: Expo SDK 57, React Native, Expo Router, Clerk Expo, SecureStore
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/masar-partners/`: native app; Arabic/English strings in `lib/strings.ts`.
- `artifacts/masar-mobility-syria/`: imported customer web source; not separately registered or published here.
- `artifacts/api-server/`: imported central server with partner extensions.
- `lib/api-spec/openapi.yaml`: contract source; regenerate hooks and validators rather than editing generated output.
- `lib/db/src/schema/`: imported MASAR schema and company/team/job/upload/push extensions.

## Architecture decisions

- The ZIP contains source only. This workspace is not automatically connected to the original MASAR accounts, uploads, or database.
- Use the original central MASAR API and account service for shared live jobs. Never provision a separate live database or authentication tenant as a substitute.
- Configure native authentication through the owning original MASAR project's managed environment. The attempted cross-project web-preview connection was rejected by production domain security; the unsupported test configuration was removed. Do not bypass that security or mix development and production account stores.
- Apply these server extensions in the original project before pointing mobile at its live API. Development schema setup here does not change production.

## Product

Company registration/review, owner/planner/worker roles, service profiles and availability, targeted offers, execution/history, private verification uploads, native device registration and durable push delivery, operator review/dispatch/audit, and real approved public company listings.

## User preferences

- Preserve customer bank-transfer memberships and individual-provider dispatch.
- Do not add partner payments, commissions, chat, ratings, or continuous vehicle tracking.
- Do not publish or submit to an app store without the user's confirmation.
- Never invent partners, certifications, account access, or native-push test results.

## Gotchas

- Without the existing Clerk configuration, protected API calls explicitly return 503; the native app shows that sign-in is unavailable.
- Expo Go and web preview are not evidence of closed-app push delivery. Verify a credentialed native build on a physical device.
- Build the imported web app with `PORT` and `BASE_PATH` set, e.g. `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/masar-mobility-syria run build`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
