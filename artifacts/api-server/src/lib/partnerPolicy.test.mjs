import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessCompanyRole, canWorkerSeeJob, isEligiblePartner, canTransitionPartnerJob,
  isFreshVersion, canAssignWorker, canExpirePartnerOffer, companySupportsService,
} from "./partnerPolicy.ts";

test("owner and planner have management access; workers remain assigned-job scoped", () => {
  assert.equal(canAccessCompanyRole("owner", ["owner", "planner"]), true);
  assert.equal(canAccessCompanyRole("planner", ["owner", "planner"]), true);
  assert.equal(canAccessCompanyRole("worker", ["owner", "planner"]), false);
  assert.equal(canWorkerSeeJob({ role: "worker", workerId: "worker-a", userId: "worker-a", status: "accepted" }), true);
  assert.equal(canWorkerSeeJob({ role: "worker", workerId: null, userId: "worker-a", status: "offered" }), false);
  assert.equal(canWorkerSeeJob({ role: "worker", workerId: "worker-b", userId: "worker-a", status: "accepted" }), false);
});

test("partner offers require an approved, active, available, service-compatible company", () => {
  const base = { status: "approved", active: true, available: true, services: ["towing"] };
  assert.equal(isEligiblePartner(base, "tow", companySupportsService), true);
  assert.equal(isEligiblePartner({ ...base, status: "pending" }, "tow", companySupportsService), false);
  assert.equal(isEligiblePartner({ ...base, available: false }, "tow", companySupportsService), false);
  assert.equal(isEligiblePartner({ ...base, services: ["battery"] }, "tow", companySupportsService), false);
  assert.equal(isEligiblePartner({ ...base, type: "garage" }, "tow", companySupportsService), false);
  assert.equal(companySupportsService(["battery help"], "battery"), true);
  assert.equal(companySupportsService(["Vehicle transport"], "ev"), false);
  assert.equal(companySupportsService(["Electric vehicles"], "ev"), true);
  assert.equal(companySupportsService(["Battery help"], "ev"), false);
});

test("service-specific transitions and expiry are constrained", () => {
  assert.equal(canTransitionPartnerJob("accepted", "enroute", "tow"), true);
  assert.equal(canTransitionPartnerJob("accepted", "arrived", "other"), true);
  assert.equal(canTransitionPartnerJob("accepted", "enroute", "other"), false);
  assert.equal(canTransitionPartnerJob("accepted", "unavailable", "tow"), true);
  assert.equal(canTransitionPartnerJob("enroute", "unavailable", "tow"), true);
  assert.equal(canTransitionPartnerJob("pending", "unavailable", "tow"), false);
  assert.equal(canTransitionPartnerJob("completed", "enroute", "tow"), false);
  assert.equal(canExpirePartnerOffer("offered", new Date(0), new Date(1)), true);
  assert.equal(canExpirePartnerOffer("accepted", new Date(0), new Date(1)), false);
});

test("stale updates and accepted reassignment are rejected", () => {
  assert.equal(isFreshVersion(3, 3), true);
  assert.equal(isFreshVersion(3, 2), false);
  assert.equal(canAssignWorker({ status: "accepted", acceptedAt: new Date(), currentWorkerId: null, nextWorkerId: "worker-a" }), true);
  assert.equal(canAssignWorker({ status: "accepted", acceptedAt: new Date(), currentWorkerId: "worker-a", nextWorkerId: "worker-b" }), false);
  assert.equal(canAssignWorker({ status: "offered", acceptedAt: null, currentWorkerId: null, nextWorkerId: "worker-a" }), false);
});