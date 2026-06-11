import {
  Issues,
  isRecord,
  requireNumber,
  requireObject,
  requireString,
  type ValidationResult,
} from "./common.js";

export interface EvidenceQuality {
  score: number;
  completeness: number;
  freshness: number;
  integrity: number;
  source_reliability: number;
}

export interface EvidenceRecord {
  evidence_id: string;
  source_event_ids: string[];
  evidence_type: "validated_event" | "derived_feature" | "correlation" | "receipt" | "external";
  feature_definition?: string;
  value?: number | string | boolean;
  unit?: string;
  scope: Record<string, string>;
  window?: { start: string; end: string };
  quality: EvidenceQuality;
  created_by: { component: string; version: string };
  /**
   * Root event grouping key used for independence accounting: multiple
   * transformations of one source event share a root and never count as
   * separate corroboration (03 Prime anti-patterns).
   */
  source_event_root: string;
  /** ADR-022: evidence caused by a Sentinel control is never independent proof. */
  policy_generated_effect: boolean;
}

const EVIDENCE_TYPES = ["validated_event", "derived_feature", "correlation", "receipt", "external"] as const;

export function validateEvidenceRecord(value: unknown): ValidationResult {
  const issues = new Issues();
  if (!isRecord(value)) {
    issues.add("", "required_object", "evidence record must be an object");
    return issues.result();
  }
  requireString(issues, value, "evidence_id", { pattern: /^evd_[A-Za-z0-9_-]+$/ });
  if (!Array.isArray(value["source_event_ids"]) || value["source_event_ids"].length === 0) {
    issues.add("source_event_ids", "required_array", "evidence must reference at least one source event");
  }
  requireString(issues, value, "evidence_type", { enum: EVIDENCE_TYPES });
  requireString(issues, value, "source_event_root");
  if (typeof value["policy_generated_effect"] !== "boolean") {
    issues.add("policy_generated_effect", "required_boolean", "policy_generated_effect must be explicit (ADR-022)");
  }
  if (!isRecord(value["scope"])) {
    issues.add("scope", "required_object", "evidence scope must be an object");
  }
  const quality = requireObject(issues, value, "quality");
  if (quality) {
    for (const field of ["score", "completeness", "freshness", "integrity", "source_reliability"]) {
      requireNumber(issues, quality, field, { prefix: "quality", min: 0, max: 1 });
    }
  }
  const createdBy = requireObject(issues, value, "created_by");
  if (createdBy) {
    requireString(issues, createdBy, "component", { prefix: "created_by" });
    requireString(issues, createdBy, "version", { prefix: "created_by" });
  }
  return issues.result();
}
