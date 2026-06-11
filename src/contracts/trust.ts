import { Issues, isRecord, requireNumber, requireObject, requireString, type ValidationResult } from "./common.js";

/**
 * Immutable route identity (08). Aliases are not identities (ADR-006):
 * material change emits a fingerprint-change finding and resets trust.
 */
export interface ModelFingerprint {
  fingerprint_id: string;
  provider: string;
  endpoint: string;
  region: string;
  declared_model_name: string;
  provider_model_id: string;
  snapshot: string;
  weights_fingerprint?: string;
  context_window: number;
  tool_configuration: string;
  structured_output_mode: string;
  prompt_bundle_hash: string;
  gateway_version: string;
  first_seen_at: string;
}

export const TRUST_STATES = ["provisional", "normal", "reduced", "quarantined", "challenger"] as const;
export type TrustState = (typeof TRUST_STATES)[number];

/**
 * No global trust score (ADR-005): trust is scoped by provider, fingerprint,
 * task category, route class, and evaluation window, with separate
 * dimensions.
 */
export interface TrustVector {
  provider: string;
  model_snapshot: string;
  fingerprint_id: string;
  task_category: string;
  route_class: string;
  tool_profile: string;
  repository_class?: string;
  evaluation_suite: string;
  window: string;
  state: TrustState;
  dimensions: {
    reliability: number;
    task_success: number;
    evaluation_quality: number;
    latency_score: number;
    cost_efficiency: number;
    security_compliance: number;
    privacy_compatibility: number;
    contract_validity: number;
    tool_policy_compliance: number;
    rollback_risk: number;
    availability: number;
    evidence_quality: number;
  };
}

const TRUST_DIMENSION_FIELDS = [
  "reliability",
  "task_success",
  "evaluation_quality",
  "latency_score",
  "cost_efficiency",
  "security_compliance",
  "privacy_compatibility",
  "contract_validity",
  "tool_policy_compliance",
  "rollback_risk",
  "availability",
  "evidence_quality",
] as const;

export function validateTrustVector(value: unknown): ValidationResult {
  const issues = new Issues();
  if (!isRecord(value)) {
    issues.add("", "required_object", "trust vector must be an object");
    return issues.result();
  }
  for (const field of ["provider", "model_snapshot", "fingerprint_id", "task_category", "route_class", "tool_profile", "evaluation_suite", "window"]) {
    requireString(issues, value, field);
  }
  requireString(issues, value, "state", { enum: TRUST_STATES });
  const dimensions = requireObject(issues, value, "dimensions");
  if (dimensions) {
    for (const field of TRUST_DIMENSION_FIELDS) {
      requireNumber(issues, dimensions, field, { prefix: "dimensions", min: 0, max: 1 });
    }
  }
  return issues.result();
}

export function fingerprintMaterialChange(a: ModelFingerprint, b: ModelFingerprint): string[] {
  const changed: string[] = [];
  for (const field of ["provider", "endpoint", "provider_model_id", "snapshot", "weights_fingerprint", "tool_configuration", "structured_output_mode", "prompt_bundle_hash"] as const) {
    if (a[field] !== b[field]) changed.push(field);
  }
  return changed;
}
