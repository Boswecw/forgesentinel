import { test } from "node:test";
import assert from "node:assert/strict";
import { SentinelRuntime, buildEvent, standardProducers, canonicalJson, type ReplayLine } from "../src/index.js";

const producers = Object.fromEntries(standardProducers("production").map((producer) => [producer.service, producer]));
const TENANT = { tenant_id: "ten_d", account_id: "acct_d" };
const DAY_MS = 24 * 3600 * 1000;
const NOW = "2026-06-09T16:00:00.000Z";

function dataEvent(id: string, eventType: string, occurredAt: string, payload: Record<string, unknown>, subjectId = "obj_1"): ReplayLine {
  return buildEvent(producers["forgeagents"]!, {
    event_id: id,
    event_type: eventType,
    occurred_at: occurredAt,
    tenant: TENANT,
    actor: { actor_type: "agent", actor_id: "export-worker" },
    subject: { subject_type: "data_object", subject_id: subjectId },
    correlation: { trace_id: `trc_${id}` },
    payload,
  });
}

function exportEvent(id: string, occurredAt: string, bytes: number, destination: string): ReplayLine {
  return dataEvent(id, "data.object.exported", occurredAt, { bytes, destination, object_hash: "sha256:aa" });
}

test("cross-tenant denial becomes an incident-grade finding with exact actor/target and no content", () => {
  const denial = dataEvent("evt_xt", "data.cross_tenant.denied", NOW, { requested_tenant: "ten_other" }, "obj_secret");
  const report = new SentinelRuntime("production").runShadow([denial]);
  const finding = report.findings.find((candidate) => candidate.finding_type === "data.cross_tenant_attempt");
  assert.ok(finding);
  assert.match(finding.explanation.summary, /export-worker/);
  assert.match(finding.explanation.summary, /obj_secret/);
  assert.equal(finding.risk.confidence, 0.95);
  assert.ok(!canonicalJson(finding).includes("SECRET"), "no protected content in the finding");
});

test("redaction failure is flagged with transfer-must-stay-blocked guidance", () => {
  const failure = dataEvent("evt_red", "data.redaction.failed", NOW, { data_class: "restricted", transfer: "cloud_export" });
  const report = new SentinelRuntime("production").runShadow([failure]);
  const finding = report.findings.find((candidate) => candidate.finding_type === "data.redaction_failure");
  assert.ok(finding);
  assert.match(finding.explanation.summary, /must stay blocked/);
});

test("bulk export to a new destination forms a compound exfiltration incident with exact-destination block (Waves 8/9)", () => {
  const lines: ReplayLine[] = [];
  // History: routine small exports to a known destination teach novelty.
  for (let day = 10; day >= 1; day--) {
    const at = new Date(Date.parse(NOW) - day * DAY_MS).toISOString();
    lines.push(exportEvent(`evt_exp_hist_${day}`, at, 50_000_000, "s3://backup-known"));
  }
  // Today: 6 GB to a never-seen destination.
  lines.push(exportEvent("evt_exp_big_1", "2026-06-09T15:00:00.000Z", 3_000_000_000, "s3://exfil-unknown"));
  lines.push(exportEvent("evt_exp_big_2", NOW, 3_000_000_000, "s3://exfil-unknown"));

  const report = new SentinelRuntime("production").runShadow(lines);
  const types = report.findings.map((finding) => finding.finding_type);
  assert.ok(types.includes("data.new_destination"), `missing novelty finding in: ${types.join(", ")}`);
  assert.ok(types.includes("data.bulk_export"), `missing bulk export finding in: ${types.join(", ")}`);

  const incident = report.incidents.find((candidate) => candidate.incident_type === "compound.data_exfiltration");
  assert.ok(incident, "compound exfiltration incident formed");
  assert.ok(incident.independent_signal_count >= 2);
  const block = incident.recommended_actions.find((action) => action.action_type === "data.export_destination.block");
  assert.ok(block);
  assert.equal(block.target_id, "s3://exfil-unknown", "block targets exactly the novel destination");
  assert.equal(block.scope, "single_destination");
  assert.equal(block.reversible, true);

  const decision = report.decisions.find((candidate) => candidate.incident_id === incident.incident_id)!;
  assert.equal(decision.policy_id, "sentinel_data_exfiltration");
  assert.equal(decision.result, "REQUEST_OPERATOR");
  assert.ok(decision.denied_actions.every((action) => action.action_type !== "customer_data.delete"));
});

test("routine exports to known destinations stay silent", () => {
  const lines: ReplayLine[] = [];
  for (let day = 10; day >= 0; day--) {
    const at = new Date(Date.parse(NOW) - day * DAY_MS).toISOString();
    lines.push(exportEvent(`evt_exp_ok_${day}`, at, 50_000_000, "s3://backup-known"));
  }
  const report = new SentinelRuntime("production").runShadow(lines);
  assert.ok(!report.findings.some((finding) => finding.finding_type.startsWith("data.")), "no data findings for routine behavior");
  assert.equal(report.incidents.length, 0);
});
