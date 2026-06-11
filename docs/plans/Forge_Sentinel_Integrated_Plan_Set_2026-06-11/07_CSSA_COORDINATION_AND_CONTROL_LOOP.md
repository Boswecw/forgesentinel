# Sentinel–CSSA Coordination and Control Loop

**Date:** June 11, 2026  
**Status:** Integrated architecture baseline  
**Applies to:** Forge Sentinel, ForgeAgents CSSA, Forge_Command, DataForge, Centipede, NeuroForge, NeuronForge, YellowJacket, Hermes, SMITH, Identity, Entitlements

## 1. Purpose

This document defines how Sentinel coordinates with the Cloud Service Security Authority without duplicating authority, adding unsafe request latency, or creating two competing incident systems.

The core doctrine is:

> CSSA prevents unsafe cloud execution. Sentinel discovers patterns that cannot be understood from one request. Policy converts Sentinel intelligence into bounded authority. CSSA enforces only authenticated policy. Forge_Command keeps the operator in control.

## 2. Canonical separation

### CSSA

CSSA is deterministic and request-bound. It owns:

- principal, executor, delegation, tenant, and app resolution
- entitlement validation
- atomic quota reservation
- request and response classification
- required redaction
- provider, model, action, and tool-chain eligibility
- rollout mode
- single-use authorization
- governed egress
- immutable authorization and outcome truth

### Sentinel

Sentinel is historical and correlation-bound. It owns:

- scoped baselines
- robust change detection
- evidence quality
- cross-request and cross-service correlation
- node findings
- compound hypotheses
- risk dimensions
- incident briefing
- recommendations
- calibration and governed learning

### Forge_Command

Forge_Command owns:

- operator review
- approval, denial, defer, dismiss, escalation
- incident lifecycle
- exceptional high-impact confirmation
- rollback initiation
- completed incident stubs
- policy and model governance visibility

## 3. One-way evidence path

```text
CSSA Gate
→ immutable decision
→ immutable authorization
→ GovernedEgressBroker
→ immutable outcome
→ DataForge
→ Sentinel adapter
→ canonical event/evidence
→ specialized node
→ Sentinel Prime
→ incident
```

Sentinel never changes an event's original meaning. The adapter records transformation version and source hash.

## 4. Two-way governed control path

```text
Sentinel incident
→ deterministic policy evaluation
→ required approval
→ signed CloudSecurityControlDirective
→ CSSA directive validation
→ CSSA normal gate evaluation
→ action/outcome receipt
→ Sentinel monitoring
```

A control directive is a policy artifact, not a command from a model.

## 5. CSSA source records

Minimum CSSA records exposed to Sentinel:

- decision ID and policy bundle identity
- authorization ID and state
- outcome ID and execution state
- principal/executor/delegation references
- tenant/app/service/action
- provider/model/fingerprint
- request/response digest
- R-class and redaction result
- quota reservation and commit state
- cost and usage
- reason codes
- correlation, operation, attempt, and parent-attempt IDs
- integrity hashes/signatures
- rollout mode
- control lineage

Raw R3/R4 content is excluded by default.

## 6. CSSA watchdog

The CSSA watchdog detects edge conditions that belong near the enforcement boundary:

- replay
- signature/hash integrity failure
- broker bypass
- recorder backlog
- quota reservation leakage
- absolute cost/call ceiling
- short-window deny streak
- unknown provider/action registration

It emits `CloudSecurityFinding.v1`.

Sentinel may correlate that finding with identity, agent, provider, license, cost, and data evidence. Sentinel Prime decides whether an ecosystem incident is formed.

## 7. Finding and incident ownership

```text
CSSA finding status:
created → expired/superseded

Sentinel incident status:
open → acknowledged → investigating → action pending
→ contained → monitoring → resolved/dismissed/reopened
```

CSSA does not own incident lifecycle after emission. Forge_Command does not rewrite CSSA authorization or outcome truth.

## 8. Control directive contract

```json
{
  "schema_version": "cloud_security.control_directive.v1",
  "control_id": "ctl_01...",
  "incident_id": "inc_01...",
  "policy_decision_id": "pdec_01...",
  "issuer": "forge-command-policy",
  "issued_at": "ISO-8601",
  "expires_at": "ISO-8601",
  "action": "cssa.executor_service.hold",
  "target": {
    "tenant_id": "ten_...",
    "principal_id": "usr_...",
    "executor_id": "agt_...",
    "app_id": "authorforge",
    "cloud_service": "neuroforge",
    "provider": "provider_a",
    "model_fingerprint": "sha256:..."
  },
  "scope": "single_executor_single_service",
  "max_uses": 1,
  "approval": {
    "level": "single_operator",
    "approval_id": "apr_..."
  },
  "rollback": {
    "required": true,
    "action": "cssa.executor_service.release",
    "restore_state_ref": "state_..."
  },
  "reason_codes": ["SENTINEL_AGENT_DRIFT"],
  "integrity": {
    "algorithm": "ed25519",
    "key_id": "key_...",
    "signature": "base64:..."
  }
}
```

## 9. Validation rules

CSSA rejects a directive when:

- issuer or key is unknown
- signature is invalid
- directive is expired
- target or action changed after signing
- use count is exhausted
- incident or policy reference is absent
- scope is wider than the action allows
- rollback is required but unavailable
- target crosses tenant boundaries
- critical unknown fields exist
- current standing policy always denies the requested control

## 10. Initial allowlisted controls

Start with narrow reversible controls:

| Control | Default approval | Maximum scope |
|---|---|---|
| Hold one executor/service route | single operator | one executor + one service |
| Require approval for one action | policy allowed | one principal/action |
| Deny one model fingerprint/category | elevated operator | one fingerprint + category |
| Lower retry ceiling | policy allowed | one route |
| Require redaction | policy allowed | one action/data class |
| Temporarily block one destination | single operator | one destination + tenant |
| Require reauthentication | identity policy | one account |

Permanent commercial penalties, data deletion, source mutation, or broad account termination are never CSSA control directives.

## 11. Feedback-loop prevention

All CSSA records affected by a directive contain:

```text
control_id
incident_id
policy_decision_id
control_origin
policy_generated_effect
```

Sentinel groups these under the original control root. A deny caused by a Sentinel control may prove that enforcement worked, but it is not independent proof that the incident hypothesis was true.

## 12. NeuroForge relationship

```text
CSSA hard eligibility
∩ Sentinel incident restrictions
∩ NeuroForge supported routes
= eligible candidate set

NeuroForge EMA/trust utility
→ selected route
```

NeuroForge cannot restore a provider or model denied by CSSA. Sentinel cannot independently authorize a provider. CSSA cannot choose the economically optimal route.

## 13. DataForge and Centipede

DataForge stores immutable CSSA records and Sentinel evidence. Centipede:

- imports evidence bundles
- reconciles delayed/offline records
- preserves chain of custody
- links source attempts to findings and incidents
- supports deterministic replay
- projects Self-Healing evidence without claiming repair safety

## 14. Degraded modes

### Sentinel unavailable

CSSA continues deterministic enforcement. New cross-domain prediction and correlation pause.

### CSSA watchdog unavailable

CSSA gate and broker continue. Sentinel records a coverage gap and does not raise confidence from missing evidence.

### DataForge unavailable

CSSA strict actions require durable outbox/persistence according to CSSA law. Sentinel destructive recommendations remain disabled without durable receipts.

### Forge_Command unavailable

Controls requiring operator approval do not proceed. Existing signed controls expire normally. Emergency policy remains narrow and pre-approved.

### Policy signer unavailable

No new Sentinel-originated CSSA controls are issued.

## 15. Unified operator experience

One Forge_Command incident contains:

- original request behavior
- CSSA decision and reason codes
- authorization/outcome records
- Sentinel node findings
- Prime hypothesis
- recommended control
- approval
- CSSA enforcement result
- monitoring
- rollback
- final reviewed label

## 16. Implementation sequence

1. Approve authority and lifecycle boundaries.
2. Add CSSA event mappings and source finding.
3. Add mandatory lineage fields.
4. Run evidence ingestion and correlation in shadow.
5. Implement directive schema and signer.
6. Implement CSSA directive registry/validator.
7. Enable one reversible control in canary.
8. Exercise expiry and rollback.
9. Add unified Forge_Command timeline.
10. Add calibration separation and AAR.

## 17. Exit gates

Coordination is production-ready only when:

- Sentinel can be removed without weakening CSSA.
- CSSA findings cannot seize incident lifecycle.
- Raw incidents cannot affect CSSA decisions.
- A signed directive cannot be widened or replayed.
- Every control effect is traceable.
- Policy-generated effects are not double-counted.
- Rollback is exercised.
- Raw protected content stays within its allowed boundary.
- Forge_Command reconstructs the complete chain.
