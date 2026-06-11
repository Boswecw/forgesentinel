import { test } from "node:test";
import assert from "node:assert/strict";
import { BaselineService, median, medianAbsoluteDeviation, type BaselineConfig } from "../src/index.js";

const CONFIG: BaselineConfig = {
  baseline_id: "test.daily",
  version: "1.0.0",
  feature: "test.feature@1.0.0",
  scope_priority: [["tenant_id", "account_id"], ["tenant_id"]],
  method: { type: "robust_seasonal", minimum_samples: 5, center: "median", dispersion: "median_absolute_deviation", ema_alpha: 0.15 },
  protections: { exclude_active_incidents: true, max_single_window_influence: 0.05, freeze_on_confirmed_compromise: true },
};

function seeded(scope: Record<string, string>, values: number[], flags: { active_incident?: boolean } = {}): BaselineService {
  const service = new BaselineService();
  service.register(CONFIG);
  values.forEach((value, index) => service.addSample("test.daily", scope, `2026-06-0${(index % 8) + 1}T00:00:00Z`, value, flags));
  return service;
}

test("median and MAD are robust to outliers", () => {
  const values = [100, 100, 100, 100, 1000000];
  const center = median(values);
  assert.equal(center, 100);
  assert.equal(medianAbsoluteDeviation(values, center), 0);
  assert.equal(median([97, 98, 100, 102, 103]), 100);
});

test("evaluation uses the most specific scope with sufficient samples", () => {
  const scope = { tenant_id: "ten_a", account_id: "acct_1" };
  const service = seeded(scope, [100, 101, 99, 100, 102, 98]);
  const evaluation = service.evaluate("test.daily", scope, 1500);
  assert.equal(evaluation.sufficient, true);
  assert.deepEqual(evaluation.scope_used, ["tenant_id", "account_id"]);
  assert.ok(evaluation.change_ratio > 10);
  assert.ok(evaluation.robust_score > 8);
});

test("scope falls back when the specific scope lacks samples", () => {
  const service = new BaselineService();
  service.register(CONFIG);
  for (let index = 0; index < 6; index++) {
    service.addSample("test.daily", { tenant_id: "ten_a", account_id: `acct_${index}` }, "2026-06-01T00:00:00Z", 100 + index);
  }
  const evaluation = service.evaluate("test.daily", { tenant_id: "ten_a", account_id: "acct_new" }, 120);
  assert.equal(evaluation.sufficient, true);
  assert.deepEqual(evaluation.scope_used, ["tenant_id"], "fell back to tenant scope");
});

test("cold start stays explicit: insufficient samples never fabricate a baseline", () => {
  const service = new BaselineService();
  service.register(CONFIG);
  service.addSample("test.daily", { tenant_id: "ten_x", account_id: "acct_x" }, "2026-06-01T00:00:00Z", 100);
  const evaluation = service.evaluate("test.daily", { tenant_id: "ten_x", account_id: "acct_x" }, 100000);
  assert.equal(evaluation.sufficient, false);
  assert.equal(evaluation.scope_used, null);
});

test("samples during active incidents are excluded (poisoning resistance)", () => {
  const scope = { tenant_id: "ten_a", account_id: "acct_1" };
  const service = seeded(scope, [100, 101, 99, 100, 102]);
  for (let index = 0; index < 10; index++) {
    service.addSample("test.daily", scope, "2026-06-09T00:00:00Z", 1000000, { active_incident: true });
  }
  const evaluation = service.evaluate("test.daily", scope, 1000000);
  assert.ok(evaluation.expected < 200, `incident windows must not drag the baseline up (got ${evaluation.expected})`);
});

test("frozen baselines stop absorbing samples after confirmed compromise", () => {
  const scope = { tenant_id: "ten_a", account_id: "acct_1" };
  const service = seeded(scope, [100, 101, 99, 100, 102]);
  service.freeze("test.daily", scope);
  for (let index = 0; index < 20; index++) {
    service.addSample("test.daily", scope, "2026-06-09T00:00:00Z", 500000);
  }
  const evaluation = service.evaluate("test.daily", scope, 500000);
  assert.ok(evaluation.expected < 200, "frozen baseline keeps the pre-compromise center");
  assert.equal(evaluation.frozen, true);
});
