import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SentinelAgentNode,
  FeatureService,
  AGENT_FORBIDDEN_ACTIONS,
  GLOBAL_ALWAYS_DENY,
  CapabilityService,
  YellowJacketAuthority,
  ReceiptService,
  EvidenceLedger,
  buildEvent,
  standardProducers,
  type EventEnvelope,
  type PolicyDecision,
  type AllowedAction,
  type ApprovalRecord,
} from "../src/index.js";

const producers = Object.fromEntries(standardProducers("production").map((producer) => [producer.service, producer]));
const NOW = "2026-06-09T15:00:00.000Z";
const FP_V2 = "agt_smithy@1.4.2";
const FP_V1 = "agt_smithy@1.4.1";

function agentEvent(id: string, eventType: string, occurredAt: string, fingerprint: string, payload: Record<string, unknown> = {}): EventEnvelope {
  return buildEvent(producers["forgeagents"]!, {
    event_id: id,
    event_type: eventType,
    occurred_at: occurredAt,
    tenant: { tenant_id: "ten_a", account_id: "acct_1" },
    actor: { actor_type: "agent", actor_id: "forge-smithy" },
    subject: { subject_type: "agent_version", subject_id: fingerprint },
    correlation: { trace_id: `trc_${id}`, run_id: "run_77" },
    payload: { agent_fingerprint: fingerprint, ...payload },
  }).event;
}

function nodeWithFeatures(): { node: SentinelAgentNode; features: FeatureService } {
  const features = new FeatureService();
  features.register({
    feature_id: "agent.patches_per_hour",
    version: "1.0.0",
    source_events: ["agent.patch.proposed", "agent.patch.applied"],
    scope: ["tenant_id", "agent_fingerprint"],
    window: { type: "rolling", duration_ms: 3600 * 1000, lateness_allowance_ms: 0 },
    aggregation: { operation: "count" },
    privacy: { stores_content: false, cloud_allowed: true, retention_class: "security_365d" },
  });
  features.register({
    feature_id: "agent.denials_per_hour",
    version: "1.0.0",
    source_events: ["agent.permission.denied", "yellowjacket.admission.denied"],
    scope: ["tenant_id", "agent_fingerprint"],
    window: { type: "rolling", duration_ms: 3600 * 1000, lateness_allowance_ms: 0 },
    aggregation: { operation: "count" },
    privacy: { stores_content: false, cloud_allowed: true, retention_class: "security_365d" },
  });
  features.register({
    feature_id: "agent.runs_per_hour",
    version: "1.0.0",
    source_events: ["agent.run.started"],
    scope: ["tenant_id", "agent_fingerprint"],
    window: { type: "rolling", duration_ms: 3600 * 1000, lateness_allowance_ms: 0 },
    aggregation: { operation: "count" },
    privacy: { stores_content: false, cloud_allowed: true, retention_class: "security_365d" },
  });
  return { node: new SentinelAgentNode(features), features };
}

test("boundary violation is a deterministic per-event finding targeting the exact version", () => {
  const { node } = nodeWithFeatures();
  const event = agentEvent("evt_b1", "agent.boundary.violated", NOW, FP_V2, { boundary: "repo:authorforge" });
  const output = node.process([event]);
  assert.equal(output.findings.length, 1);
  const finding = output.findings[0]!;
  assert.equal(finding.finding_type, "agent.boundary_violation");
  assert.equal(finding.subject.id, FP_V2);
  assert.equal(finding.correlation_hints.run_id, "run_77");
  assert.equal(finding.recommendation.action_class, "REQUEST_BOUNDED_ACTION");
});

test("release boundaries prevent baseline mixing: bursts are scoped per exact fingerprint (Wave 5 exit gate)", () => {
  const { node, features } = nodeWithFeatures();
  const events: EventEnvelope[] = [];
  for (let index = 0; index < 20; index++) {
    events.push(agentEvent(`evt_p2_${index}`, "agent.patch.applied", new Date(Date.parse(NOW) + index * 60000).toISOString(), FP_V2));
  }
  for (let index = 0; index < 3; index++) {
    events.push(agentEvent(`evt_p1_${index}`, "agent.patch.applied", new Date(Date.parse(NOW) + index * 60000).toISOString(), FP_V1));
  }
  for (const event of events) features.observe(event);
  const output = node.process(events);
  const bursts = output.findings.filter((finding) => finding.finding_type === "agent.patch_burst");
  assert.equal(bursts.length, 1, "only the bursting version is flagged");
  assert.equal(bursts[0]!.subject.id, FP_V2);
  assert.equal(bursts[0]!.correlation_hints.agent_fingerprint, FP_V2);
});

test("repeated denials and run loops are detected per fingerprint", () => {
  const { node, features } = nodeWithFeatures();
  const events: EventEnvelope[] = [];
  for (let index = 0; index < 6; index++) {
    events.push(agentEvent(`evt_d_${index}`, "agent.permission.denied", new Date(Date.parse(NOW) + index * 60000).toISOString(), FP_V2));
  }
  for (let index = 0; index < 12; index++) {
    events.push(agentEvent(`evt_r_${index}`, "agent.run.started", new Date(Date.parse(NOW) + index * 60000).toISOString(), FP_V2));
  }
  for (const event of events) features.observe(event);
  const types = node.process(events).findings.map((finding) => finding.finding_type);
  assert.ok(types.includes("agent.repeated_denials"));
  assert.ok(types.includes("agent.loop_suspected"));
});

test("Sentinel cannot patch code: forbidden agent actions are globally always-denied (ADR-007)", () => {
  for (const action of AGENT_FORBIDDEN_ACTIONS) {
    assert.ok(GLOBAL_ALWAYS_DENY[action], `${action} must be globally always-denied`);
  }
});

// --- YellowJacket authority -----------------------------------------------

const decision: PolicyDecision = {
  policy_decision_id: "pdec_a1",
  incident_id: "inc_a1",
  policy_id: "sentinel_agent_drift",
  policy_version: "1.0.0",
  result: "REQUEST_OPERATOR",
  allowed_actions: [
    { action_type: "yellowjacket.run.stop", scope: "single_run", expires_in_seconds: 300, requires_approval: "policy_allowed", reversible: false },
    { action_type: "yellowjacket.agent_version.quarantine", scope: "single_agent_version", expires_in_seconds: 900, requires_approval: "single_operator", reversible: true },
  ],
  denied_actions: [],
  evaluated_at: NOW,
};
const stopAction = decision.allowed_actions[0] as AllowedAction;
const quarantineAction = decision.allowed_actions[1] as AllowedAction;
const policyApproval: ApprovalRecord = { level: "policy_allowed", approver_type: "policy", approver_id: "policy", approved_at: NOW };
const operatorApproval: ApprovalRecord = { level: "single_operator", approver_type: "operator", approver_id: "op_17", approved_at: NOW };

function authoritySetup() {
  const ledger = new EvidenceLedger();
  const capabilities = new CapabilityService("test-capability-signing-key");
  const receipts = new ReceiptService(ledger);
  const authority = new YellowJacketAuthority(capabilities, receipts);
  authority.registerRun("run_77");
  authority.registerAgentVersion(FP_V2);
  authority.registerAgentVersion(FP_V1);
  return { authority, capabilities };
}

test("stop run executes via capability and is receipted", () => {
  const { authority, capabilities } = authoritySetup();
  const token = capabilities.issue(decision, stopAction, "run_77", "yellowjacket", policyApproval, NOW);
  const receipt = authority.execute(token, { action: "yellowjacket.run.stop", target: "run_77", scope: "single_run" }, NOW);
  assert.equal(receipt.action.result, "success");
  assert.equal(authority.runState("run_77"), "stopped");
  assert.equal(receipt.rollback.supported, false);
});

test("quarantine targets the exact version; other versions stay active; re-enable path works (Wave 5 exit gate)", () => {
  const { authority, capabilities } = authoritySetup();
  const token = capabilities.issue(decision, quarantineAction, FP_V2, "yellowjacket", operatorApproval, NOW);
  const receipt = authority.execute(token, { action: "yellowjacket.agent_version.quarantine", target: FP_V2, scope: "single_agent_version" }, NOW);
  assert.equal(receipt.action.result, "success");
  assert.equal(authority.agentVersionState(FP_V2), "quarantined");
  assert.equal(authority.agentVersionState(FP_V1), "active", "sibling version is untouched");

  const reenabled = authority.rollback(receipt, "2026-06-09T16:00:00.000Z");
  assert.equal(reenabled.action.result, "rolled_back");
  assert.equal(reenabled.action.requested, "yellowjacket.agent_version.reenable");
  assert.equal(authority.agentVersionState(FP_V2), "active");
  assert.equal(reenabled.rollback.rollback_of, receipt.receipt_id);
});

test("YellowJacket rejects widened scope without partial effect", () => {
  const { authority, capabilities } = authoritySetup();
  const token = capabilities.issue(decision, quarantineAction, FP_V2, "yellowjacket", operatorApproval, NOW);
  const receipt = authority.execute(token, { action: "yellowjacket.agent_version.quarantine", target: FP_V2, scope: "all_agent_versions" }, NOW);
  assert.equal(receipt.action.result, "rejected");
  assert.equal(authority.agentVersionState(FP_V2), "active");
});
