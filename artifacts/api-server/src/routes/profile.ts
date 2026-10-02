import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, driverProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SaveProfileBody, GetProfileResponse, SaveProfileResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const emptyProfile = {
  name: "", phone: "", vehicleMake: "", vehiclePlate: "",
  vehicleElectric: false, safetyContactName: "", safetyContactPhone: "",
  completed: false, language: "en",
};

router.get("/profile", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, userId));
  res.json(GetProfileResponse.parse(profile ?? emptyProfile));
});

router.put("/profile", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = SaveProfileBody.safeParse(req.body);
  if (!parsed.success || (parsed.data.completed && (!parsed.data.name.trim() || !parsed.data.phone.trim()))) {
    res.status(400).json({ error: "A completed profile requires a name and phone number" }); return;
  }
  const data = parsed.data;
  const [profile] = await db.insert(driverProfilesTable)
    .values({ ...data, userId })
    .onConflictDoUpdate({ target: driverProfilesTable.userId, set: data })
    .returning();
  res.json(SaveProfileResponse.parse(profile));
});

export default router;