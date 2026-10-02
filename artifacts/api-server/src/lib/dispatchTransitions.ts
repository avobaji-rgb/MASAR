export const activeDispatchStatuses = ["pending", "offered", "accepted", "enroute", "arrived"] as const;
export const releasableDispatchStatuses = ["pending", "offered"] as const;

export function canTakeOverDispatch(status: string): boolean {
  return activeDispatchStatuses.includes(status as (typeof activeDispatchStatuses)[number]);
}

export function canReleaseDispatch(status: string): boolean {
  return releasableDispatchStatuses.includes(status as (typeof releasableDispatchStatuses)[number]);
}

export function canReofferDispatch(status: string, providerAcknowledgedAt: Date | null): boolean {
  return status === "offered" && providerAcknowledgedAt === null;
}

export function transportAfterReassignment(replacementTransport: boolean): "pending" | "not_requested" {
  return replacementTransport ? "pending" : "not_requested";
}

export function canOperatorTransition(
  current: string,
  target: string,
  hasTransportDecision: boolean,
): boolean {
  if (target === current) return hasTransportDecision && ["accepted", "enroute", "arrived"].includes(current);
  if (target === "unavailable") return ["pending", "offered", "accepted", "enroute", "arrived"].includes(current);
  if (current === "accepted") return target === "enroute";
  if (current === "enroute") return target === "arrived";
  if (current === "arrived") return target === "completed";
  return false;
}