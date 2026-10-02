import { Router, type IRouter } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { db, pool, driverProfilesTable, registeredVehiclesTable, roadsideRequestsTable } from "@workspace/db";
import { eq, and, or, inArray, desc, isNull, lt, gt, gte, notLike, sql } from "drizzle-orm";
import {
  GetMembershipResponse, ConfirmBankMembershipBody,
  ListRegisteredVehiclesResponse, RegisterVehicleBody, RegisterVehicleResponse,
  UpdateRegisteredVehicleBody, UpdateRegisteredVehicleResponse,
  SubmitRoadsideRequestBody, SubmitRoadsideRequestResponse, ListRoadsideRequestsResponse,
  ListDispatchRequestsResponse, UpdateDispatchRequestBody, UpdateDispatchRequestResponse,
  OfferDispatchRequestBody, OfferDispatchRequestResponse, GetProviderIdentityResponse,
  ListProviderRequestsResponse, RespondProviderRequestBody, RespondProviderRequestResponse,
  TakeoverDispatchRequestBody, TakeoverDispatchRequestResponse,
  ReleaseDispatchRequestBody, ReleaseDispatchRequestResponse,
  ReofferDispatchRequestBody, ReofferDispatchRequestResponse,
} from "@workspace/api-zod";
import { randomUUID } from "node:crypto";
import { membershipFor } from "../lib/membership";
import {
  activeDispatchStatuses, canOperatorTransition, canReofferDispatch, canReleaseDispatch,
  canTakeOverDispatch, transportAfterReassignment,
} from "../lib/dispatchTransitions";

const router: IRouter = Router();
const user = (req: Parameters<typeof getAuth>[0]) => getAuth(req).userId;
const vehicleResponse = (v: typeof registeredVehiclesTable.$inferSelect) =>
  ({ id: v.id, make: v.make, plate: v.plate, electric: v.electric });
const requestResponse = async (row: typeof roadsideRequestsTable.$inferSelect) => {
  const needsContact = !row.customerName.trim() || !row.customerPhone.trim();
  const needsVehicle = !row.vehicleMake.trim() || !row.vehiclePlate.trim();
  const [[profile], [vehicle]] = await Promise.all([
    needsContact
      ? db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, row.userId))
      : Promise.resolve([]),
    needsVehicle
      ? db.select().from(registeredVehiclesTable).where(and(
        eq(registeredVehiclesTable.id, row.vehicleId),
        eq(registeredVehiclesTable.userId, row.userId),
      ))
      : Promise.resolve([]),
  ]);
  return {
    id: row.id, vehicleId: row.vehicleId, service: row.service, location: row.location,
    ...(row.destination ? { destination: row.destination } : {}),
    ...(row.garage ? { garage: row.garage } : {}),
    customerName: row.customerName.trim() ? row.customerName : profile?.name.trim() || row.customerName,
    customerPhone: row.customerPhone.trim() ? row.customerPhone : profile?.phone.trim() || row.customerPhone,
    vehicleMake: row.vehicleMake.trim() ? row.vehicleMake : vehicle?.make.trim() || row.vehicleMake,
    vehiclePlate: row.vehiclePlate.trim() ? row.vehiclePlate : vehicle?.plate.trim() || row.vehiclePlate,
    notes: row.notes, unsafe: row.unsafe,
    replacementTransport: row.replacementTransport, status: row.status,
    transportStatus: row.transportStatus,
    ...(row.operatorName ? { operatorName: row.operatorName } : {}),
    ...(row.providerName ? { providerName: row.providerName } : {}),
    ...(row.providerAcknowledgedAt ? { providerAcknowledgedAt: row.providerAcknowledgedAt.toISOString() } : {}),
    ...(row.statusNote ? { statusNote: row.statusNote } : {}),
    ...(row.recoveryReason ? { recoveryReason: row.recoveryReason } : {}),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
};
const dispatchResponse = async (row: typeof roadsideRequestsTable.$inferSelect, operatorId: string) => ({
  ...(await requestResponse(row)),
  assignedToMe: row.operatorId === operatorId,
});
// JSON timestamps and JavaScript Date values have millisecond precision, while
// PostgreSQL can retain microseconds. Match the whole submitted millisecond in
// atomic guards instead of comparing a rounded Date for exact timestamp equality.
const updatedAtWithinSubmittedMillisecond = (expected: Date) => and(
  gte(roadsideRequestsTable.updatedAt, expected),
  lt(roadsideRequestsTable.updatedAt, new Date(expected.getTime() + 1)),
);
// Expiration is deliberately lazy: authenticated polling triggers conditional DB writes.
// There is no background scheduler, so an idle server alone does not process timeouts.
async function expireUnansweredOffers() {
  const now = new Date();
  const expiresBefore = new Date(now.getTime() - 5 * 60 * 1000);
  await db.update(roadsideRequestsTable).set({
    status: "pending", providerId: null, providerName: null, operatorId: null, operatorName: null,
    providerAcknowledgedAt: null, offeredAt: null, statusNote: null, recoveryReason: null,
    transportStatus: sql`CASE WHEN replacement_transport THEN 'pending' ELSE 'not_requested' END`,
    updatedAt: now,
  }).where(and(
    eq(roadsideRequestsTable.status, "offered"),
    isNull(roadsideRequestsTable.providerAcknowledgedAt),
    noPartnerMarker,
    lt(sql`COALESCE(${roadsideRequestsTable.offeredAt}, ${roadsideRequestsTable.updatedAt})`, expiresBefore),
  ));
}
async function dispatchOperator(id: string | null) {
  if (!id) return null;
  const operator = await clerkClient.users.getUser(id);
  return operator.privateMetadata.dispatchOperator === true ? operator : null;
}
async function verifiedProvider(id: string | null) {
  if (!id) return null;
  const provider = await clerkClient.users.getUser(id);
  return provider.privateMetadata.dispatchProvider === true ? provider : null;
}
const providerName = (provider: { firstName: string | null; lastName: string | null }) =>
  [provider.firstName, provider.lastName].filter(Boolean).join(" ") || "Verified provider";
const partnerAssignmentExists = async (requestId: string) => {
  const result = await pool.query(
    "SELECT 1 FROM partner_jobs WHERE request_id=$1 AND status IN ('offered','accepted','enroute','arrived') LIMIT 1",
    [requestId],
  );
  return (result.rowCount ?? 0) > 0;
};
const noActivePartnerAssignment = (requestId: string) => sql`NOT EXISTS (
  SELECT 1 FROM partner_jobs pj WHERE pj.request_id = ${requestId}
  AND pj.status IN ('offered','accepted','enroute','arrived')
)`;
const noPartnerMarker = or(isNull(roadsideRequestsTable.providerId), notLike(roadsideRequestsTable.providerId, "partner:%"));

router.get("/membership", async (req, res): Promise<void> => {
  const id = user(req);
  if (!id) { res.status(401).json({ error: "Sign in required" }); return; }
  res.json(GetMembershipResponse.parse(await membershipFor(id)));
});

router.post("/membership/manual-confirmation", async (req, res): Promise<void> => {
  const operatorId = user(req);
  if (!operatorId) { res.status(401).json({ error: "Sign in required" }); return; }
  const operator = await dispatchOperator(operatorId);
  if (!operator) { res.status(403).json({ error: "Verified operator role required" }); return; }
  const parsed = ConfirmBankMembershipBody.safeParse(req.body);
  if (!parsed.success || parsed.data.confirmedPayment !== true || !parsed.data.userId.trim()) {
    res.status(400).json({ error: "Confirm receipt of payment and select a customer and plan" }); return;
  }
  const { userId, plan, billing } = parsed.data;
  try {
    await clerkClient.users.getUser(userId);
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404) {
      res.status(404).json({ error: "Customer not found" }); return;
    }
    throw error;
  }
  const confirmedAt = new Date();
  const expiresAt = new Date(confirmedAt);
  const originalDay = confirmedAt.getUTCDate();
  expiresAt.setUTCDate(1);
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + (billing === "annual" ? 12 : 1));
  const lastDayOfMonth = new Date(Date.UTC(expiresAt.getUTCFullYear(), expiresAt.getUTCMonth() + 1, 0)).getUTCDate();
  expiresAt.setUTCDate(Math.min(originalDay, lastDayOfMonth));
  // Atomic conflict check: two concurrent confirmations cannot grant two terms.
  const confirmed = await pool.query(
    `INSERT INTO public.bank_memberships (user_id, plan, billing, confirmed_at, expires_at, confirmed_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       plan = EXCLUDED.plan, billing = EXCLUDED.billing, confirmed_at = EXCLUDED.confirmed_at,
       expires_at = EXCLUDED.expires_at, confirmed_by = EXCLUDED.confirmed_by
     WHERE bank_memberships.expires_at <= NOW()
     RETURNING user_id`,
    [userId, plan, billing, confirmedAt, expiresAt, operatorId],
  );
  if (!confirmed.rowCount) { res.status(409).json({ error: "Customer already has an active membership" }); return; }
  req.log.info({ operatorId, customerId: userId, plan, billing }, "Bank payment confirmed by operator");
  res.json(GetMembershipResponse.parse(await membershipFor(userId)));
});

router.get("/vehicles", async (req, res): Promise<void> => {
  const id = user(req);
  if (!id) { res.status(401).json({ error: "Sign in required" }); return; }
  const rows = await db.select().from(registeredVehiclesTable).where(eq(registeredVehiclesTable.userId, id));
  res.json(ListRegisteredVehiclesResponse.parse(rows.map(vehicleResponse)));
});

router.post("/vehicles", async (req, res): Promise<void> => {
  const id = user(req);
  if (!id) { res.status(401).json({ error: "Sign in required" }); return; }
  const parsed = RegisterVehicleBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.make.trim() || !parsed.data.plate.trim()) { res.status(400).json({ error: "Make and plate are required" }); return; }
  const entitlement = await membershipFor(id);
  if (!entitlement.active) { res.status(403).json({ error: "An active paid subscription is required" }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [id]);
    const count = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM registered_vehicles WHERE user_id = $1", [id]);
    if (Number(count.rows[0].count) >= entitlement.vehicleLimit) {
      await client.query("ROLLBACK");
      res.status(403).json({ error: `Your plan allows ${entitlement.vehicleLimit} registered vehicle(s)` }); return;
    }
    const result = await client.query<{ id: string; make: string; plate: string; electric: boolean }>(
      "INSERT INTO registered_vehicles (id, user_id, make, plate, electric) VALUES ($1,$2,$3,$4,$5) RETURNING id, make, plate, electric",
      [randomUUID(), id, parsed.data.make.trim(), parsed.data.plate.trim(), parsed.data.electric]);
    await client.query("COMMIT");
    res.status(201).json(RegisterVehicleResponse.parse(result.rows[0]));
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
});

router.put("/vehicles/:id", async (req, res): Promise<void> => {
  const id = user(req);
  if (!id) { res.status(401).json({ error: "Sign in required" }); return; }
  const parsed = UpdateRegisteredVehicleBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.make.trim() || !parsed.data.plate.trim()) { res.status(400).json({ error: "Make and plate are required" }); return; }
  const allowed = await membershipFor(id);
  if (!allowed.active) { res.status(403).json({ error: "An active paid subscription is required" }); return; }
  const registered = await db.select().from(registeredVehiclesTable).where(eq(registeredVehiclesTable.userId, id));
  if (registered.length > allowed.vehicleLimit) { res.status(403).json({ error: "Remove vehicles beyond your plan limit first" }); return; }
  const [row] = await db.update(registeredVehiclesTable).set({
    make: parsed.data.make.trim(), plate: parsed.data.plate.trim(), electric: parsed.data.electric,
  }).where(and(eq(registeredVehiclesTable.id, String(req.params.id)), eq(registeredVehiclesTable.userId, id))).returning();
  if (!row) { res.status(404).json({ error: "Vehicle not found" }); return; }
  res.json(UpdateRegisteredVehicleResponse.parse(vehicleResponse(row)));
});

router.delete("/vehicles/:id", async (req, res): Promise<void> => {
  const id = user(req);
  if (!id) { res.status(401).json({ error: "Sign in required" }); return; }
  const [row] = await db.delete(registeredVehiclesTable).where(and(eq(registeredVehiclesTable.id, String(req.params.id)), eq(registeredVehiclesTable.userId, id))).returning();
  if (!row) { res.status(404).json({ error: "Vehicle not found" }); return; }
  res.sendStatus(204);
});

router.get("/roadside-requests", async (req, res): Promise<void> => {
  const id = user(req);
  if (!id) { res.status(401).json({ error: "Sign in required" }); return; }
  await expireUnansweredOffers();
  const rows = await db.select().from(roadsideRequestsTable).where(eq(roadsideRequestsTable.userId, id)).orderBy(desc(roadsideRequestsTable.createdAt));
  res.json(ListRoadsideRequestsResponse.parse(await Promise.all(rows.map(requestResponse))));
});

router.post("/roadside-requests", async (req, res): Promise<void> => {
  const id = user(req);
  if (!id) { res.status(401).json({ error: "Sign in required" }); return; }
  const parsed = SubmitRoadsideRequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const input = parsed.data;
  const location = input.location.trim();
  const notes = input.notes.trim();
  const destination = input.destination?.trim();
  const garage = input.garage?.trim();
  if (!location || (input.destination !== undefined && input.service !== "tow")
      || (input.garage !== undefined && input.service !== "tow")
      || (input.destination !== undefined && !destination)
      || (input.garage !== undefined && !garage)
      || notes.length > 1000 || destination && destination.length > 300 || garage && garage.length > 200) {
    res.status(400).json({ error: "Invalid request" }); return;
  }
  if (input.idempotencyKey) {
    const [original] = await db.select().from(roadsideRequestsTable).where(and(
      eq(roadsideRequestsTable.userId, id),
      eq(roadsideRequestsTable.idempotencyKey, input.idempotencyKey),
    ));
    if (original) {
      res.status(200).json(SubmitRoadsideRequestResponse.parse(await requestResponse(original)));
      return;
    }
  }
  const entitlement = await membershipFor(id);
  if (!entitlement.active) { res.status(403).json({ error: "An active paid subscription is required" }); return; }
  if ((garage && !entitlement.garageChoice) || (input.replacementTransport && !entitlement.replacementTransport)) {
    res.status(403).json({ error: "This benefit requires Premium" }); return;
  }
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, id));
  const customerName = profile?.name.trim() ?? "";
  const customerPhone = profile?.phone.trim() ?? "";
  if (!customerName || !customerPhone || customerName.length > 120 || customerPhone.length > 40) {
    res.status(400).json({ error: "Complete your account name and phone number before requesting assistance" }); return;
  }
  const vehicles = await db.select().from(registeredVehiclesTable).where(eq(registeredVehiclesTable.userId, id));
  if (vehicles.length > entitlement.vehicleLimit) { res.status(403).json({ error: "Remove vehicles beyond your plan limit first" }); return; }
  const vehicle = vehicles.find(v => v.id === input.vehicleId);
  if (!vehicle) { res.status(403).json({ error: "Select a vehicle registered to your plan" }); return; }
  const values = {
    id: randomUUID(), userId: id, vehicleId: vehicle.id,
    customerName, customerPhone, vehicleMake: vehicle.make.trim(), vehiclePlate: vehicle.plate.trim(),
    service: input.service, location,
    destination: input.service === "tow" ? destination || null : null,
    garage: input.service === "tow" ? garage || null : null,
    notes, unsafe: input.unsafe, replacementTransport: input.replacementTransport,
    idempotencyKey: input.idempotencyKey ?? null,
    transportStatus: input.replacementTransport ? "pending" : "not_requested",
  };
  const inserted = await db.insert(roadsideRequestsTable).values(values)
    .onConflictDoNothing({ target: [roadsideRequestsTable.userId, roadsideRequestsTable.idempotencyKey] })
    .returning();
  if (inserted[0]) {
    res.status(201).json(SubmitRoadsideRequestResponse.parse(await requestResponse(inserted[0])));
    return;
  }
  if (!input.idempotencyKey) { res.status(409).json({ error: "Request could not be saved; please retry" }); return; }
  const [original] = await db.select().from(roadsideRequestsTable).where(and(
    eq(roadsideRequestsTable.userId, id),
    eq(roadsideRequestsTable.idempotencyKey, input.idempotencyKey),
  ));
  if (!original) { res.status(409).json({ error: "Idempotency key already used by another request" }); return; }
  res.status(200).json(SubmitRoadsideRequestResponse.parse(await requestResponse(original)));
});

router.get("/dispatch/requests", async (req, res): Promise<void> => {
  const operator = await dispatchOperator(user(req));
  if (!operator) { res.status(403).json({ error: "Dispatch operator access required" }); return; }
  await expireUnansweredOffers();
  const rows = await db.select().from(roadsideRequestsTable)
    .where(or(
      eq(roadsideRequestsTable.status, "pending"),
      inArray(roadsideRequestsTable.status, activeDispatchStatuses.filter((status) => status !== "pending")),
    ))
    .orderBy(desc(roadsideRequestsTable.createdAt));
  res.json(ListDispatchRequestsResponse.parse(await Promise.all(rows.map((row) => dispatchResponse(row, operator.id)))));
});

router.post("/dispatch/requests/:id/offer", async (req, res): Promise<void> => {
  const operator = await dispatchOperator(user(req));
  if (!operator) { res.status(403).json({ error: "Dispatch operator access required" }); return; }
  const parsed = OfferDispatchRequestBody.safeParse(req.body);
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(String(req.params.id))) {
    res.status(400).json({ error: "Invalid provider offer" }); return;
  }
  const provider = await verifiedProvider(parsed.data.providerId).catch(() => null);
  if (!provider) { res.status(400).json({ error: "Recipient is not a verified provider" }); return; }
  if (await partnerAssignmentExists(String(req.params.id))) { res.status(409).json({ error: "Request is assigned to a partner company" }); return; }
  const offeredAt = new Date();
  const [updated] = await db.update(roadsideRequestsTable).set({
    status: "offered", offeredAt, providerId: provider.id, providerName: providerName(provider),
    providerAcknowledgedAt: null, operatorId: operator.id,
    operatorName: providerName(operator), statusNote: null, recoveryReason: null,
    transportStatus: sql`CASE WHEN replacement_transport THEN 'pending' ELSE 'not_requested' END`,
    updatedAt: new Date(),
  }).where(and(
    eq(roadsideRequestsTable.id, String(req.params.id)),
    noActivePartnerAssignment(String(req.params.id)),
    noPartnerMarker,
    eq(roadsideRequestsTable.status, "pending"),
    or(isNull(roadsideRequestsTable.operatorId), eq(roadsideRequestsTable.operatorId, operator.id)),
  )).returning();
  if (!updated) { res.status(409).json({ error: "Request is no longer awaiting a provider" }); return; }
  res.json(OfferDispatchRequestResponse.parse(await requestResponse(updated)));
});

router.post("/dispatch/requests/:id/takeover", async (req, res): Promise<void> => {
  const operator = await dispatchOperator(user(req));
  if (!operator) { res.status(403).json({ error: "Dispatch operator access required" }); return; }
  const parsed = TakeoverDispatchRequestBody.safeParse(req.body);
  const requestId = String(req.params.id);
  const reason = parsed.success ? parsed.data.reason.trim() : "";
  if (!parsed.success || !reason || reason.length > 500 || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    res.status(400).json({ error: "A reason and valid request ID are required" }); return;
  }
  const [current] = await db.select().from(roadsideRequestsTable).where(eq(roadsideRequestsTable.id, requestId));
  if (!current) { res.status(404).json({ error: "Request not found" }); return; }
  if (await partnerAssignmentExists(requestId)) { res.status(409).json({ error: "Request is assigned to a partner company" }); return; }
  if (current.updatedAt.getTime() !== parsed.data.expectedUpdatedAt.getTime()) {
    res.status(409).json({ error: "Request changed; refresh the queue before taking it over" }); return;
  }
  if (!canTakeOverDispatch(current.status) || current.operatorId === operator.id) {
    res.status(409).json({ error: "Request is not assigned to another operator for takeover" }); return;
  }
  const [updated] = await db.update(roadsideRequestsTable).set({
    offeredAt: current.status === "offered"
      ? sql`COALESCE(${roadsideRequestsTable.offeredAt}, ${roadsideRequestsTable.updatedAt})`
      : current.offeredAt,
    operatorId: operator.id, operatorName: providerName(operator), recoveryReason: reason,
    updatedAt: new Date(),
  }).where(and(
    eq(roadsideRequestsTable.id, requestId),
    noActivePartnerAssignment(requestId),
    noPartnerMarker,
    eq(roadsideRequestsTable.status, current.status),
    updatedAtWithinSubmittedMillisecond(parsed.data.expectedUpdatedAt),
    current.operatorId ? eq(roadsideRequestsTable.operatorId, current.operatorId) : isNull(roadsideRequestsTable.operatorId),
  )).returning();
  if (!updated) { res.status(409).json({ error: "Request ownership or status changed; refresh the queue" }); return; }
  res.json(TakeoverDispatchRequestResponse.parse(await dispatchResponse(updated, operator.id)));
});

router.post("/dispatch/requests/:id/release", async (req, res): Promise<void> => {
  const operator = await dispatchOperator(user(req));
  if (!operator) { res.status(403).json({ error: "Dispatch operator access required" }); return; }
  const parsed = ReleaseDispatchRequestBody.safeParse(req.body);
  const requestId = String(req.params.id);
  const reason = parsed.success ? parsed.data.reason.trim() : "";
  if (!parsed.success || !reason || reason.length > 500 || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    res.status(400).json({ error: "A reason and valid request ID are required" }); return;
  }
  const [current] = await db.select().from(roadsideRequestsTable).where(eq(roadsideRequestsTable.id, requestId));
  if (!current) { res.status(404).json({ error: "Request not found" }); return; }
  if (await partnerAssignmentExists(requestId)) { res.status(409).json({ error: "Request is assigned to a partner company" }); return; }
  if (current.updatedAt.getTime() !== parsed.data.expectedUpdatedAt.getTime()) {
    res.status(409).json({ error: "Request changed; refresh the queue before releasing it" }); return;
  }
  if (current.operatorId !== operator.id || !canReleaseDispatch(current.status)) {
    res.status(409).json({ error: "Only your unaccepted pending/offered assignment can be released" }); return;
  }
  const [updated] = await db.update(roadsideRequestsTable).set({
    status: "pending", providerId: null, providerName: null, providerAcknowledgedAt: null,
    operatorId: null, operatorName: null, offeredAt: null, statusNote: null,
    recoveryReason: reason,
    transportStatus: transportAfterReassignment(current.replacementTransport),
    updatedAt: new Date(),
  }).where(and(
    eq(roadsideRequestsTable.id, requestId),
    noActivePartnerAssignment(requestId),
    noPartnerMarker,
    eq(roadsideRequestsTable.status, current.status),
    updatedAtWithinSubmittedMillisecond(parsed.data.expectedUpdatedAt),
    eq(roadsideRequestsTable.operatorId, operator.id),
    current.status === "offered" ? isNull(roadsideRequestsTable.providerAcknowledgedAt) : undefined,
  )).returning();
  if (!updated) { res.status(409).json({ error: "Request changed before it could be released" }); return; }
  res.json(ReleaseDispatchRequestResponse.parse(await dispatchResponse(updated, operator.id)));
});

router.post("/dispatch/requests/:id/reoffer", async (req, res): Promise<void> => {
  const operator = await dispatchOperator(user(req));
  if (!operator) { res.status(403).json({ error: "Dispatch operator access required" }); return; }
  const parsed = ReofferDispatchRequestBody.safeParse(req.body);
  const requestId = String(req.params.id);
  const reason = parsed.success ? parsed.data.reason.trim() : "";
  if (!parsed.success || !reason || reason.length > 500 || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    res.status(400).json({ error: "A reason and valid request ID are required" }); return;
  }
  const provider = await verifiedProvider(parsed.data.providerId).catch(() => null);
  if (!provider) { res.status(400).json({ error: "Recipient is not a verified provider" }); return; }
  const [current] = await db.select().from(roadsideRequestsTable).where(eq(roadsideRequestsTable.id, requestId));
  if (!current) { res.status(404).json({ error: "Request not found" }); return; }
  if (await partnerAssignmentExists(requestId)) { res.status(409).json({ error: "Request is assigned to a partner company" }); return; }
  if (current.updatedAt.getTime() !== parsed.data.expectedUpdatedAt.getTime()) {
    res.status(409).json({ error: "Request changed; refresh the queue before reoffering it" }); return;
  }
  if (current.operatorId !== operator.id || !canReofferDispatch(current.status, current.providerAcknowledgedAt)) {
    res.status(409).json({ error: "Only your unanswered offer can be reoffered; accepted service stays assigned" }); return;
  }
  if (current.providerId === provider.id) { res.status(400).json({ error: "Choose a different verified provider" }); return; }
  const offeredAt = new Date();
  const [updated] = await db.update(roadsideRequestsTable).set({
    offeredAt, providerId: provider.id, providerName: providerName(provider), providerAcknowledgedAt: null,
    statusNote: null, recoveryReason: reason,
    transportStatus: transportAfterReassignment(current.replacementTransport),
    updatedAt: new Date(),
  }).where(and(
    eq(roadsideRequestsTable.id, requestId),
    noActivePartnerAssignment(requestId),
    noPartnerMarker,
    eq(roadsideRequestsTable.status, "offered"),
    updatedAtWithinSubmittedMillisecond(parsed.data.expectedUpdatedAt),
    eq(roadsideRequestsTable.operatorId, operator.id),
    current.providerId ? eq(roadsideRequestsTable.providerId, current.providerId) : isNull(roadsideRequestsTable.providerId),
    isNull(roadsideRequestsTable.providerAcknowledgedAt),
  )).returning();
  if (!updated) { res.status(409).json({ error: "Offer changed before it could be reassigned" }); return; }
  res.json(ReofferDispatchRequestResponse.parse(await dispatchResponse(updated, operator.id)));
});

router.get("/provider/me", async (req, res): Promise<void> => {
  const provider = await verifiedProvider(user(req));
  if (!provider) { res.status(403).json({ error: "Provider access required" }); return; }
  res.json(GetProviderIdentityResponse.parse({ id: provider.id, name: providerName(provider) }));
});

router.get("/provider/requests", async (req, res): Promise<void> => {
  const provider = await verifiedProvider(user(req));
  if (!provider) { res.status(403).json({ error: "Provider access required" }); return; }
  await expireUnansweredOffers();
  const rows = await db.select().from(roadsideRequestsTable)
    .where(eq(roadsideRequestsTable.providerId, provider.id))
    .orderBy(desc(roadsideRequestsTable.createdAt));
  res.json(ListProviderRequestsResponse.parse(await Promise.all(rows.map(requestResponse))));
});

router.post("/provider/requests/:id/response", async (req, res): Promise<void> => {
  const provider = await verifiedProvider(user(req));
  if (!provider) { res.status(403).json({ error: "Provider access required" }); return; }
  await expireUnansweredOffers();
  const parsed = RespondProviderRequestBody.safeParse(req.body);
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(String(req.params.id))) {
    res.status(400).json({ error: "Invalid provider response" }); return;
  }
  const respondedAt = new Date();
  if (await partnerAssignmentExists(String(req.params.id))) { res.status(409).json({ error: "Request is assigned to a partner company" }); return; }
  const offerCutoff = new Date(respondedAt.getTime() - 5 * 60 * 1000);
  const [updated] = await db.update(roadsideRequestsTable).set(parsed.data.accept ? {
    status: "accepted", offeredAt: null, providerAcknowledgedAt: respondedAt, updatedAt: respondedAt,
  } : {
    status: "pending", providerId: null, providerName: null, operatorId: null,
    operatorName: null, offeredAt: null, statusNote: "Provider declined; awaiting another provider.", recoveryReason: null,
    transportStatus: sql`CASE WHEN replacement_transport THEN 'pending' ELSE 'not_requested' END`,
    updatedAt: respondedAt,
  }).where(and(eq(roadsideRequestsTable.id, String(req.params.id)),
    noActivePartnerAssignment(String(req.params.id)),
    noPartnerMarker,
    eq(roadsideRequestsTable.providerId, provider.id), eq(roadsideRequestsTable.status, "offered"),
    isNull(roadsideRequestsTable.providerAcknowledgedAt),
     ...(parsed.data.accept ? [gt(sql`COALESCE(${roadsideRequestsTable.offeredAt}, ${roadsideRequestsTable.updatedAt})`, offerCutoff)] : []),
  )).returning();
  if (!updated) { res.status(409).json({ error: "Offer already answered or withdrawn" }); return; }
  res.json(RespondProviderRequestResponse.parse(await requestResponse(updated)));
});

router.patch("/dispatch/requests/:id", async (req, res): Promise<void> => {
  const operator = await dispatchOperator(user(req));
  if (!operator) { res.status(403).json({ error: "Dispatch operator access required" }); return; }
  const parsed = UpdateDispatchRequestBody.safeParse(req.body);
  const requestId = String(req.params.id);
  if (!parsed.success || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId)) {
    res.status(400).json({ error: "Invalid dispatch update" }); return;
  }
  const { status, transportStatus, note } = parsed.data;
  const [current] = await db.select().from(roadsideRequestsTable).where(eq(roadsideRequestsTable.id, requestId));
  if (!current) { res.status(404).json({ error: "Request not found" }); return; }
  const partnerActive = await partnerAssignmentExists(requestId);
  const partnerTransportOnly = partnerActive && status === current.status && !!transportStatus;
  if (partnerActive && !partnerTransportOnly) { res.status(409).json({ error: "Request is assigned to a partner company" }); return; }
  if (status === "accepted" && (current.status !== "accepted" || !current.providerAcknowledgedAt || !transportStatus)) {
    res.status(409).json({ error: "Only the provider can accept an offer" }); return;
  }
  if (current.operatorId && current.operatorId !== operator.id) {
    res.status(409).json({ error: "Request is assigned to another operator; take over before updating it" }); return;
  }
  if (!canOperatorTransition(current.status, status, !!transportStatus)) {
    res.status(409).json({ error: "Invalid request status transition" }); return;
  }
  if (current.status === "pending" && transportStatus && transportStatus !== "pending") {
    res.status(400).json({ error: "Transport cannot be confirmed before accepting the request" }); return;
  }
  if (transportStatus && (!current.replacementTransport || status === "unavailable" && transportStatus === "confirmed")) {
    res.status(400).json({ error: "Invalid transport confirmation" }); return;
  }
  if (transportStatus && current.transportStatus !== "pending") {
    res.status(409).json({ error: "Replacement transport decision already recorded" }); return;
  }
  if (status === "completed" && current.replacementTransport && current.transportStatus === "pending") {
    res.status(409).json({ error: "Confirm or decline replacement transport before completing the request" }); return;
  }
  const name = [operator.firstName, operator.lastName].filter(Boolean).join(" ") || "MASAR operator";
  const [updated] = await db.update(roadsideRequestsTable).set({
    status, operatorId: operator.id, operatorName: name,
    offeredAt: null,
    ...(transportStatus ? { transportStatus } : status === "unavailable" && current.transportStatus === "pending" ? { transportStatus: "unavailable" } : {}),
    ...(note !== undefined ? { statusNote: note.trim() || null } : {}),
    updatedAt: new Date(),
  }).where(and(eq(roadsideRequestsTable.id, requestId),
    partnerTransportOnly ? undefined : noActivePartnerAssignment(requestId),
    partnerTransportOnly ? undefined : noPartnerMarker,
    eq(roadsideRequestsTable.status, current.status),
    current.operatorId ? eq(roadsideRequestsTable.operatorId, operator.id) : isNull(roadsideRequestsTable.operatorId),
    transportStatus ? eq(roadsideRequestsTable.transportStatus, current.transportStatus) : undefined,
  )).returning();
  if (!updated) { res.status(409).json({ error: "Request already claimed or status changed; refresh the queue" }); return; }
  res.json(UpdateDispatchRequestResponse.parse(await requestResponse(updated)));
});

export default router;