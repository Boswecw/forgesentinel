import { createHmac, randomUUID } from "node:crypto";
import { hashPayload } from "../contracts/common.js";
import type { EventEnvelope, EventDataPolicy, ControlLineage } from "../contracts/envelope.js";
import { lookupEventType } from "../contracts/families.js";
import type { ProducerRegistration, ProducerCredential } from "./producers.js";
import { producerToken } from "./producers.js";

export interface BuildEventInput {
  event_id?: string;
  event_type: string;
  occurred_at: string;
  observed_at?: string;
  tenant?: { tenant_id: string; account_id?: string };
  actor: EventEnvelope["actor"];
  subject: EventEnvelope["subject"];
  resource?: EventEnvelope["resource"];
  correlation?: Partial<EventEnvelope["correlation"]>;
  location?: Partial<EventEnvelope["location"]>;
  payload: Record<string, unknown>;
  data_policy?: Partial<EventDataPolicy>;
  control_lineage?: ControlLineage;
}

/** Builds a contract-complete envelope, hashing and signing on behalf of a producer. */
export function buildEvent(producer: ProducerRegistration, input: BuildEventInput): { event: EventEnvelope; credential: ProducerCredential } {
  const payloadHash = hashPayload(input.payload);
  const familyEntry = lookupEventType(input.event_type);
  const signatureRequired = producer.signature_required || familyEntry?.signature_required === true;
  const event: EventEnvelope = {
    event_id: input.event_id ?? `evt_${randomUUID().replaceAll("-", "")}`,
    event_type: input.event_type,
    schema_version: "1.0.0",
    occurred_at: input.occurred_at,
    observed_at: input.observed_at ?? input.occurred_at,
    producer: {
      service: producer.service,
      instance_id: `${producer.service}-01`,
      version: "1.0.0",
      environment: producer.environment,
    },
    ...(input.tenant !== undefined ? { tenant: input.tenant } : {}),
    actor: input.actor,
    subject: input.subject,
    ...(input.resource !== undefined ? { resource: input.resource } : {}),
    correlation: { trace_id: input.correlation?.trace_id ?? `trc_${randomUUID().slice(0, 8)}`, ...input.correlation },
    location: { execution_lane: "cloud", ...input.location },
    payload: input.payload,
    data_policy: {
      content_included: false,
      sensitivity: "internal",
      retention_class: "security_365d",
      cloud_allowed: true,
      ...input.data_policy,
    },
    integrity: {
      payload_hash: payloadHash,
      idempotency_key: input.event_id ?? payloadHash,
      ...(signatureRequired
        ? {
            signature: createHmac("sha256", producer.secret).update(payloadHash, "utf8").digest("hex"),
            signature_key_id: producer.key_id,
          }
        : {}),
    },
    ...(input.control_lineage !== undefined ? { control_lineage: input.control_lineage } : {}),
  };
  return {
    event,
    credential: { service: producer.service, key_id: producer.key_id, token: producerToken(producer.secret, payloadHash) },
  };
}
