import {
  Issues,
  isRecord,
  requireObject,
  requireString,
  validateRiskDimensions,
  type RiskDimensions,
  type ValidationResult,
} from "./common.js";

/** Lifecycle from 09_FORGE_COMMAND_INCIDENT_UX. */
export const INCIDENT_STATUSES = [
  "open",
  "acknowledged",
  "investigating",
  "action_pending",
  "contained",
  "monitoring",
  "resolved",
  "dismissed",
  "reopened",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[number];

export interface IncidentBriefing {
  issue: string;
  where: string;
  recommended_fix: string;
  why_now: string;
}

export interface RecommendedAction {
  action_type: string;
  target_id: string;
  scope: string;
  reversible: boolean;
  approval: "policy_allowed" | "single_operator" | "elevated_operator" | "two_person" | "business_owner" | "security_owner" | "customer_confirmation" | "emergency_policy";
}

export interface Incident {
  incident_id: string;
  title: string;
  incident_type: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  origin: string[];
  subject: { tenant_id: string; account_id?: string; [key: string]: string | undefined };
  risk: RiskDimensions;
  briefing: IncidentBriefing;
  finding_ids: string[];
  evidence_ids: string[];
  /** Count of distinct evidence roots, excluding policy-generated effects. */
  independent_signal_count: number;
  /** Signal finding types present, for policy includes_signal matching. */
  signals: string[];
  required_authority: string[];
  recommended_actions: RecommendedAction[];
  playbook?: string;
  /** Node disagreement and missing telemetry are preserved, never hidden. */
  conflicts: string[];
  missing_telemetry: string[];
  version: number;
  created_at: string;
  updated_at: string;
  status_history: { status: IncidentStatus; at: string; reason?: string; actor?: string }[];
  reopened_from?: string;
}

export function validateIncident(value: unknown): ValidationResult {
  const issues = new Issues();
  if (!isRecord(value)) {
    issues.add("", "required_object", "incident must be an object");
    return issues.result();
  }
  requireString(issues, value, "incident_id", { pattern: /^inc_[A-Za-z0-9_-]+$/ });
  requireString(issues, value, "title");
  requireString(issues, value, "incident_type");
  requireString(issues, value, "status", { enum: INCIDENT_STATUSES });
  requireString(issues, value, "priority", { enum: INCIDENT_PRIORITIES });
  if (!Array.isArray(value["origin"]) || value["origin"].length === 0) {
    issues.add("origin", "required_array", "incident origin sources are required");
  }
  const subject = requireObject(issues, value, "subject");
  if (subject) {
    requireString(issues, subject, "tenant_id", { prefix: "subject" });
  }
  issues.merge(validateRiskDimensions(value["risk"], "risk"));
  const briefing = requireObject(issues, value, "briefing");
  if (briefing) {
    for (const field of ["issue", "where", "recommended_fix", "why_now"]) {
      requireString(issues, briefing, field, { prefix: "briefing" });
    }
  }
  if (!Array.isArray(value["finding_ids"]) || value["finding_ids"].length === 0) {
    issues.add("finding_ids", "required_array", "incident must reference its findings");
  }
  if (!Array.isArray(value["evidence_ids"]) || value["evidence_ids"].length === 0) {
    issues.add("evidence_ids", "required_array", "incident must be reconstructable from evidence");
  }
  if (typeof value["independent_signal_count"] !== "number" || value["independent_signal_count"] < 0) {
    issues.add("independent_signal_count", "required_number", "independent_signal_count must be a non-negative number");
  }
  if (!Array.isArray(value["required_authority"]) || value["required_authority"].length === 0) {
    issues.add("required_authority", "required_array", "every incident names the authority that owns any response");
  }
  if (!Array.isArray(value["recommended_actions"])) {
    issues.add("recommended_actions", "required_array", "recommended_actions must be an array (may be empty for observe-only)");
  } else {
    for (const [index, action] of (value["recommended_actions"] as unknown[]).entries()) {
      if (!isRecord(action)) {
        issues.add(`recommended_actions[${index}]`, "required_object", "recommended action must be an object");
        continue;
      }
      requireString(issues, action, "action_type", { prefix: `recommended_actions[${index}]` });
      requireString(issues, action, "target_id", { prefix: `recommended_actions[${index}]` });
      requireString(issues, action, "scope", { prefix: `recommended_actions[${index}]` });
      if (typeof action["reversible"] !== "boolean") {
        issues.add(`recommended_actions[${index}].reversible`, "required_boolean", "reversibility must be explicit");
      }
    }
  }
  if (!Array.isArray(value["conflicts"])) {
    issues.add("conflicts", "required_array", "conflicts must be an array (conflict preservation is mandatory)");
  }
  if (!Array.isArray(value["missing_telemetry"])) {
    issues.add("missing_telemetry", "required_array", "missing telemetry must be visible, not hidden");
  }
  return issues.result();
}
