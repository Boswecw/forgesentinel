import {
  Issues,
  isRecord,
  requireBoolean,
  requireIsoTimestamp,
  requireObject,
  requireString,
  type ValidationResult,
} from "./common.js";
import { checkSchemaVersion } from "./version.js";
import { lookupEventType } from "./families.js";

export const EVENT_ENVELOPE_SUPPORTED_MAJOR = 1;
export const EVENT_ENVELOPE_VERSION = "1.0.0";

export const ENVIRONMENTS = ["production", "staging", "development", "test", "local"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const ACTOR_TYPES = ["user", "agent", "service", "operator", "system"] as const;
export const EXECUTION_LANES = ["local", "cloud"] as const;
export type ExecutionLane = (typeof EXECUTION_LANES)[number];

export const SENSITIVITY_CLASSES = ["public", "internal", "confidential", "restricted", "regulated"] as const;
export type Sensitivity = (typeof SENSITIVITY_CLASSES)[number];

export const RETENTION_CLASSES = [
  "transient_7d",
  "ops_30d",
  "security_365d",
  "billing_contract",
  "incident_extended",
  "local_user_controlled",
] as const;
export type RetentionClass = (typeof RETENTION_CLASSES)[number];

export interface EventProducer {
  service: string;
  instance_id: string;
  version: string;
  environment: Environment;
}

export interface EventActor {
  actor_type: (typeof ACTOR_TYPES)[number];
  actor_id: string;
  session_id?: string;
  api_key_fingerprint?: string;
}

export interface EventSubject {
  subject_type: string;
  subject_id: string;
}

export interface EventResource {
  resource_type: string;
  resource_id: string;
  classification?: Sensitivity;
}

export interface EventCorrelation {
  trace_id: string;
  run_id?: string;
  parent_event_id?: string;
}

export interface EventLocation {
  execution_lane: ExecutionLane;
  region?: string;
  country?: string;
}

export interface EventDataPolicy {
  content_included: boolean;
  sensitivity: Sensitivity;
  retention_class: RetentionClass;
  cloud_allowed: boolean;
}

export interface EventIntegrity {
  payload_hash: string;
  idempotency_key: string;
  signature?: string;
  signature_key_id?: string;
}

/**
 * Mandatory lineage for any event affected by a Sentinel-originated control
 * (ADR-022). Lineage prevents policy-produced effects from being counted as
 * independent confirmation of the original incident hypothesis.
 */
export interface ControlLineage {
  control_origin: "sentinel_policy" | "standing_policy" | "operator";
  sentinel_incident_id?: string;
  sentinel_finding_ids?: string[];
  policy_decision_id?: string;
  control_id?: string;
  policy_generated_effect: boolean;
}

export interface EventEnvelope {
  event_id: string;
  event_type: string;
  schema_version: string;
  occurred_at: string;
  observed_at: string;
  producer: EventProducer;
  tenant?: { tenant_id: string; account_id?: string };
  actor: EventActor;
  subject: EventSubject;
  resource?: EventResource;
  correlation: EventCorrelation;
  location: EventLocation;
  payload: Record<string, unknown>;
  data_policy: EventDataPolicy;
  integrity: EventIntegrity;
  control_lineage?: ControlLineage;
}

const PAYLOAD_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function validateEventEnvelope(value: unknown): ValidationResult {
  const issues = new Issues();
  if (!isRecord(value)) {
    issues.add("", "required_object", "event envelope must be an object");
    return issues.result();
  }

  requireString(issues, value, "event_id", { pattern: /^evt_[A-Za-z0-9_-]+$/ });
  const eventType = requireString(issues, value, "event_type");
  issues.merge(checkSchemaVersion(value["schema_version"], EVENT_ENVELOPE_SUPPORTED_MAJOR));
  const occurredAt = requireIsoTimestamp(issues, value, "occurred_at");
  const observedAt = requireIsoTimestamp(issues, value, "observed_at");
  if (occurredAt && observedAt && Date.parse(observedAt) < Date.parse(occurredAt)) {
    issues.add("observed_at", "clock_order", "observed_at precedes occurred_at; clock skew must be explicit evidence, not silently reordered");
  }

  const producer = requireObject(issues, value, "producer");
  if (producer) {
    requireString(issues, producer, "service", { prefix: "producer" });
    requireString(issues, producer, "instance_id", { prefix: "producer" });
    requireString(issues, producer, "version", { prefix: "producer" });
    requireString(issues, producer, "environment", { prefix: "producer", enum: ENVIRONMENTS });
  }

  const familyEntry = eventType ? lookupEventType(eventType) : undefined;
  if (eventType && !familyEntry) {
    issues.add("event_type", "unknown_event_type", `"${eventType}" is not a canonical event type; register an adapter mapping instead of emitting ad hoc telemetry`);
  }

  const tenant = value["tenant"];
  if (familyEntry?.tenant_scoped) {
    if (!isRecord(tenant)) {
      issues.add("tenant", "tenant_required", `event family "${familyEntry.family}" is tenant-scoped and requires tenant.tenant_id`);
    } else {
      requireString(issues, tenant, "tenant_id", { prefix: "tenant" });
    }
  } else if (tenant !== undefined && !isRecord(tenant)) {
    issues.add("tenant", "required_object", "tenant must be an object when present");
  }

  const actor = requireObject(issues, value, "actor");
  if (actor) {
    requireString(issues, actor, "actor_type", { prefix: "actor", enum: ACTOR_TYPES });
    requireString(issues, actor, "actor_id", { prefix: "actor" });
  }

  const subject = requireObject(issues, value, "subject");
  if (subject) {
    requireString(issues, subject, "subject_type", { prefix: "subject" });
    requireString(issues, subject, "subject_id", { prefix: "subject" });
  }

  const correlation = requireObject(issues, value, "correlation");
  if (correlation) {
    requireString(issues, correlation, "trace_id", { prefix: "correlation" });
  }

  const location = requireObject(issues, value, "location");
  if (location) {
    requireString(issues, location, "execution_lane", { prefix: "location", enum: EXECUTION_LANES });
  }

  if (!isRecord(value["payload"])) {
    issues.add("payload", "required_object", 'field "payload" must be an object (use {} when empty)');
  }

  const dataPolicy = requireObject(issues, value, "data_policy");
  let sensitivity: string | undefined;
  let contentIncluded: boolean | undefined;
  let cloudAllowed: boolean | undefined;
  if (dataPolicy) {
    contentIncluded = requireBoolean(issues, dataPolicy, "content_included", "data_policy");
    sensitivity = requireString(issues, dataPolicy, "sensitivity", { prefix: "data_policy", enum: SENSITIVITY_CLASSES });
    requireString(issues, dataPolicy, "retention_class", { prefix: "data_policy", enum: RETENTION_CLASSES });
    cloudAllowed = requireBoolean(issues, dataPolicy, "cloud_allowed", "data_policy");
  }
  // Restricted raw content is prohibited from cloud telemetry by default
  // (10_THREAT_DATA_PRIVACY_AND_AUDIT data classes). A producer asserting
  // otherwise is emitting a forbidden combination, not expressing a policy.
  if (sensitivity === "restricted" && contentIncluded === true && cloudAllowed === true) {
    issues.add("data_policy", "forbidden_content_policy", "restricted content cannot be marked cloud_allowed; use metadata/hash references instead");
  }

  const integrity = requireObject(issues, value, "integrity");
  if (integrity) {
    requireString(issues, integrity, "payload_hash", { prefix: "integrity", pattern: PAYLOAD_HASH_PATTERN });
    requireString(issues, integrity, "idempotency_key", { prefix: "integrity" });
  }

  const lineage = value["control_lineage"];
  if (lineage !== undefined) {
    if (!isRecord(lineage)) {
      issues.add("control_lineage", "required_object", "control_lineage must be an object when present");
    } else {
      requireString(issues, lineage, "control_origin", {
        prefix: "control_lineage",
        enum: ["sentinel_policy", "standing_policy", "operator"],
      });
      requireBoolean(issues, lineage, "policy_generated_effect", "control_lineage");
      if (lineage["control_origin"] === "sentinel_policy") {
        requireString(issues, lineage, "control_id", { prefix: "control_lineage" });
        requireString(issues, lineage, "sentinel_incident_id", { prefix: "control_lineage" });
        requireString(issues, lineage, "policy_decision_id", { prefix: "control_lineage" });
      }
    }
  }

  return issues.result();
}
