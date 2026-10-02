# MASAR Partners

Native Android/iOS partner app for MASAR, with the central API extensions and customer-web source in a pnpm workspace.

## Source packages

- `artifacts/masar-partners`: Expo app, Arabic/RTL and English.
- `artifacts/api-server`: central API source with partner registration, dispatch and push extensions.
- `artifacts/masar-mobility-syria`: customer-web source.
- `lib`: shared API contract, generated clients and database schema.

## Development

Use pnpm. Install workspace dependencies with `pnpm install`.

- `pnpm run typecheck`: workspace typecheck.
- `pnpm --filter @workspace/masar-partners run typecheck`: mobile typecheck.

The mobile app's internal build profile is `preview`, in `artifacts/masar-partners/eas.json`. For EAS GitHub builds, use the app directory `artifacts/masar-partners`.

## Pilot status

This repository contains source code, not a working live pilot or an app-store release.

The Expo project identity and Android/iOS identifiers are configured, but signing, push credentials, physical-device testing, and the connection to the original MASAR account service/API still require setup and verification.

Use the original MASAR accounts and central backend; do not create an independent replacement account store or live database. Do not bypass authentication origin restrictions.

See `MASAR_PARTNERS_PILOT.md` for configuration and verification requirements.

## Public-source boundary

This source export excludes local environment files, credentials, uploaded archives/documents, internal agent files, workspace history, dependencies and generated build output. Configure credentials through the owning service's secure settings, never through source files.

Public source publication does not authorize a production deployment, database migration or app-store submission.