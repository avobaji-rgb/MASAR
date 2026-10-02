import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { pool } from "@workspace/db";
import { randomUUID } from "node:crypto";
import {
  GetPartnerIdentityResponse, RegisterPartnerCompanyBody, RegisterPartnerCompanyResponse,
  GetPartnerCompanyResponse, UpdatePartnerCompanyBody, UpdatePartnerCompanyResponse,
  SetPartnerAvailabilityBody, SetPartnerAvailabilityResponse,
  ListPartnerMembersResponse, AddPartnerMemberBody, AddPartnerMemberResponse,
  UpdatePartnerMemberBody, UpdatePartnerMemberResponse, ListPartnerJobsResponse,
  GetPartnerJobResponse, UpdatePartnerJobBody, UpdatePartnerJobResponse,
  RespondPartnerOfferBody, RespondPartnerOfferResponse, RegisterPartnerDeviceBody,
  RegisterPartnerDeviceResponse, RemovePartnerDeviceBody, RemovePartnerDeviceResponse,
  ListPartnerReviewsResponse, ReviewPartnerCompanyBody, ReviewPartnerCompanyResponse,
  ListEligiblePartnerCompaniesResponse, OfferPartnerJobBody, OfferPartnerJobResponse,
  ListPartnerAuditResponse, ListPublicPartnersResponse, GetPartnerUploadBody,
  GetPartnerUploadResponse, ConfirmPartnerUploadBody, ConfirmPartnerUploadResponse,
  GetPartnerAssetResponse,
} from "@workspace/api-zod";
import { auditPartner, deliverPartnerPushOutbox, enqueuePartnerPush } from "../lib/partners";
import { canAssignWorker, canTransitionPartnerJob, canWorkerSeeJob, companySupportsService, isEligiblePartner, isFreshVersion } from "../lib/partnerPolicy";
import { inspectPartnerObject, newPartnerObjectPath, signedPartnerRead, signedPartnerUpload } from "../lib/partnerObjectStorage";
import { logger } from "../lib/logger";

type Role = "owner" | "planner" | "worker";
type DbClient = {
  query<T = any>(...args: any[]): Promise<{ rows: T[]; rowCount: number | null }>;
  release: () => void;
};
type Member = { id: string; company_id: string; user_id: string; role: Role; active: boolean };
type Company = {
  id: string; owner_id: string; name: string; type: "towing" | "garage" | "both";
  phone: string; contact: string; address: string; city: string; area: string; hours: string;
  services: string[]; logo: string | null; photos: string[]; documents: string[];
  status: "pending" | "approved" | "rejected" | "blocked"; review_reason: string | null;
  available: boolean; active: boolean; version: number; created_at: Date;
};
type Job = {
  id: string; company_id: string; request_id: string; service: string; location: string;
  destination: string | null; vehicle_make: string; vehicle_plate: string;
  customer_name: string; customer_phone: string; notes: string; status: string;
  offered_at: Date; expires_at: Date; accepted_at: Date | null; updated_at: Date;
  version: number; worker_id: string | null; accepted_by_id: string | null;
};

const router: IRouter = Router();
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(s);
const isExpoToken = (s: string) => /^(?:ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/.test(s);
const error = (res: Response, status: number, message: string) => { res.status(status).json({ error: message }); };
const companyDto = (c: Company, includeDocuments = false) => ({
  id: c.id, ownerId: c.owner_id, name: c.name, type: c.type, phone: c.phone, contact: c.contact,
  address: c.address, city: c.city, area: c.area, hours: c.hours, services: c.services ?? [],
  logo: c.logo, photos: c.photos ?? [], documents: includeDocuments ? c.documents ?? [] : [], status: c.status,
  reviewReason: c.review_reason, available: c.available, active: c.active, version: c.version,
  createdAt: c.created_at,
});
const memberDto = (m: Member & { name?: string | null }) => ({
  id: m.id, companyId: m.company_id, userId: m.user_id, role: m.role, active: m.active,
  name: m.name?.trim() || "MASAR partner",
});
const jobDto = (j: Job, reveal: boolean) => ({
  id: j.id, companyId: j.company_id, requestId: j.request_id, service: j.service,
  location: j.location, destination: j.destination, vehicleMake: j.vehicle_make,
  vehiclePlate: reveal ? j.vehicle_plate : "", customerName: reveal ? j.customer_name : "",
  customerPhone: reveal ? j.customer_phone : "", notes: reveal ? j.notes : "",
  status: j.status, offeredAt: j.offered_at, expiresAt: j.expires_at,
  acceptedAt: j.accepted_at, updatedAt: j.updated_at, version: j.version, workerId: j.worker_id,
});
const statusError = (e: unknown) => e instanceof Error && e.message.startsWith("HTTP:") ? Number(e.message.split(":")[1]) : 503;
const fail = (res: Response, e: unknown, message = "Partner service temporarily unavailable") => {
  if (e instanceof Error && e.message.startsWith("HTTP:")) return error(res, statusError(e), e.message.split(":").slice(2).join(":").trim());
  logger.error({ err: e }, message);
  return error(res, 503, message);
};
function reject(status: number, message: string): never { throw new Error(`HTTP:${status}:${message}`); }

async function actorId(req: Request, res: Response): Promise<string | null> {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { error(res, 401, "Sign in required"); return null; }
    return auth.userId;
  } catch {
    error(res, 503, "Authentication service temporarily unavailable");
    return null;
  }
}
async function clerkUser(id: string) {
  try { return await clerkClient.users.getUser(id); }
  catch (e) {
    if (typeof e === "object" && e !== null && "status" in e && e.status === 404) return null;
    throw e;
  }
}
async function admin(id: string): Promise<boolean> {
  const user = await clerkUser(id);
  return user?.privateMetadata.dispatchOperator === true;
}
async function membership(id: string, companyId: string): Promise<Member | null> {
  const result = await pool.query<Member>(
    "SELECT id,company_id,user_id,role,active FROM partner_members WHERE user_id=$1 AND company_id=$2 AND active=true",
    [id, companyId],
  );
  return result.rows[0] ?? null;
}
async function company(id: string): Promise<Company | null> {
  const result = await pool.query<Company>("SELECT * FROM partner_companies WHERE id=$1", [id]);
  return result.rows[0] ?? null;
}
function needRole(m: Member | null, roles: Role[]): asserts m is Member {
  if (!m || !roles.includes(m.role)) reject(403, "Company role access required");
}
async function tx<T>(work: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally { client.release(); }
}
async function audit(client: DbClient, companyId: string | null, requestId: string | null, actor: string, action: string, details?: unknown) {
  await auditPartner(client, { companyId, requestId, actorId: actor, action, details });
}
async function lockedJob(client: DbClient, jobId: string): Promise<Job | null> {
  const result = await client.query<Job>("SELECT * FROM partner_jobs WHERE id=$1 FOR UPDATE", [jobId]);
  return result.rows[0] ?? null;
}
async function notifyPartnerTeam(client: DbClient, companyId: string, jobId: string, event: string, workerId?: string | null) {
  const members = await client.query<{ user_id: string; role: Role }>(
    "SELECT user_id,role FROM partner_members WHERE company_id=$1 AND active=true AND role IN ('owner','planner','worker')",
    [companyId],
  );
  for (const member of members.rows) {
    if (member.role === "owner" || member.role === "planner" || (member.role === "worker" && member.user_id === workerId)) {
      await enqueuePartnerPush(client, member.user_id, jobId, event);
    }
  }
}
async function companyWithMember(id: string, companyId: string, roles: Role[]) {
  const c = await company(companyId);
  if (!c) reject(404, "Company not found");
  const m = await membership(id, companyId);
  needRole(m, roles);
  return { c, m };
}
async function jobAccess(id: string, jobId: string, roles: Role[] = ["owner", "planner", "worker"]) {
  const result = await pool.query<Job>("SELECT * FROM partner_jobs WHERE id=$1", [jobId]);
  const j = result.rows[0];
  if (!j) reject(404, "Job not found");
  const m = await membership(id, j.company_id);
  needRole(m, roles);
  if (!canWorkerSeeJob({ role: m.role, workerId: j.worker_id, userId: id, status: j.status })) reject(403, "Workers may access only their accepted assigned jobs");
  return { j, m };
}

// All auth and database failures are surfaced as explicit 503 responses; health remains mounted separately.
router.use((req, res, next) => {
  if (!process.env.DATABASE_URL) { error(res, 503, "Partner database is not configured"); return; }
  if ((!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY)
      && !(req.method === "GET" && (req.path === "/partners/public" || req.path.startsWith("/partners/public/")))) {
    error(res, 503, "Clerk authentication is not configured"); return;
  }
  next();
});

router.get("/partners/me", async (req, res) => {
  try {
    const id = await actorId(req, res); if (!id) return;
    const user = await clerkUser(id);
    if (!user) return error(res, 503, "Unable to verify Clerk identity");
    const [companies, memberships] = await Promise.all([
      pool.query<Company>("SELECT c.* FROM partner_companies c JOIN partner_members m ON m.company_id=c.id WHERE m.user_id=$1 AND m.active=true ORDER BY c.created_at DESC", [id]),
      pool.query<Member>("SELECT * FROM partner_members WHERE user_id=$1 AND active=true ORDER BY created_at", [id]),
    ]);
    // Clerk names are fetched only for the signed-in identity. Team member names come from their Clerk accounts.
    const rows = await Promise.all(memberships.rows.map(async (m) => {
      const memberUser = m.user_id === id ? user : await clerkUser(m.user_id);
      return memberDto({ ...m, name: [memberUser?.firstName, memberUser?.lastName].filter(Boolean).join(" ") });
    }));
    res.json(GetPartnerIdentityResponse.parse({
      userId: id, operator: user.privateMetadata.dispatchOperator === true,
      companies: companies.rows.map(c => companyDto(c)), memberships: rows,
    }));
  } catch (e) { fail(res, e); }
});

router.post("/partners/companies", async (req, res) => {
  try {
    const ownerId = await actorId(req, res); if (!ownerId) return;
    const body = RegisterPartnerCompanyBody.safeParse(req.body);
    if (!body.success || !body.data.name.trim() || body.data.services.length === 0) return error(res, 400, "Invalid company details");
    const value = body.data;
    const inserted = await tx(async (client) => {
      const id = randomUUID();
      const result = await client.query<Company>(
        `INSERT INTO partner_companies
         (id,owner_id,name,type,phone,contact,address,city,area,hours,services,status,available,active,version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',false,true,0) RETURNING *`,
        [id, ownerId, value.name.trim(), value.type, value.phone.trim(), value.contact.trim(), value.address.trim(),
          value.city.trim(), value.area.trim(), value.hours.trim(), JSON.stringify([...new Set(value.services.map(x => x.trim()))])],
      );
      await client.query("INSERT INTO partner_members (id,company_id,user_id,role,active) VALUES ($1,$2,$3,'owner',true)", [randomUUID(), id, ownerId]);
      await audit(client, id, null, ownerId, "company_registered");
      return result.rows[0];
    });
    res.status(201).json(RegisterPartnerCompanyResponse.parse(companyDto(inserted, true)));
  } catch (e) { fail(res, e); }
});

router.get("/partners/companies/:companyId", async (req, res) => {
  try {
    const id = await actorId(req, res); if (!id) return;
    const { c, m } = await companyWithMember(id, String(req.params.companyId), ["owner", "planner", "worker"]);
    res.json(GetPartnerCompanyResponse.parse(companyDto(c, m.role === "owner")));
  } catch (e) { fail(res, e); }
});
router.patch("/partners/companies/:companyId", async (req, res) => {
  try {
    const id = await actorId(req, res); if (!id) return;
    const parsed = UpdatePartnerCompanyBody.safeParse(req.body);
    if (!parsed.success || parsed.data.expectedVersion === undefined) return error(res, 400, "Company expectedVersion is required");
    const { c } = await companyWithMember(id, String(req.params.companyId), ["owner"]);
    const b = parsed.data;
    const changedIdentity = c.name !== b.name.trim() || c.type !== b.type || c.phone !== b.phone.trim()
      || c.contact !== b.contact.trim() || c.address !== b.address.trim() || c.city !== b.city.trim()
      || c.area !== b.area.trim() || JSON.stringify(c.services) !== JSON.stringify([...new Set(b.services.map(x => x.trim()))]);
    const updated = await tx(async client => {
      const result = await client.query<Company>(
        `UPDATE partner_companies SET name=$1,type=$2,phone=$3,contact=$4,address=$5,city=$6,area=$7,hours=$8,services=$9::jsonb,
         status=CASE WHEN status='approved' AND $10 THEN 'pending' ELSE status END,
         review_reason=CASE WHEN status='approved' AND $10 THEN NULL ELSE review_reason END,
         available=CASE WHEN status='approved' AND $10 THEN false ELSE available END,version=version+1
         WHERE id=$11 AND version=$12 RETURNING *`,
        [b.name.trim(), b.type, b.phone.trim(), b.contact.trim(), b.address.trim(), b.city.trim(), b.area.trim(),
          b.hours.trim(), JSON.stringify([...new Set(b.services.map(x => x.trim()))]), changedIdentity,
          c.id, b.expectedVersion],
      );
      if (!result.rows[0]) reject(409, "Company version conflict");
      await audit(client, c.id, null, id, "company_updated", { reReview: changedIdentity });
      return result.rows[0];
    });
    res.json(UpdatePartnerCompanyResponse.parse(companyDto(updated, true)));
  } catch (e) { fail(res, e); }
});
router.put("/partners/companies/:companyId/availability", async (req, res) => {
  try {
    const id = await actorId(req, res); if (!id) return;
    const body = SetPartnerAvailabilityBody.safeParse(req.body);
    if (!body.success) return error(res, 400, "Invalid availability update");
    const { c, m } = await companyWithMember(id, String(req.params.companyId), ["owner", "planner"]);
    const result = await tx(async client => {
      const current = await client.query<Company>("SELECT * FROM partner_companies WHERE id=$1 FOR UPDATE", [c.id]);
      if (!current.rows[0]) reject(404, "Company not found");
      if (current.rows[0].version !== body.data.expectedVersion) reject(409, "Company version conflict");
      const updated = await client.query<Company>(
        "UPDATE partner_companies SET available=$1,version=version+1 WHERE id=$2 RETURNING *",
        [body.data.available && current.rows[0].status === "approved" && current.rows[0].active, c.id],
      );
      await audit(client, c.id, null, id, "availability_updated", { available: updated.rows[0].available });
      return updated.rows[0];
    });
    res.json(SetPartnerAvailabilityResponse.parse(companyDto(result, m.role === "owner")));
  } catch (e) { fail(res, e); }
});

router.get("/partners/companies/:companyId/members", async (req, res) => {
  try {
    const id = await actorId(req, res); if (!id) return;
    await companyWithMember(id, String(req.params.companyId), ["owner", "planner"]);
    const result = await pool.query<Member>("SELECT * FROM partner_members WHERE company_id=$1 ORDER BY created_at", [req.params.companyId]);
    const rows = await Promise.all(result.rows.map(async m => {
      const u = await clerkUser(m.user_id);
      return memberDto({ ...m, name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") });
    }));
    res.json(ListPartnerMembersResponse.parse(rows));
  } catch (e) { fail(res, e); }
});
router.post("/partners/companies/:companyId/members", async (req, res) => {
  try {
    const actor = await actorId(req, res); if (!actor) return;
    const body = AddPartnerMemberBody.safeParse(req.body);
    if (!body.success || body.data.userId === actor) return error(res, 400, "Add an existing other Clerk user as planner or worker");
    const { c } = await companyWithMember(actor, String(req.params.companyId), ["owner"]);
    const target = await clerkUser(body.data.userId);
    if (!target) return error(res, 404, "Existing Clerk user not found");
    const row = await tx(async client => {
      const result = await client.query<Member>(
        "INSERT INTO partner_members (id,company_id,user_id,role,active) VALUES ($1,$2,$3,$4,true) ON CONFLICT DO NOTHING RETURNING *",
        [randomUUID(), c.id, body.data.userId, body.data.role],
      );
      if (!result.rows[0]) reject(409, "User is already a company member");
      await audit(client, c.id, null, actor, "member_added", { role: body.data.role });
      return result.rows[0];
    });
    res.status(201).json(AddPartnerMemberResponse.parse(memberDto({ ...row, name: [target.firstName, target.lastName].filter(Boolean).join(" ") })));
  } catch (e) { fail(res, e); }
});
router.patch("/partners/companies/:companyId/members/:memberId", async (req, res) => {
  try {
    const actor = await actorId(req, res); if (!actor) return;
    const body = UpdatePartnerMemberBody.safeParse(req.body);
    if (!body.success) return error(res, 400, "Invalid member update");
    const { c } = await companyWithMember(actor, String(req.params.companyId), ["owner"]);
    const memberId = String(req.params.memberId);
    const result = await tx(async client => {
      const selected = await client.query<Member>("SELECT * FROM partner_members WHERE id=$1 AND company_id=$2 FOR UPDATE", [memberId, c.id]);
      const target = selected.rows[0];
      if (!target) reject(404, "Member not found");
      if (target.role === "owner" || target.user_id === c.owner_id) reject(409, "Company owner cannot be removed or changed");
      if (!body.data.active && target.role === "worker") {
        const busy = await client.query("SELECT 1 FROM partner_jobs WHERE company_id=$1 AND worker_id=$2 AND status IN ('accepted','enroute','arrived')", [c.id, target.user_id]);
        if (busy.rowCount) reject(409, "Worker has an active job and cannot be deactivated");
      }
      const updated = await client.query<Member>(
        "UPDATE partner_members SET role=$1,active=$2 WHERE id=$3 AND company_id=$4 RETURNING *",
        [body.data.role, body.data.active, memberId, c.id],
      );
      await audit(client, c.id, null, actor, "member_updated", { memberId, active: body.data.active, role: body.data.role });
      return updated.rows[0];
    });
    const u = await clerkUser(result.user_id);
    res.json(UpdatePartnerMemberResponse.parse(memberDto({ ...result, name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") })));
  } catch (e) { fail(res, e); }
});

router.get("/partners/companies/:companyId/jobs", async (req, res) => {
  try {
    const id = await actorId(req, res); if (!id) return;
    const { m } = await companyWithMember(id, String(req.params.companyId), ["owner", "planner", "worker"]);
    await expirePartnerOffers();
    const query = m.role === "worker"
      ? await pool.query<Job>("SELECT * FROM partner_jobs WHERE company_id=$1 AND worker_id=$2 AND status IN ('accepted','enroute','arrived','completed','unavailable') ORDER BY updated_at DESC", [m.company_id, id])
      : await pool.query<Job>("SELECT * FROM partner_jobs WHERE company_id=$1 ORDER BY updated_at DESC", [m.company_id]);
    res.json(ListPartnerJobsResponse.parse(query.rows.map(j => jobDto(j, j.status !== "offered" && !!j.accepted_at))));
  } catch (e) { fail(res, e); }
});
router.get("/partners/jobs/:jobId", async (req, res) => {
  try {
    const id = await actorId(req, res); if (!id) return;
    await expirePartnerOffers();
    const { j } = await jobAccess(id, String(req.params.jobId));
    res.json(GetPartnerJobResponse.parse(jobDto(j, !!j.accepted_at)));
  } catch (e) { fail(res, e); }
});
router.post("/partners/jobs/:jobId/response", async (req, res) => {
  try {
    const actor = await actorId(req, res); if (!actor) return;
    const body = RespondPartnerOfferBody.safeParse(req.body);
    if (!body.success) return error(res, 400, "Invalid offer decision");
    const result = await tx(async client => {
      const j = await lockedJob(client, String(req.params.jobId));
      if (!j) reject(404, "Job not found");
      const memberResult = await client.query<Member>(
        "SELECT id,company_id,user_id,role,active FROM partner_members WHERE user_id=$1 AND company_id=$2 AND active=true FOR UPDATE",
        [actor, j.company_id],
      );
      const m = memberResult.rows[0] ?? null;
      needRole(m, ["owner", "planner"]);
      if (j.status === "accepted" && body.data.decision === "accept" && j.accepted_at
          && j.accepted_by_id === actor) return j;
      if (j.status !== "offered" || j.version !== body.data.expectedVersion || j.expires_at <= new Date()) reject(409, "Offer expired or changed");
      const request = await client.query<{ id: string; status: string; provider_id: string | null }>(
        "SELECT id,status,provider_id FROM roadside_requests WHERE id=$1 FOR UPDATE",
        [j.request_id],
      );
      const central = request.rows[0];
      if (!central || central.status !== "offered" || central.provider_id !== `partner:${j.company_id}`) reject(409, "Central request is no longer available");
      if (body.data.decision === "accept") {
        const companyResult = await client.query<Company>("SELECT * FROM partner_companies WHERE id=$1 FOR UPDATE", [j.company_id]);
        const currentCompany = companyResult.rows[0];
        if (!currentCompany || currentCompany.status !== "approved" || !currentCompany.active) reject(409, "Company is no longer approved to accept offers");
      }
      const next = body.data.decision === "accept" ? "accepted" : "declined";
      const now = new Date();
      const updated = await client.query<Job>(
        "UPDATE partner_jobs SET status=$1,accepted_at=$2,accepted_by_id=$3,updated_at=$4,version=version+1 WHERE id=$5 RETURNING *",
        [next, next === "accepted" ? now : null, next === "accepted" ? actor : null, now, j.id],
      );
      if (next === "accepted") {
        const changedCentral = await client.query(
          "UPDATE roadside_requests SET status='accepted',provider_id=('partner:'||$1),provider_name=(SELECT name FROM partner_companies WHERE id=$1),provider_acknowledged_at=$2,updated_at=$2 WHERE id=$3 AND status='offered' AND provider_id=('partner:'||$1)",
          [j.company_id, now, j.request_id],
        );
        if (!changedCentral.rowCount) reject(409, "Central request is no longer available");
        await notifyPartnerTeam(client, j.company_id, j.id, "accepted", j.worker_id);
      } else {
        const changedCentral = await client.query(
          `UPDATE roadside_requests SET status='pending',provider_id=NULL,provider_name=NULL,
           provider_acknowledged_at=NULL,offered_at=NULL,status_note='Partner declined; awaiting dispatch.',updated_at=$1
           WHERE id=$2 AND status='offered' AND provider_id=$3`,
          [now, j.request_id, `partner:${j.company_id}`],
        );
        if (!changedCentral.rowCount) reject(409, "Central request is no longer available");
      }
      await audit(client, j.company_id, j.request_id, actor, next === "accepted" ? "offer_accepted" : "offer_declined", { jobId: j.id });
      return updated.rows[0];
    });
    res.json(RespondPartnerOfferResponse.parse(jobDto(result, result.status === "accepted")));
  } catch (e) { fail(res, e); }
});
router.patch("/partners/jobs/:jobId", async (req, res) => {
  try {
    const actor = await actorId(req, res); if (!actor) return;
    const body = UpdatePartnerJobBody.safeParse(req.body);
    if (!body.success) return error(res, 400, "Invalid job update");
    const outcome = await tx(async client => {
      const j = await lockedJob(client, String(req.params.jobId));
      if (!j) reject(404, "Job not found");
      const memberResult = await client.query<Member>(
        "SELECT id,company_id,user_id,role,active FROM partner_members WHERE user_id=$1 AND company_id=$2 AND active=true FOR UPDATE",
        [actor, j.company_id],
      );
      const m = memberResult.rows[0] ?? null;
      needRole(m, ["owner", "planner", "worker"]);
      if (!isFreshVersion(j.version, body.data.expectedVersion)) reject(409, "Job version conflict");
      if (m.role === "worker" && (j.worker_id !== actor || !["accepted", "enroute", "arrived"].includes(j.status))) reject(403, "Workers may update only their accepted assigned jobs");
      if (j.status === "offered" && !body.data.workerId) reject(409, "An offer must be accepted before its status can be updated");
      const nextStatus = body.data.status;
      const assigningOnly = !!body.data.workerId && nextStatus === j.status;
      if (!assigningOnly && !canTransitionPartnerJob(j.status, nextStatus, j.service)) reject(409, "Invalid job status transition");
      if (body.data.workerId && m.role === "worker") reject(403, "Workers cannot assign jobs");
      let workerId = j.worker_id;
      if (body.data.workerId) {
        if (!canAssignWorker({ status: j.status, acceptedAt: j.accepted_at, currentWorkerId: j.worker_id, nextWorkerId: body.data.workerId })) reject(409, "Worker assignment is no longer available");
        const target = await client.query<Member>("SELECT * FROM partner_members WHERE company_id=$1 AND user_id=$2 AND active=true AND role='worker' FOR UPDATE", [j.company_id, body.data.workerId]);
        if (!target.rows[0]) reject(404, "Active company worker not found");
        workerId = body.data.workerId;
      }
      if (nextStatus === "unavailable" && !body.data.note?.trim()) reject(400, "A reason is required when service is unavailable");
      if (m.role === "worker" && j.worker_id !== actor) reject(403, "Job is not assigned to this worker");
      const central = await client.query<{ status: string; replacement_transport: boolean; transport_status: string }>(
        "SELECT status,replacement_transport,transport_status FROM roadside_requests WHERE id=$1 FOR UPDATE",
        [j.request_id],
      );
      if (!central.rows[0] || central.rows[0].status !== j.status) reject(409, "Central request status changed; refresh the job");
      if (!assigningOnly && nextStatus === "completed" && central.rows[0].replacement_transport
          && central.rows[0].transport_status === "pending") reject(409, "Dispatch must confirm or decline replacement transport before completion");
      const updatedAt = new Date();
      const updated = await client.query<Job>(
        "UPDATE partner_jobs SET status=$1,worker_id=$2,updated_at=$3,version=version+1 WHERE id=$4 RETURNING *",
        [assigningOnly ? j.status : nextStatus, workerId, updatedAt, j.id],
      );
      const mapped = nextStatus === "unavailable" ? "unavailable" : assigningOnly ? j.status : nextStatus;
      await client.query(
        `UPDATE roadside_requests SET status=$1,status_note=$2,provider_id=('partner:'||$3),provider_name=(SELECT name FROM partner_companies WHERE id=$3),
         provider_acknowledged_at=COALESCE(provider_acknowledged_at,$4),updated_at=$4 WHERE id=$5`,
        [mapped, nextStatus === "unavailable" ? body.data.note!.trim() : body.data.note?.trim() || null, j.company_id, updatedAt, j.request_id],
      );
      await audit(client, j.company_id, j.request_id, actor, assigningOnly ? "worker_assigned" : "job_status_updated", {
        jobId: j.id, status: mapped, workerId, note: body.data.note?.trim(),
      });
      await notifyPartnerTeam(client, j.company_id, j.id, mapped, workerId);
      return updated.rows[0];
    });
    res.json(UpdatePartnerJobResponse.parse(jobDto(outcome, !!outcome.accepted_at)));
  } catch (e) { fail(res, e); }
});

router.post("/partners/devices", async (req, res) => {
  try {
    const id = await actorId(req, res); if (!id) return;
    const body = RegisterPartnerDeviceBody.safeParse(req.body);
    if (!body.success || !isExpoToken(body.data.token)) return error(res, 400, "Valid Expo push token required");
    const member = await pool.query("SELECT 1 FROM partner_members WHERE user_id=$1 AND active=true LIMIT 1", [id]);
    if (!member.rowCount) return error(res, 403, "Active partner membership required");
    await tx(async client => {
      const inserted = await client.query(
        `INSERT INTO partner_devices (token,user_id,platform,active) VALUES ($1,$2,$3,true)
         ON CONFLICT (token) DO UPDATE SET platform=EXCLUDED.platform,active=true
         WHERE partner_devices.user_id=EXCLUDED.user_id RETURNING token`,
        [body.data.token, id, body.data.platform],
      );
      if (!inserted.rowCount) reject(409, "Device token is already registered to another user");
      await audit(client, null, null, id, "device_registered");
    });
    res.json(RegisterPartnerDeviceResponse.parse({ ok: true }));
  } catch (e) { fail(res, e, "Device service temporarily unavailable"); }
});
router.delete("/partners/devices", async (req, res) => {
  try {
    const id = await actorId(req, res); if (!id) return;
    const body = RemovePartnerDeviceBody.safeParse(req.body);
    if (!body.success || !isExpoToken(body.data.token)) return error(res, 400, "Valid Expo push token required");
    await tx(async client => {
      await client.query("DELETE FROM partner_devices WHERE token=$1 AND user_id=$2", [body.data.token, id]);
      await audit(client, null, null, id, "device_removed");
    });
    res.json(RemovePartnerDeviceResponse.parse({ ok: true }));
  } catch (e) { fail(res, e, "Device service temporarily unavailable"); }
});

router.get("/partners/admin/companies", async (req, res) => {
  try {
    const id = await actorId(req, res); if (!id) return;
    if (!await admin(id)) return error(res, 403, "Partner administrator access required");
    const result = await pool.query<Company>("SELECT * FROM partner_companies ORDER BY created_at");
    res.json(ListPartnerReviewsResponse.parse(result.rows.map(c => companyDto(c, true))));
  } catch (e) { fail(res, e); }
});
router.post("/partners/admin/companies/:companyId/review", async (req, res) => {
  try {
    const actor = await actorId(req, res); if (!actor) return;
    if (!await admin(actor)) return error(res, 403, "Partner administrator access required");
    const body = ReviewPartnerCompanyBody.safeParse(req.body);
    if (!body.success) return error(res, 400, "Invalid review decision");
    const result = await tx(async client => {
      const updated = await client.query<Company>(
        `UPDATE partner_companies SET status=$1,review_reason=NULLIF($2,''),
         available=CASE WHEN $1='approved' THEN available ELSE false END,version=version+1
         WHERE id=$3 AND version=$4 RETURNING *`,
        [body.data.status, body.data.reason.trim(), req.params.companyId, body.data.expectedVersion],
      );
      if (!updated.rows[0]) {
        const exists = await client.query("SELECT 1 FROM partner_companies WHERE id=$1", [req.params.companyId]);
        if (!exists.rowCount) reject(404, "Company not found");
        reject(409, "Company version conflict");
      }
      await audit(client, updated.rows[0].id, null, actor, "company_reviewed", { status: body.data.status, reason: body.data.reason.trim() });
      return updated.rows[0];
    });
    res.json(ReviewPartnerCompanyResponse.parse(companyDto(result, true)));
  } catch (e) { fail(res, e); }
});
router.get("/partners/admin/requests/:requestId/eligible", async (req, res) => {
  try {
    const actor = await actorId(req, res); if (!actor) return;
    if (!await admin(actor)) return error(res, 403, "Partner administrator access required");
    const reqRow = await pool.query("SELECT service,location FROM roadside_requests WHERE id=$1", [req.params.requestId]);
    if (!reqRow.rows[0]) return error(res, 404, "Request not found");
    const companies = await pool.query<Company>("SELECT * FROM partner_companies WHERE status='approved' AND active=true AND available=true ORDER BY name");
      res.json(ListEligiblePartnerCompaniesResponse.parse(companies.rows.filter(c => isEligiblePartner(c, reqRow.rows[0].service, companySupportsService)).map(c => companyDto(c, true))));
  } catch (e) { fail(res, e); }
});
router.post("/partners/admin/requests/:requestId/offer", async (req, res) => {
  try {
    const actor = await actorId(req, res); if (!actor) return;
    if (!await admin(actor)) return error(res, 403, "Partner administrator access required");
    const body = OfferPartnerJobBody.safeParse(req.body);
    if (!body.success || !isUuid(String(req.params.requestId))) return error(res, 400, "Invalid offer details");
    const result = await tx(async client => {
      const request = await client.query<any>("SELECT * FROM roadside_requests WHERE id=$1 FOR UPDATE", [req.params.requestId]);
      const r = request.rows[0];
      if (!r) reject(404, "Request not found");
      if (new Date(r.updated_at).getTime() !== body.data.expectedUpdatedAt.getTime()) reject(409, "Request changed; refresh dispatch");
      if (r.status !== "pending" || (r.operator_id && r.operator_id !== actor)) reject(409, "Request is no longer available to this operator");
      const companyResult = await client.query<Company>("SELECT * FROM partner_companies WHERE id=$1 FOR UPDATE", [body.data.companyId]);
      const c = companyResult.rows[0];
      if (!c) reject(404, "Company not found");
      if (!isEligiblePartner(c, r.service, companySupportsService)) reject(409, "Company is not currently eligible for this service");
      if (Number(body.data.expiresInSeconds) > 3600) reject(400, "Offer expiry cannot exceed one hour");
      const legacy = await client.query("SELECT 1 FROM roadside_requests WHERE id=$1 AND provider_acknowledged_at IS NOT NULL", [r.id]);
      if (legacy.rowCount) reject(409, "Request already accepted by an individual provider");
      const now = new Date();
      const expiry = new Date(now.getTime() + body.data.expiresInSeconds * 1000);
      const jobId = randomUUID();
      const job = await client.query<Job>(
        `INSERT INTO partner_jobs (id,company_id,request_id,service,location,destination,vehicle_make,vehicle_plate,customer_name,customer_phone,notes,status,offered_at,expires_at,updated_at,version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'offered',$12,$13,$12,0) RETURNING *`,
        [jobId, c.id, r.id, r.service, r.location, r.destination, r.vehicle_make, r.vehicle_plate, r.customer_name, r.customer_phone, r.notes, now, expiry],
      );
      await client.query(
        `UPDATE roadside_requests SET status='offered',operator_id=COALESCE(operator_id,$1),operator_name=COALESCE(operator_name,$2),
         provider_id=('partner:'||$6),provider_name=$3,offered_at=$4,provider_acknowledged_at=NULL,updated_at=$4 WHERE id=$5`,
        [actor, "MASAR operator", c.name, now, r.id, c.id],
      );
      await notifyPartnerTeam(client, c.id, jobId, "offer");
      await audit(client, c.id, r.id, actor, "job_offered", { jobId, expiresAt: expiry.toISOString() });
      return job.rows[0];
    });
    res.status(201).json(OfferPartnerJobResponse.parse(jobDto(result, false)));
  } catch (e) { fail(res, e); }
});
router.get("/partners/admin/audit", async (req, res) => {
  try {
    const id = await actorId(req, res); if (!id) return;
    if (!await admin(id)) return error(res, 403, "Partner administrator access required");
    const result = await pool.query("SELECT id,company_id,request_id,actor_id,action,details,created_at FROM partner_audit ORDER BY created_at DESC LIMIT 500");
    res.json(ListPartnerAuditResponse.parse(result.rows.map(r => ({
      id: r.id, companyId: r.company_id, requestId: r.request_id, actorId: r.actor_id,
      action: r.action, details: r.details, createdAt: r.created_at,
    }))));
  } catch (e) { fail(res, e); }
});
router.get("/partners/public", async (_req, res) => {
  try {
    const result = await pool.query<Company>("SELECT * FROM partner_companies WHERE status='approved' AND active=true ORDER BY name");
    const sanitized = result.rows.map(c => ({
      ...companyDto(c), ownerId: "redacted", contact: "",
      documents: [], reviewReason: null,
    }));
    res.json(ListPublicPartnersResponse.parse(sanitized));
  } catch (e) { fail(res, e); }
});
router.get("/partners/public/:companyId/assets/:assetId", async (req, res) => {
  try {
    const c = await company(String(req.params.companyId));
    if (!c || c.status !== "approved" || !c.active) return error(res, 404, "Public partner asset not found");
    const assetId = String(req.params.assetId);
    if (!c.photos.includes(assetId) && c.logo !== assetId) return error(res, 404, "Public partner asset not found");
    const record = await pool.query("SELECT object_path FROM partner_uploads WHERE id=$1 AND company_id=$2 AND confirmed=true AND kind IN ('photo','logo')", [assetId, c.id]);
    if (!record.rows[0]) return error(res, 404, "Public partner asset not found");
    res.json(GetPartnerAssetResponse.parse({ url: await signedPartnerRead(record.rows[0].object_path) }));
  } catch (e) { fail(res, e, "Asset service temporarily unavailable"); }
});

router.post("/partners/companies/:companyId/uploads", async (req, res) => {
  try {
    const actor = await actorId(req, res); if (!actor) return;
    const body = GetPartnerUploadBody.safeParse(req.body);
    if (!body.success) return error(res, 400, "Invalid upload metadata");
    const { c } = await companyWithMember(actor, String(req.params.companyId), ["owner"]);
    const { kind, contentType, filename } = body.data;
    const allowed = kind === "document"
      ? ["application/pdf", "image/jpeg", "image/png", "image/webp"]
      : ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(contentType.toLowerCase())) return error(res, 400, "Unsupported file type");
    const objectPath = newPartnerObjectPath();
    const uploadUrl = await signedPartnerUpload(objectPath, contentType);
    await tx(async client => {
      await client.query("INSERT INTO partner_uploads (id,company_id,owner_id,kind,object_path,filename,content_type) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [randomUUID(), c.id, actor, kind, objectPath, filename, contentType]);
      await audit(client, c.id, null, actor, "company_upload_requested", { kind });
    });
    res.json(GetPartnerUploadResponse.parse({ uploadUrl, objectPath }));
  } catch (e) { fail(res, e, "Upload service temporarily unavailable"); }
});
router.post("/partners/companies/:companyId/uploads/confirm", async (req, res) => {
  try {
    const actor = await actorId(req, res); if (!actor) return;
    const body = ConfirmPartnerUploadBody.safeParse(req.body);
    if (!body.success || !body.data.objectPath.startsWith("/objects/uploads/partners/")) return error(res, 400, "Invalid uploaded object");
    const { c } = await companyWithMember(actor, String(req.params.companyId), ["owner"]);
    const row = await pool.query("SELECT * FROM partner_uploads WHERE company_id=$1 AND owner_id=$2 AND object_path=$3 AND kind=$4 AND confirmed=false",
      [c.id, actor, body.data.objectPath, body.data.kind]);
    const upload = row.rows[0];
    if (!upload) return error(res, 404, "Pending company upload not found");
    const inspected = await inspectPartnerObject(upload.object_path);
    if (!inspected.exists) return error(res, 404, "Uploaded object not found");
    const limit = upload.kind === "document" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (!inspected.size || inspected.size > limit || inspected.contentType.toLowerCase() !== upload.content_type.toLowerCase()) return error(res, 400, "Uploaded file size or content type is invalid");
    const result = await tx(async client => {
      const pending = await client.query(
        "SELECT id FROM partner_uploads WHERE id=$1 AND company_id=$2 AND owner_id=$3 AND confirmed=false FOR UPDATE",
        [upload.id, c.id, actor],
      );
      if (!pending.rows[0]) reject(409, "Upload has already been confirmed");
      const current = await client.query<Company>("SELECT * FROM partner_companies WHERE id=$1 FOR UPDATE", [c.id]);
      const companyRow = current.rows[0];
      if (!companyRow) reject(404, "Company not found");
      if (upload.kind === "photo" && companyRow.photos.length >= 10) reject(409, "Company photo limit reached");
      if (upload.kind === "document" && companyRow.documents.length >= 10) reject(409, "Company document limit reached");
      const setSql = upload.kind === "logo"
        ? "logo=$2"
        : upload.kind === "photo" ? "photos=photos || jsonb_build_array($2::text)" : "documents=documents || jsonb_build_array($2::text)";
      const updated = await client.query<Company>(`UPDATE partner_companies SET ${setSql},version=version+1 WHERE id=$1 RETURNING *`, [c.id, upload.id]);
      await client.query("UPDATE partner_uploads SET confirmed=true WHERE id=$1", [upload.id]);
      await audit(client, c.id, null, actor, "company_asset_added", { kind: upload.kind });
      return updated.rows[0];
    });
    res.json(ConfirmPartnerUploadResponse.parse(companyDto(result, true)));
  } catch (e) { fail(res, e, "Upload service temporarily unavailable"); }
});
router.get("/partners/companies/:companyId/assets/:assetId", async (req, res) => {
  try {
    const actor = await actorId(req, res); if (!actor) return;
    const c = await company(String(req.params.companyId));
    if (!c) return error(res, 404, "Company not found");
    const assetId = String(req.params.assetId);
    const isDocument = c.documents.includes(assetId);
    const isPhoto = c.photos.includes(assetId) || c.logo === assetId;
    if (!isDocument && !isPhoto) return error(res, 404, "Company asset not found");
    if (isDocument) {
      const m = await membership(actor, c.id);
      if (!m || (m.role !== "owner" && !await admin(actor))) return error(res, 403, "Private company document access required");
    } else if (!(c.status === "approved" && c.active)) {
      const m = await membership(actor, c.id);
      if (!m && !await admin(actor)) return error(res, 403, "Company asset access required");
    }
    const record = await pool.query("SELECT object_path FROM partner_uploads WHERE id=$1 AND company_id=$2 AND confirmed=true", [assetId, c.id]);
    if (!record.rows[0]) return error(res, 404, "Company asset not found");
    res.json(GetPartnerAssetResponse.parse({ url: await signedPartnerRead(record.rows[0].object_path) }));
  } catch (e) { fail(res, e, "Asset service temporarily unavailable"); }
});

export async function expirePartnerOffers(): Promise<void> {
  await tx(async client => {
    const expired = await client.query<Job>(
      `SELECT * FROM partner_jobs WHERE status='offered' AND expires_at<=now() ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED`,
    );
    for (const job of expired.rows) {
      const central = await client.query<{ id: string; status: string; provider_id: string | null }>(
        "SELECT id,status,provider_id FROM roadside_requests WHERE id=$1 FOR UPDATE",
        [job.request_id],
      );
      if (!central.rows[0] || central.rows[0].status !== "offered" || central.rows[0].provider_id !== `partner:${job.company_id}`) continue;
      await client.query("UPDATE partner_jobs SET status='expired',updated_at=now(),version=version+1 WHERE id=$1 AND status='offered'", [job.id]);
      await client.query(
        `UPDATE roadside_requests SET status='pending',provider_id=NULL,provider_name=NULL,
         provider_acknowledged_at=NULL,offered_at=NULL,status_note='Partner offer expired; awaiting dispatch.',updated_at=now()
         WHERE id=$1 AND status='offered'`,
        [job.request_id],
      );
      await audit(client, job.company_id, job.request_id, "system", "offer_expired", { jobId: job.id });
    }
  });
}

let partnerSchedulerStarted = false;
export function startPartnerScheduler(): void {
  if (!process.env.DATABASE_URL || partnerSchedulerStarted) return;
  partnerSchedulerStarted = true;
  const timer = setInterval(() => {
    void expirePartnerOffers().catch(err => logger.error({ err }, "Partner offer expiry failed"));
    void deliverPartnerPushOutbox(pool);
  }, 15_000);
  timer.unref();
}

export default router;