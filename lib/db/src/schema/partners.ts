import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const partnerCompaniesTable = pgTable("partner_companies", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  phone: text("phone").notNull(),
  contact: text("contact").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  area: text("area").notNull(),
  hours: text("hours").notNull(),
  services: jsonb("services").$type<string[]>().notNull().default([]),
  logo: text("logo"),
  photos: jsonb("photos").$type<string[]>().notNull().default([]),
  documents: jsonb("documents").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("pending"),
  reviewReason: text("review_reason"),
  available: boolean("available").notNull().default(false),
  active: boolean("active").notNull().default(true),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const partnerMembersTable = pgTable("partner_members", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => partnerCompaniesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyUser: uniqueIndex("partner_members_company_user_idx").on(table.companyId, table.userId),
  userActive: index("partner_members_user_active_idx").on(table.userId, table.active),
}));

export const partnerJobsTable = pgTable("partner_jobs", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => partnerCompaniesTable.id),
  requestId: text("request_id").notNull().references(() => roadsideRequestsTable.id),
  service: text("service").notNull(),
  location: text("location").notNull(),
  destination: text("destination"),
  vehicleMake: text("vehicle_make").notNull(),
  vehiclePlate: text("vehicle_plate").notNull(),
  customerName: text("customer_name").notNull().default(""),
  customerPhone: text("customer_phone").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull(),
  offeredAt: timestamp("offered_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedById: text("accepted_by_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(0),
  workerId: text("worker_id"),
}, (table) => ({
  // Keep only one non-terminal partner assignment for a central request.
  activeRequest: uniqueIndex("partner_jobs_active_request_idx").on(table.requestId)
    .where(sql`${table.status} IN ('offered', 'accepted', 'enroute', 'arrived')`),
  companyStatus: index("partner_jobs_company_status_idx").on(table.companyId, table.status),
}));

export const partnerAuditTable = pgTable("partner_audit", {
  id: text("id").primaryKey(),
  companyId: text("company_id"),
  requestId: text("request_id"),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  details: text("details").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  created: index("partner_audit_created_idx").on(table.createdAt),
  request: index("partner_audit_request_idx").on(table.requestId),
}));

export const partnerUploadsTable = pgTable("partner_uploads", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => partnerCompaniesTable.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull(),
  objectPath: text("object_path").notNull().unique(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  confirmed: boolean("confirmed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const partnerDevicesTable = pgTable("partner_devices", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  platform: text("platform").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const partnerPushOutboxTable = pgTable("partner_push_outbox", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  jobId: text("job_id").notNull(),
  event: text("event").notNull(),
  attempts: integer("attempts").notNull().default(0),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  due: index("partner_push_outbox_due_idx").on(table.deliveredAt, table.nextAttemptAt),
}));

export const partnerPushDeliveriesTable = pgTable("partner_push_deliveries", {
  id: text("id").primaryKey(),
  outboxId: text("outbox_id").notNull().references(() => partnerPushOutboxTable.id, { onDelete: "cascade" }),
  deviceToken: text("device_token").notNull().references(() => partnerDevicesTable.token, { onDelete: "cascade" }),
  ticketId: text("ticket_id"),
  status: text("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
}, (table) => ({
  uniqueDeviceEvent: uniqueIndex("partner_push_deliveries_outbox_device_idx").on(table.outboxId, table.deviceToken),
  due: index("partner_push_deliveries_due_idx").on(table.status, table.nextAttemptAt),
}));

// Defined here to avoid coupling the shared schema module to route code.
import { sql } from "drizzle-orm";
import { roadsideRequestsTable } from "./membership";