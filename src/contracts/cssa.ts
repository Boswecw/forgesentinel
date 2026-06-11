import {
  Issues,
  isRecord,
  requireIsoTimestamp,
  requireNumber,
  requireObject,
  requireString,
  type ValidationResult,
} from "./common.js";
import type { Finding } from "./finding.js";

export const CLOUD_SECURITY_FINDING_SCHEMA = "cloud_security.finding.v1";
export const CONTROL_DIRECTIVE_SCHEMA = "cloud_security.control_directive.v1";

/**
 * CSSA watchdog output (07 §6). It is a SOURCE finding: it cannot create or
 * mutate Sentinel incident lifecycle state directly (ADR-020).
 */
export interface CloudSecurityFinding {
  schema_version: typeof CLOUD_SECURITY_FINDING_SCHEMA;
  finding_id: string;
  detector: string;
  detected_at: string;
  tenant_id: string;
  subject: { type: string; id: string };
  threshold: string;
  policy_bundle_id: string;
  evidence_refs: string[];
  record_hashes: string[];
  originating_scope: string;
  severity_hint: number;
}

export function validateCloudSecurityFinding(value: unknown): ValidationResult {
  const issues = new Issues();
  if (!isRecord(value)) {
    issues.add("", "required_object", "cloud security finding must be an object");
    return issues.result();
  }
  const schema = value["schema_version"];
  if (schema !== CLOUD_SECURITY_FINDING_SCHEMA) {
    issues.add("schema_version", "unsupported_schema", `expected ${CLOUD_SECURITY_FINDING_SCHEMA}; legacy SecurityIncident.v1 payloads must come through the legacy adapter`);
  }
  requireString(issues, value, "finding_id");
  requireString(issues, value, "detector");
  requireIsoTimestamp(issues, value, "detected_at");
  requireString(issues, value, "tenant_id");
  requireString(issues, value, "threshold");
  requireString(issues, value, "policy_bundle_id");
  if (!Array.isArray(value["evidence_refs"]) || value["evidence_refs"].length === 0) {
    issues.add("evidence_refs", "required_array", "CSSA finding must reference immutable evidence");
  }
  requireNumber(issues, value, "severity_hint", { min: 0, max: 1 });
  return issues.result();
}

/**
 * Adapter: CSSA watchdog finding -> Sentinel SOURCE finding. Promotion to an
 * incident remains with Sentinel Prime or a deterministic formation rule.
 */
export function cssaFindingToSourceFinding(cssa: CloudSecurityFinding, nowIso: string): Finding {
  const expires = new Date(Date.parse(cssa.detected_at) + 24 * 3600 * 1000).toISOString();
  return {
    finding_id: `fnd_cssa_${cssa.finding_id}`,
    finding_type: `cssa.${cssa.detector}`,
    node: { name: "cssa-watchdog-adapter", version: "1.0.0" },
    subject: cssa.subject,
    tenant_id: cssa.tenant_id,
    window: { start: cssa.detected_at, end: cssa.detected_at },
    risk: {
      likelihood: cssa.severity_hint,
      impact: cssa.severity_hint,
      // Deterministic edge detection is high confidence in WHAT it saw; the
      // ecosystem interpretation is Prime's job.
      confidence: 0.9,
      evidence_quality: 0.95,
    },
    evidence_ids: cssa.evidence_refs,
    source_event_roots: cssa.evidence_refs,
    explanation: {
      summary: `CSSA watchdog detector "${cssa.detector}" crossed threshold ${cssa.threshold} under policy bundle ${cssa.policy_bundle_id}.`,
      top_factors: [{ factor: cssa.detector, contribution: 1 }],
      uncertainties: ["Source finding from the enforcement boundary; cross-domain interpretation pending correlation."],
    },
    recommendation: { action_class: "RECOMMEND_ONLY" },
    expires_at: expires,
    correlation_hints: {},
    policy_generated_effect: false,
  };
}

export interface ControlDirectiveTarget {
  tenant_id: string;
  principal_id?: string;
  executor_id?: string;
  app_id?: string;
  cloud_service?: string;
  provider?: string;
  model_fingerprint?: string;
}

/**
 * Signed, scoped, expiring control artifact (06, 07 §8). A raw incident is
 * never an authorization artifact (ADR-021).
 */
export interface CloudSecurityControlDirective {
  schema_version: typeof CONTROL_DIRECTIVE_SCHEMA;
  control_id: string;
  incident_id: string;
  policy_decision_id: string;
  issuer: string;
  issued_at: string;
  expires_at: string;
  action: string;
  target: ControlDirectiveTarget;
  scope: string;
  max_uses: number;
  approval: { level: string; approval_id: string };
  rollback: { required: boolean; action: string; restore_state_ref?: string };
  reason_codes: string[];
  integrity: { algorithm: string; key_id: string; signature: string };
}

export const DIRECTIVE_FIELDS = new Set([
  "schema_version",
  "control_id",
  "incident_id",
  "policy_decision_id",
  "issuer",
  "issued_at",
  "expires_at",
  "action",
  "target",
  "scope",
  "max_uses",
  "approval",
  "rollback",
  "reason_codes",
  "integrity",
]);

/** Initial allowlisted controls with their maximum scope (07 §10). */
export const DIRECTIVE_ACTION_ALLOWLIST: Record<string, { max_scope: string; rollback_action: string }> = {
  "cssa.cloud_route.hold": { max_scope: "single_executor_single_route", rollback_action: "cssa.cloud_route.release" },
  "cssa.executor_service.hold": { max_scope: "single_executor_single_service", rollback_action: "cssa.executor_service.release" },
  "cssa.action.require_approval": { max_scope: "single_principal_single_action", rollback_action: "cssa.action.release_approval_requirement" },
  "cssa.model_fingerprint.deny_category": { max_scope: "single_fingerprint_single_category", rollback_action: "cssa.model_fingerprint.allow_category" },
  "cssa.retry_ceiling.lower": { max_scope: "single_route", rollback_action: "cssa.retry_ceiling.restore" },
  "cssa.redaction.require": { max_scope: "single_action_single_data_class", rollback_action: "cssa.redaction.release_requirement" },
  "cssa.destination.block_temporary": { max_scope: "single_destination_single_tenant", rollback_action: "cssa.destination.unblock" },
  "identity.reauthentication.require": { max_scope: "single_account", rollback_action: "identity.reauthentication.release" },
};

export function validateControlDirectiveShape(value: unknown): ValidationResult {
  const issues = new Issues();
  if (!isRecord(value)) {
    issues.add("", "required_object", "control directive must be an object");
    return issues.result();
  }
  if (value["schema_version"] !== CONTROL_DIRECTIVE_SCHEMA) {
    issues.add("schema_version", "unsupported_schema", `expected ${CONTROL_DIRECTIVE_SCHEMA}`);
  }
  requireString(issues, value, "control_id", { pattern: /^ctl_[A-Za-z0-9_-]+$/ });
  requireString(issues, value, "incident_id");
  requireString(issues, value, "policy_decision_id");
  requireString(issues, value, "issuer");
  requireIsoTimestamp(issues, value, "issued_at");
  requireIsoTimestamp(issues, value, "expires_at");
  const action = requireString(issues, value, "action");
  if (action && !DIRECTIVE_ACTION_ALLOWLIST[action]) {
    issues.add("action", "action_not_allowlisted", `"${action}" is not an allowlisted CSSA control action`);
  }
  const target = requireObject(issues, value, "target");
  if (target) {
    requireString(issues, target, "tenant_id", { prefix: "target" });
  }
  requireString(issues, value, "scope");
  requireNumber(issues, value, "max_uses", { min: 1 });
  const approval = requireObject(issues, value, "approval");
  if (approval) {
    requireString(issues, approval, "level", { prefix: "approval" });
    requireString(issues, approval, "approval_id", { prefix: "approval" });
  }
  const rollback = requireObject(issues, value, "rollback");
  if (rollback) {
    if (typeof rollback["required"] !== "boolean") {
      issues.add("rollback.required", "required_boolean", "rollback requirement must be explicit");
    }
    requireString(issues, rollback, "action", { prefix: "rollback" });
  }
  if (!Array.isArray(value["reason_codes"]) || value["reason_codes"].length === 0) {
    issues.add("reason_codes", "required_array", "reason codes are required");
  }
  const integrity = requireObject(issues, value, "integrity");
  if (integrity) {
    requireString(issues, integrity, "algorithm", { prefix: "integrity" });
    requireString(issues, integrity, "key_id", { prefix: "integrity" });
    requireString(issues, integrity, "signature", { prefix: "integrity" });
  }
  // Critical unknown fields are a rejection condition (07 §9).
  for (const key of Object.keys(value)) {
    if (!DIRECTIVE_FIELDS.has(key)) {
      issues.add(key, "unknown_critical_field", `unknown directive field "${key}"; rejecting rather than guessing`);
    }
  }
  return issues.result();
}
