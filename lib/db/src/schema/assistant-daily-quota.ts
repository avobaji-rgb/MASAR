import { createInsertSchema } from "drizzle-zod";
import { date, integer, pgTable } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const assistantDailyQuotaTable = pgTable("assistant_daily_quota", {
  day: date("day", { mode: "string" }).primaryKey(),
  used: integer("used").notNull().default(0),
});

export const insertAssistantDailyQuotaSchema = createInsertSchema(assistantDailyQuotaTable);
export type InsertAssistantDailyQuota = z.infer<typeof insertAssistantDailyQuotaSchema>;
export type AssistantDailyQuota = typeof assistantDailyQuotaTable.$inferSelect;