import { Issues, isRecord, requireBoolean, requireIsoTimestamp, requireNumber, requireString, type ValidationResult } from "./common.js";

/**
 * Reviewed feedback labels (04). Operator action is a receipt, not an
 * immediate label (ADR-012); a record enters training only when explicitly
 * eligible (ADR-004).
 */
export const FEEDBACK_LABELS = [
  "confirmed_true_positive",
  "confirmed_false_positive",
  "benign_expected_change",
  "duplicate",
  "insufficient_evidence",
  "policy_correct_model_wrong",
  "model_correct_policy_wrong",
  "action_effective",
  "action_ineffective",
  "action_harmful",
  "unknown",
] as const;
export type FeedbackLabelValue = (typeof FEEDBACK_LABELS)[number];

/**
 * Signal-origin separation for calibration (05): policy-caused effects are
 * tracked apart from natural behavior and never auto-confirm a hypothesis.
 */
export interface CalibrationSignalOrigins {
  origin_signal: boolean;
  standing_policy_effect: boolean;
  sentinel_control_effect: boolean;
  operator_effect: boolean;
  rollback_effect: boolean;
  later_external_outcome: boolean;
}

export interface FeedbackLabel {
  label_id: string;
  incident_id: string;
  incident_version: number;
  label: FeedbackLabelValue;
  reviewer: string;
  confidence: number;
  reason: string;
  evidence_available_at_review: string[];
  signal_origins: CalibrationSignalOrigins;
  privacy_approved: boolean;
  calibration_eligible: boolean;
  training_eligible: boolean;
  dataset_version?: string;
  reviewed_at: string;
}

export function validateFeedbackLabel(value: unknown): ValidationResult {
  const issues = new Issues();
  if (!isRecord(value)) {
    issues.add("", "required_object", "feedback label must be an object");
    return issues.result();
  }
  requireString(issues, value, "label_id", { pattern: /^lbl_[A-Za-z0-9_-]+$/ });
  requireString(issues, value, "incident_id");
  requireString(issues, value, "label", { enum: FEEDBACK_LABELS });
  requireString(issues, value, "reviewer");
  requireNumber(issues, value, "confidence", { min: 0, max: 1 });
  requireString(issues, value, "reason");
  requireBoolean(issues, value, "privacy_approved");
  requireBoolean(issues, value, "calibration_eligible");
  requireBoolean(issues, value, "training_eligible");
  requireIsoTimestamp(issues, value, "reviewed_at");
  const trainingEligible = value["training_eligible"];
  const privacyApproved = value["privacy_approved"];
  if (trainingEligible === true && privacyApproved !== true) {
    issues.add("training_eligible", "training_without_privacy", "a label cannot be training-eligible without privacy approval (ADR-004)");
  }
  if (!isRecord(value["signal_origins"])) {
    issues.add("signal_origins", "required_object", "signal origin separation is mandatory for calibration (05)");
  }
  return issues.result();
}
