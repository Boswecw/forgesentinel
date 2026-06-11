import {
  Issues,
  isRecord,
  requireIsoTimestamp,
  requireObject,
  requireString,
  type ValidationResult,
} from "./common.js";

/**
 * Decision and action receipt (04). Every decision and every action
 * attempt — success, failure, or rollback — produces one (ADR-016).
 */
export interface ActionReceipt {
  receipt_id: string;
  receipt_type: "sentinel.decision" | "sentinel.action" | "sentinel.rollback" | "cssa.control";
  incident_id: string;
  decision: {
    decision_id: string;
    policy_id: string;
    policy_version: string;
    result: string;
    approver: { type: string; id: string };
  };
  action: {
    requested: string;
    executed: string | null;
    target_id: string;
    scope: string;
    result: "success" | "failure" | "rejected" | "rolled_back";
    failure_reason?: string;
  };
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  rollback: { supported: boolean; action_type?: string; rollback_of?: string };
  control_lineage?: { control_id?: string; policy_decision_id: string };
  created_at: string;
  integrity: { hash: string; signature?: string };
}

export function validateActionReceipt(value: unknown): ValidationResult {
  const issues = new Issues();
  if (!isRecord(value)) {
    issues.add("", "required_object", "receipt must be an object");
    return issues.result();
  }
  requireString(issues, value, "receipt_id", { pattern: /^rcpt_[A-Za-z0-9_-]+$/ });
  requireString(issues, value, "receipt_type", {
    enum: ["sentinel.decision", "sentinel.action", "sentinel.rollback", "cssa.control"],
  });
  requireString(issues, value, "incident_id");
  const decision = requireObject(issues, value, "decision");
  if (decision) {
    requireString(issues, decision, "decision_id", { prefix: "decision" });
    requireString(issues, decision, "policy_id", { prefix: "decision" });
    requireString(issues, decision, "policy_version", { prefix: "decision" });
    requireString(issues, decision, "result", { prefix: "decision" });
    const approver = requireObject(issues, decision, "approver", "decision");
    if (approver) {
      requireString(issues, approver, "type", { prefix: "decision.approver" });
      requireString(issues, approver, "id", { prefix: "decision.approver" });
    }
  }
  const action = requireObject(issues, value, "action");
  if (action) {
    requireString(issues, action, "requested", { prefix: "action" });
    requireString(issues, action, "target_id", { prefix: "action" });
    requireString(issues, action, "scope", { prefix: "action" });
    requireString(issues, action, "result", { prefix: "action", enum: ["success", "failure", "rejected", "rolled_back"] });
  }
  const rollback = requireObject(issues, value, "rollback");
  if (rollback && typeof rollback["supported"] !== "boolean") {
    issues.add("rollback.supported", "required_boolean", "rollback support must be explicit");
  }
  requireIsoTimestamp(issues, value, "created_at");
  const integrity = requireObject(issues, value, "integrity");
  if (integrity) {
    requireString(issues, integrity, "hash", { prefix: "integrity", pattern: /^sha256:[0-9a-f]{64}$/ });
  }
  return issues.result();
}
