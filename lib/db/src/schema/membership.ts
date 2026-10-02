import { boolean, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Retain the legacy mapping in the schema so existing data is never dropped by a schema push.
export const membershipCustomersTable = pgTable("membership_customers", {
  userId: text("user_id").primaryKey(),
  customerId: text("customer_id").notNull().unique(),
});

// Existing payment-provider data is left untouched; only bank-confirmed memberships are used.
export const bankMembershipsTable = pgTable("bank_memberships", {
  userId: text("user_id").primaryKey(),
  plan: text("plan").notNull(),
  billing: text("billing").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  confirmedBy: text("confirmed_by").notNull(),
});

export const registeredVehiclesTable = pgTable("registered_vehicles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  make: text("make").notNull(),
  plate: text("plate").notNull(),
  electric: boolean("electric").notNull().default(false),
});

export const roadsideRequestsTable = pgTable("roadside_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  vehicleId: text("vehicle_id").notNull(),
  customerName: text("customer_name").notNull().default(""),
  customerPhone: text("customer_phone").notNull().default(""),
  vehicleMake: text("vehicle_make").notNull().default(""),
  vehiclePlate: text("vehicle_plate").notNull().default(""),
  service: text("service").notNull(),
  location: text("location").notNull(),
  destination: text("destination"),
  garage: text("garage"),
  notes: text("notes").notNull().default(""),
  unsafe: boolean("unsafe").notNull().default(false),
  replacementTransport: boolean("replacement_transport").notNull().default(false),
  idempotencyKey: text("idempotency_key"),
  status: text("status").notNull().default("pending"),
  offeredAt: timestamp("offered_at", { withTimezone: true }),
  operatorId: text("operator_id"),
  operatorName: text("operator_name"),
  providerId: text("provider_id"),
  providerName: text("provider_name"),
  providerAcknowledgedAt: timestamp("provider_acknowledged_at", { withTimezone: true }),
  transportStatus: text("transport_status").notNull().default("not_requested"),
  statusNote: text("status_note"),
  recoveryReason: text("recovery_reason"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  roadsideRequestsUserIdempotencyIdx: uniqueIndex("roadside_requests_user_idempotency_idx").on(table.userId, table.idempotencyKey),
}));