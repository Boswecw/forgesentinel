/**
 * Canonical event family registry (04_EVENT_EVIDENCE_AND_INCIDENT_CONTRACTS).
 * The gateway only accepts canonical types; native producer telemetry must
 * arrive through a registered adapter that maps onto one of these.
 */

export interface EventFamilyEntry {
  family: string;
  tenant_scoped: boolean;
  /** High-value producers must sign these events (02 trust boundaries). */
  signature_required: boolean;
}

const IDENTITY = ["identity.login.succeeded", "identity.login.failed", "identity.mfa.challenged", "identity.mfa.completed", "identity.session.created", "identity.session.revoked", "identity.api_key.created", "identity.api_key.used", "identity.api_key.revoked", "identity.device.registered", "identity.device.changed", "identity.privilege.requested", "identity.privilege.denied"];

const NEUROFORGE = ["neuroforge.route.requested", "neuroforge.route.selected", "neuroforge.inference.started", "neuroforge.inference.completed", "neuroforge.inference.failed", "neuroforge.fallback.used", "neuroforge.champion.changed", "neuroforge.challenger.evaluated", "neuroforge.model_fingerprint.changed", "neuroforge.contract.invalid", "neuroforge.tool_call.requested", "neuroforge.tool_call.denied"];

const AGENT = ["agent.run.started", "agent.run.completed", "agent.run.failed", "agent.tool.called", "agent.permission.requested", "agent.permission.denied", "agent.patch.proposed", "agent.patch.applied", "agent.patch.rejected", "agent.evaluation.completed", "agent.rollback.completed", "agent.boundary.violated"];

const USAGE_BILLING_LICENSE = ["usage.tokens.recorded", "usage.cost.estimated", "usage.cost.finalized", "usage.quota.threshold_reached", "usage.quota.exceeded", "usage.retry.recorded", "usage.egress.recorded", "billing.stripe.webhook_verified", "billing.subscription.changed", "license.entitlement.issued", "license.entitlement.validated", "license.entitlement.rejected", "license.device.activated", "license.device.deactivated", "license.revalidation.required", "license.feature.allowed", "license.feature.denied"];

const DATA_GOVERNANCE = ["data.object.read", "data.object.written", "data.object.exported", "data.object.imported", "data.object.quarantined", "data.redaction.completed", "data.redaction.failed", "data.retention.executed", "data.cross_tenant.denied", "data.integrity.failed", "yellowjacket.admission.allowed", "yellowjacket.admission.denied", "hermes.execution.started", "hermes.execution.completed", "hermes.execution.failed", "smith.proposal.created", "smith.proposal.approved", "smith.proposal.rejected", "centipede.evidence.imported", "operator.action.approved", "operator.action.denied", "operator.override.recorded"];

const SENTINEL = ["sentinel.finding.created", "sentinel.finding.expired", "sentinel.incident.created", "sentinel.incident.updated", "sentinel.recommendation.created", "sentinel.policy.evaluated", "sentinel.action.requested", "sentinel.action.receipt", "sentinel.calibration.label_created", "sentinel.model.promoted", "sentinel.model.rolled_back"];

const CSSA = ["cssa.decision.evaluated", "cssa.authorization.issued", "cssa.authorization.denied", "cssa.authorization.approval_pending", "cssa.authorization.quarantined", "cssa.authorization.consumed", "cssa.authorization.replay_denied", "cssa.authorization.expired", "cssa.egress.started", "cssa.egress.completed", "cssa.egress.failed", "cssa.egress.cancelled", "cssa.egress.partially_delivered", "cssa.quota.reserved", "cssa.quota.committed", "cssa.quota.released", "cssa.quota.expired", "cssa.quota.failed", "cssa.classification.completed", "cssa.classification.failed", "cssa.redaction.completed", "cssa.redaction.failed", "cssa.policy_bundle.accepted", "cssa.policy_bundle.rejected", "cssa.control.accepted", "cssa.control.rejected", "cssa.control.applied", "cssa.control.expired", "cssa.control.rolled_back", "cssa.recorder.backlog", "cssa.broker.bypass_attempt", "cssa.finding.created"];

const SIGNATURE_REQUIRED_FAMILIES = new Set(["billing", "license", "cssa", "sentinel", "operator", "hermes", "smith"]);
const SYSTEM_SCOPED_FAMILIES = new Set(["sentinel", "centipede", "yellowjacket"]);

function familyOf(eventType: string): string {
  return eventType.split(".", 1)[0] ?? eventType;
}

const REGISTRY = new Map<string, EventFamilyEntry>();
for (const eventType of [...IDENTITY, ...NEUROFORGE, ...AGENT, ...USAGE_BILLING_LICENSE, ...DATA_GOVERNANCE, ...SENTINEL, ...CSSA]) {
  const family = familyOf(eventType);
  REGISTRY.set(eventType, {
    family,
    tenant_scoped: !SYSTEM_SCOPED_FAMILIES.has(family),
    signature_required: SIGNATURE_REQUIRED_FAMILIES.has(family),
  });
}

export function lookupEventType(eventType: string): EventFamilyEntry | undefined {
  return REGISTRY.get(eventType);
}

export function isCanonicalEventType(eventType: string): boolean {
  return REGISTRY.has(eventType);
}

export function canonicalEventTypes(): string[] {
  return [...REGISTRY.keys()];
}
