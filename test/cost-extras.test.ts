import { test } from "node:test";
import assert from "node:assert/strict";
import { SentinelRuntime, buildEvent, standardProducers, type ReplayLine } from "../src/index.js";

const producers = Object.fromEntries(standardProducers("production").map((producer) => [producer.service, producer]));
const TENANT = { tenant_id: "ten_x", account_id: "acct_x" };
const DAY_MS = 24 * 3600 * 1000;

function inference(id: string, occurredAt: string, cacheHit: boolean): ReplayLine {
  return buildEvent(producers["neuroforge"]!, {
    event_id: id,
    event_type: "neuroforge.inference.completed",
    occurred_at: occurredAt,
    tenant: TENANT,
    actor: { actor_type: "service", actor_id: "neuroforge" },
    subject: { subject_type: "model_route", subject_id: "route_general" },
    correlation: { trace_id: `trc_${id}` },
    payload: { cache_hit: cacheHit, latency_ms: 900 },
  });
}

function costEvent(id: string, eventType: "usage.cost.estimated" | "usage.cost.finalized", occurredAt: string, amount: number): ReplayLine {
  return buildEvent(producers["usage-metering"]!, {
    event_id: id,
    event_type: eventType,
    occurred_at: occurredAt,
    tenant: TENANT,
    actor: { actor_type: "service", actor_id: "metering" },
    subject: { subject_type: "account", subject_id: TENANT.account_id },
    correlation: { trace_id: `trc_${id}` },
    payload: { amount, currency: "usd" },
  });
}

test("cache collapse: hit rate falling from a healthy historical rate produces a finding", () => {
  const lines: ReplayLine[] = [];
  // 10 days of ~67% hit rate (4 hits, 2 misses daily at 12:00).
  for (let day = 10; day >= 1; day--) {
    for (let request = 0; request < 6; request++) {
      const at = new Date(Date.parse("2026-06-09T12:00:00.000Z") - day * DAY_MS + request * 60000).toISOString();
      lines.push(inference(`evt_c_h_${day}_${request}`, at, request < 4));
    }
  }
  // Current day: 25 requests, all misses.
  for (let request = 0; request < 25; request++) {
    const at = new Date(Date.parse("2026-06-09T16:00:00.000Z") + request * 60000).toISOString();
    lines.push(inference(`evt_c_now_${request}`, at, false));
  }
  const report = new SentinelRuntime("production").runShadow(lines);
  const collapse = report.findings.find((finding) => finding.finding_type === "cost.cache_collapse");
  assert.ok(collapse, `expected cache collapse finding, got: ${report.findings.map((finding) => finding.finding_type).join(", ")}`);
  assert.equal(collapse.recommendation.action_class, "RECOMMEND_ONLY");
});

test("healthy cache produces no collapse finding", () => {
  const lines: ReplayLine[] = [];
  for (let day = 10; day >= 0; day--) {
    for (let request = 0; request < 25; request++) {
      const at = new Date(Date.parse("2026-06-09T12:00:00.000Z") - day * DAY_MS + request * 60000).toISOString();
      lines.push(inference(`evt_ch_${day}_${request}`, at, request % 3 !== 0));
    }
  }
  const report = new SentinelRuntime("production").runShadow(lines);
  assert.ok(!report.findings.some((finding) => finding.finding_type === "cost.cache_collapse"));
});

test("billing divergence: finalized cost far from estimate opens reconciliation (estimate/final stay separate)", () => {
  const lines: ReplayLine[] = [
    costEvent("evt_est_1", "usage.cost.estimated", "2026-06-09T10:00:00.000Z", 50),
    costEvent("evt_est_2", "usage.cost.estimated", "2026-06-09T12:00:00.000Z", 50),
    costEvent("evt_fin_1", "usage.cost.finalized", "2026-06-09T14:00:00.000Z", 70),
    costEvent("evt_fin_2", "usage.cost.finalized", "2026-06-09T16:00:00.000Z", 70),
  ];
  const report = new SentinelRuntime("production").runShadow(lines);
  const divergence = report.findings.find((finding) => finding.finding_type === "cost.billing_divergence");
  assert.ok(divergence);
  assert.match(divergence.explanation.summary, /estimated 100\.00, finalized 140\.00/);
  assert.equal(divergence.recommendation.action_class, "REQUEST_OPERATOR");
});

test("small estimate/finalized gap stays silent", () => {
  const lines: ReplayLine[] = [
    costEvent("evt_est_ok", "usage.cost.estimated", "2026-06-09T10:00:00.000Z", 100),
    costEvent("evt_fin_ok", "usage.cost.finalized", "2026-06-09T14:00:00.000Z", 110),
  ];
  const report = new SentinelRuntime("production").runShadow(lines);
  assert.ok(!report.findings.some((finding) => finding.finding_type === "cost.billing_divergence"));
});

test("quota bypass: usage after quota exceeded without paid overage is flagged", () => {
  const quotaExceeded = buildEvent(producers["usage-metering"]!, {
    event_id: "evt_quota_exceeded",
    event_type: "usage.quota.exceeded",
    occurred_at: "2026-06-09T12:00:00.000Z",
    tenant: TENANT,
    actor: { actor_type: "service", actor_id: "metering" },
    subject: { subject_type: "account", subject_id: TENANT.account_id },
    correlation: { trace_id: "trc_quota" },
    payload: { quota: "included_cloud_tokens", limit: 1000000 },
  });
  const usageAfter = buildEvent(producers["usage-metering"]!, {
    event_id: "evt_after_quota",
    event_type: "usage.tokens.recorded",
    occurred_at: "2026-06-09T13:00:00.000Z",
    tenant: TENANT,
    actor: { actor_type: "service", actor_id: "metering" },
    subject: { subject_type: "account", subject_id: TENANT.account_id },
    correlation: { trace_id: "trc_after_quota" },
    payload: { total_tokens: 50000, route_class: "general_cloud" },
  });
  const report = new SentinelRuntime("production").runShadow([quotaExceeded, usageAfter]);
  const bypass = report.findings.find((finding) => finding.finding_type === "cost.quota_bypass");
  assert.ok(bypass);
  assert.equal(bypass.risk.confidence, 0.85);

  // Same sequence with a paid-overage entitlement in effect: no finding.
  const overageAllowed = buildEvent(producers["billing-service"]!, {
    event_id: "evt_overage_ok",
    event_type: "license.feature.allowed",
    occurred_at: "2026-06-09T12:30:00.000Z",
    tenant: TENANT,
    actor: { actor_type: "service", actor_id: "entitlements" },
    subject: { subject_type: "account", subject_id: TENANT.account_id },
    correlation: { trace_id: "trc_overage" },
    payload: { feature: "paid_overage" },
  });
  const cleanReport = new SentinelRuntime("production").runShadow([quotaExceeded, overageAllowed, usageAfter]);
  assert.ok(!cleanReport.findings.some((finding) => finding.finding_type === "cost.quota_bypass"), "paid overage makes post-quota usage legitimate");
});
