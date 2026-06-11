import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CapabilityService,
  IdentityAuthority,
  ReceiptService,
  EvidenceLedger,
  validateActionReceipt,
  type PolicyDecision,
  type AllowedAction,
  type ApprovalRecord,
} from "../src/index.js";

const NOW = "2026-06-09T17:10:00.000Z";
const KEY_FP = "sha256:newkey7fa2";

const decision: PolicyDecision = {
  policy_decision_id: "pdec_t1",
  incident_id: "inc_t1",
  policy_id: "sentinel_account_compromise",
  policy_version: "3.1.0",
  result: "REQUEST_OPERATOR",
  allowed_actions: [
    { action_type: "identity.api_key.pause", scope: "single_key", expires_in_seconds: 900, requires_approval: "single_operator", reversible: true },
  ],
  denied_actions: [],
  evaluated_at: NOW,
};
const pauseAction: AllowedAction = decision.allowed_actions[0]!;
const operatorApproval: ApprovalRecord = { level: "single_operator", approver_type: "operator", approver_id: "op_17", approved_at: NOW };

function setup() {
  const ledger = new EvidenceLedger();
  const capabilities = new CapabilityService("test-capability-signing-key");
  const receipts = new ReceiptService(ledger);
  const authority = new IdentityAuthority(capabilities, receipts);
  authority.registerKey(KEY_FP);
  return { ledger, capabilities, receipts, authority };
}

test("approved action executes with receipt, then rollback restores state with its own receipt", () => {
  const { authority, capabilities, receipts } = setup();
  const token = capabilities.issue(decision, pauseAction, KEY_FP, "identity-service", operatorApproval, NOW);
  const receipt = authority.execute(token, { action: "identity.api_key.pause", target: KEY_FP, scope: "single_key" }, NOW);
  assert.equal(receipt.action.result, "success");
  assert.equal(authority.keyState(KEY_FP), "paused");
  assert.equal(receipt.rollback.supported, true);
  assert.equal(receipt.rollback.action_type, "identity.api_key.resume");
  assert.equal(validateActionReceipt(receipt).ok, true, "receipt satisfies the contract");

  const rollbackReceipt = authority.rollback(receipt, "2026-06-09T18:00:00.000Z");
  assert.equal(rollbackReceipt.action.result, "rolled_back");
  assert.equal(authority.keyState(KEY_FP), "active");
  assert.equal(rollbackReceipt.rollback.rollback_of, receipt.receipt_id);
  assert.equal(receipts.byIncident("inc_t1").length, 2, "every attempt has a receipt");
});

test("executor rejects expanded scope and records the rejection (12 capability expansion scenario)", () => {
  const { authority, capabilities } = setup();
  const token = capabilities.issue(decision, pauseAction, KEY_FP, "identity-service", operatorApproval, NOW);
  const receipt = authority.execute(token, { action: "identity.api_key.pause", target: KEY_FP, scope: "all_keys" }, NOW);
  assert.equal(receipt.action.result, "rejected");
  assert.match(receipt.action.failure_reason ?? "", /scope_mismatch/);
  assert.equal(authority.keyState(KEY_FP), "active", "no partial broad action");
});

test("executor rejects a changed action or target", () => {
  const { authority, capabilities } = setup();
  const token = capabilities.issue(decision, pauseAction, KEY_FP, "identity-service", operatorApproval, NOW);
  const changedAction = authority.execute(token, { action: "identity.api_key.revoke", target: KEY_FP, scope: "single_key" }, NOW);
  assert.equal(changedAction.action.result, "rejected");
  const token2 = capabilities.issue(decision, pauseAction, KEY_FP, "identity-service", operatorApproval, NOW);
  const changedTarget = authority.execute(token2, { action: "identity.api_key.pause", target: "sha256:otherkey", scope: "single_key" }, NOW);
  assert.equal(changedTarget.action.result, "rejected");
  assert.equal(authority.keyState(KEY_FP), "active");
});

test("replayed capability is rejected after max_attempts", () => {
  const { authority, capabilities } = setup();
  const token = capabilities.issue(decision, pauseAction, KEY_FP, "identity-service", operatorApproval, NOW);
  const first = authority.execute(token, { action: "identity.api_key.pause", target: KEY_FP, scope: "single_key" }, NOW);
  assert.equal(first.action.result, "success");
  const replay = authority.execute(token, { action: "identity.api_key.pause", target: KEY_FP, scope: "single_key" }, NOW);
  assert.equal(replay.action.result, "rejected");
  assert.match(replay.action.failure_reason ?? "", /replayed/);
});

test("expired capability is rejected", () => {
  const { authority, capabilities } = setup();
  const token = capabilities.issue(decision, pauseAction, KEY_FP, "identity-service", operatorApproval, NOW);
  const receipt = authority.execute(token, { action: "identity.api_key.pause", target: KEY_FP, scope: "single_key" }, "2026-06-09T18:00:00.000Z");
  assert.equal(receipt.action.result, "rejected");
  assert.match(receipt.action.failure_reason ?? "", /expired/);
});

test("tampered claims fail signature verification", () => {
  const { authority, capabilities } = setup();
  const token = capabilities.issue(decision, pauseAction, KEY_FP, "identity-service", operatorApproval, NOW);
  const tampered = { ...token, claims: { ...token.claims, target: "sha256:otherkey" } };
  const receipt = authority.execute(tampered, { action: "identity.api_key.pause", target: "sha256:otherkey", scope: "single_key" }, NOW);
  assert.equal(receipt.action.result, "rejected");
  assert.match(receipt.action.failure_reason ?? "", /signature_invalid/);
});

test("issuance requires the approval level demanded by policy", () => {
  const { capabilities } = setup();
  const policyOnly: ApprovalRecord = { level: "policy_allowed", approver_type: "policy", approver_id: "policy", approved_at: NOW };
  assert.throws(() => capabilities.issue(decision, pauseAction, KEY_FP, "identity-service", policyOnly, NOW), /requires single_operator/);
});

test("issuance refuses actions outside the policy decision", () => {
  const { capabilities } = setup();
  const rogue: AllowedAction = { action_type: "identity.session.revoke", scope: "all_sessions", expires_in_seconds: 900, requires_approval: "single_operator", reversible: false };
  assert.throws(() => capabilities.issue(decision, rogue, "acct_1", "identity-service", operatorApproval, NOW), /not allowed by decision/);
});
