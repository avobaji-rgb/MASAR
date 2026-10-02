import { db, bankMembershipsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type Plan = "basic" | "premium";
export type Billing = "monthly" | "annual";
export type Entitlement = {
  active: boolean; plan: Plan | null; billing: Billing | null;
  vehicleLimit: number; replacementTransport: boolean; garageChoice: boolean;
};
export const inactive: Entitlement = {
  active: false, plan: null, billing: null, vehicleLimit: 0,
  replacementTransport: false, garageChoice: false,
};

// Access is based only on an operator-confirmed bank payment that has not expired.
// A customer's own payment claim or a browser redirect can never grant access.
export async function membershipFor(userId: string): Promise<Entitlement> {
  const [membership] = await db.select().from(bankMembershipsTable).where(eq(bankMembershipsTable.userId, userId));
  if (!membership || membership.expiresAt <= new Date()) return inactive;
  if ((membership.plan !== "basic" && membership.plan !== "premium")
      || (membership.billing !== "annual" && membership.billing !== "monthly")) return inactive;
  const premium = membership.plan === "premium";
  return {
    active: true, plan: membership.plan, billing: membership.billing,
    vehicleLimit: premium ? 3 : 1, replacementTransport: premium, garageChoice: premium,
  };
}