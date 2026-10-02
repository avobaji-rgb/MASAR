export type PartnerRole = "owner" | "planner" | "worker";
export type CompanyEligibility = {
  status: string;
  active: boolean;
  available: boolean;
  services: string[];
  type?: string;
};

export function companySupportsService(services: string[], requestService: string): boolean {
  const aliases: Record<string, string[]> = {
    tow: ["tow", "towing", "vehicle transport", "recovery"],
    flat: ["flat", "tire", "tyre", "wheel", "roadside assistance"],
    battery: ["battery", "jump start", "roadside assistance"],
    fuel: ["fuel", "roadside assistance"],
    lockout: ["lockout", "roadside assistance"],
    ev: ["ev", "electric vehicle", "electric vehicles"],
    other: ["other", "roadside assistance", "repair", "garage"],
  };
  const accepted = aliases[requestService] ?? [requestService];
  return services.some((service) => accepted.some(alias => {
    const normalized = service.trim().toLowerCase();
    // Short codes must match a complete service, not unrelated substrings.
    return alias.length <= 3 ? normalized === alias : normalized.includes(alias);
  }));
}

export function canAccessCompanyRole(role: string, permitted: PartnerRole[]): boolean {
  return permitted.includes(role as PartnerRole);
}

export function canWorkerSeeJob(input: { role: string; workerId: string | null; userId: string; status: string }): boolean {
  if (input.role !== "worker") return true;
  return input.workerId === input.userId && ["accepted", "enroute", "arrived", "completed", "unavailable"].includes(input.status);
}

export function isEligiblePartner(company: CompanyEligibility, service: string, supportsService: (services: string[], service: string) => boolean): boolean {
  const typeMatches = !company.type
    || (service === "tow" ? company.type === "towing" || company.type === "both"
      : service === "other" ? company.type === "garage" || company.type === "both" : true);
  return company.status === "approved" && company.active && company.available && typeMatches && supportsService(company.services, service);
}

export function canTransitionPartnerJob(current: string, next: string, service: string): boolean {
  if (next === "unavailable") return ["accepted", "enroute", "arrived"].includes(current);
  if (!["other", "repair", "garage"].includes(service)) {
    return ({ accepted: ["enroute"], enroute: ["arrived"], arrived: ["completed"] } as Record<string, string[]>)[current]?.includes(next) ?? false;
  }
  return ({ accepted: ["arrived"], arrived: ["completed"] } as Record<string, string[]>)[current]?.includes(next) ?? false;
}

export function isFreshVersion(currentVersion: number, expectedVersion: number): boolean {
  return currentVersion === expectedVersion;
}

export function canAssignWorker(input: { status: string; acceptedAt: Date | null; currentWorkerId: string | null; nextWorkerId: string }): boolean {
  if (!["accepted", "enroute", "arrived"].includes(input.status) || !input.acceptedAt) return false;
  if (input.currentWorkerId && input.currentWorkerId !== input.nextWorkerId) return false;
  return true;
}

export function canExpirePartnerOffer(status: string, expiresAt: Date, now = new Date()): boolean {
  return status === "offered" && expiresAt <= now;
}