import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const driverProfilesTable = pgTable("driver_profiles", {
  userId: text("user_id").primaryKey(),
  name: text("name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  vehicleMake: text("vehicle_make").notNull().default(""),
  vehiclePlate: text("vehicle_plate").notNull().default(""),
  vehicleElectric: boolean("vehicle_electric").notNull().default(false),
  safetyContactName: text("safety_contact_name").notNull().default(""),
  safetyContactPhone: text("safety_contact_phone").notNull().default(""),
  completed: boolean("completed").notNull().default(false),
  language: text("language").notNull().default("en"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDriverProfileSchema = createInsertSchema(driverProfilesTable).omit({ updatedAt: true });
export type InsertDriverProfile = z.infer<typeof insertDriverProfileSchema>;
export type DriverProfile = typeof driverProfilesTable.$inferSelect;