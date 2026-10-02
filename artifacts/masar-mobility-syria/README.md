# MASAR Mobility Syria

Mobile-first English/Arabic customer web-app demo for roadside assistance in Syria.

## Run

Use the existing managed **MASAR Mobility Syria** web workflow, or run `pnpm --filter @workspace/masar-mobility-syria run dev` with the workflow-provided `PORT` and `BASE_PATH` values. Type-check with `pnpm --filter @workspace/masar-mobility-syria run typecheck`.

## What the demo does

A bilingual AI assistant is available on every page. It uses Replit AI Integrations through the API server to answer questions about the demo; only typed chat messages and the current page are sent, not saved profile or location data. Responses may be inaccurate. AI usage has a shared daily server-side limit; when it is unavailable, the chat shows an error rather than a fabricated answer. When a driver cannot complete a step, they can explicitly save a **demo report** in this browser and review or delete it in the assistant. These reports are **not sent to MASAR staff** and do not trigger help; erasing demo data removes them. Questions already sent to the AI provider cannot be recalled by erasing browser data.

Google Maps can display the request location and a read-only request-location view on the demo tracking page. The user can tap the map, search an address, or use browser geolocation; the request itself still stays in this browser and there is no live technician location or dispatch. Enable Google Maps JavaScript API and Geocoding API in a Google Cloud project with billing, then supply `VITE_GOOGLE_MAPS_API_KEY` as a Replit Secret. Since Maps JavaScript runs in the browser, this key is visible to clients: restrict it to the app's development and published website referrers and to those APIs. If the key or map service is unavailable, the app clearly says so and provides an external Google Maps link; it never displays an invented route or technician position.

Create a local demo profile, manage vehicles, view subscription information, select roadside help, add optional notes and safety information, enter an address or choose browser-provided coordinates, and confirm a demo request. A local simulator moves the request through assigned, en route and arrived states. Enter the displayed code to simulate arrival verification, mark the service complete, leave a rating, and inspect the illustrative request detail in Activity. The Safety page shows guidance and lets you save an emergency contact locally. Settings and activity are kept in this browser's local storage; **Profile → Privacy → Erase demo data** clears them.

The guest demo never sends a request to an operator or technician. Its simulated progress is not live technician tracking, subscription verification, SMS, automatic emergency calling, or a partner connection. Assistance is intended to be provided through a subscription, so the app never shows a per-request price or asks for per-request payment. Demo garage entry, account confirmation, and request details are illustrative. Do not use the guest demo to request real roadside help.

## Signed-in account workflow

Signed-in customers use Clerk authentication and server-backed profiles, vehicles, and requests. An active, manually verified bank-transfer membership is required to submit a real assistance request. New subscription purchases remain unavailable until verified business bank details and final terms are supplied.

Real requests preserve notes, safety context, towing destination, and server-derived customer/vehicle details. Their status depends on actual operator/provider actions, not the demo simulator. See `../api-server/DISPATCH_OPERATIONS.md` for role provisioning, manual dispatch, recovery, and the limits of opt-in notifications while staff pages are open. No live technician GPS or guaranteed arrival time is implied.

The signed-in safety page reads and saves the account safety contact, shared with Profile. The guest safety page remains browser-local. Neither contact editor calls, texts, notifies, or shares location; the SOS telephone link only opens the device dialer.

The copy lives in `src/locales/en.ts` and `src/locales/ar.ts`; Arabic should be reviewed by a native speaker before public launch. The uploaded MASAR logo and photographs live in `public/masar/`.