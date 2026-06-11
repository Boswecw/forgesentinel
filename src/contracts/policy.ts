import { Issues, isRecord, requireString, type ValidationResult } from "./common.js";

/** Policy Decision Point outputs (02_REFERENCE_ARCHITECTURE). */
export const POLICY_RESULTS = [
  "DENY_ACTION",
  "RECOMMEND_ONLY",
  "REQUEST_OPERATOR",
  "ALLOW_BOUNDED_ACTION",
  "ALLOW_EMERGENCY_CONTAINMENT",
] as const;
export type PolicyResult = (typeof POLICY_RESULTS)[number];

export const APPROVAL_LEVELS = [
  "policy_allowed",
  "single_operator",
  "elevated_operator",
  "two_person",
  "business_owner",
  "security_owner",
  "customer_confirmation",
  "emergency_policy",
] as const;
export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number];

export interface AllowedAction {
  action_type: string;
  scope: string;
  expires_in_seconds: number;
  requires_approval: ApprovalLevel;
  reversible: boolean;
}

export interface DeniedAction {
  action_type: string;
  reason: string;
}

export interface PolicyDecision {
  policy_decision_id: string;
  incident_id: string;
  policy_id: string;
  policy_version: string;
  result: PolicyResult;
  allowed_actions: AllowedAction[];
  denied_actions: DeniedAction[];
  evaluated_at: string;
}

export interface PolicyRuleCondition {
  likelihood_gte?: number;
  impact_gte?: number;
  confidence_gte?: number;
  evidence_quality_gte?: number;
  independent_signal_count_gte?: number;
  includes_signal?: string[];
  active_data_exfiltration?: boolean;
}

export interface PolicyRule {
  when: PolicyRuleCondition;
  allow: { action: string; scope: string; approval: ApprovalLevel; reversible: boolean; expires_in_seconds?: number }[];
}

/**
 * Versioned deterministic policy definition (06). Policy thresholds live
 * here, outside node code; Sentinel models may propose text but cannot
 * deploy it (ADR-017).
 */
export interface PolicyDefinition {
  policy_id: string;
  version: string;
  match: { incident_type: string; environment: string };
  rules: PolicyRule[];
  always_deny: string[];
  cooldown_seconds: number;
}

export function validatePolicyDecision(value: unknown): ValidationResult {
  const issues = new Issues();
  if (!isRecord(value)) {
    issues.add("", "required_object", "policy decision must be an object");
    return issues.result();
  }
  requireString(issues, value, "policy_decision_id", { pattern: /^pdec_[A-Za-z0-9_-]+$/ });
  requireString(issues, value, "incident_id");
  requireString(issues, value, "policy_id");
  requireString(issues, value, "policy_version");
  requireString(issues, value, "result", { enum: POLICY_RESULTS });
  if (!Array.isArray(value["allowed_actions"])) {
    issues.add("allowed_actions", "required_array", "allowed_actions must be an array");
  }
  if (!Array.isArray(value["denied_actions"])) {
    issues.add("denied_actions", "required_array", "denied_actions must be an array");
  }
  return issues.result();
}
