# Event, Evidence, and Incident Contracts


## 2026-06-11 CSSA Contract Mapping

### Canonical CSSA event families

```text
cssa.decision.evaluated
cssa.authorization.issued / denied / approval_pending / quarantined
cssa.authorization.consumed / replay_denied / expired
cssa.egress.started / completed / failed / cancelled / partially_delivered
cssa.quota.reserved / committed / released / expired / failed
cssa.classification.completed / failed
cssa.redaction.completed / failed
cssa.policy_bundle.accepted / rejected
cssa.control.accepted / rejected / applied / expired / rolled_back
cssa.recorder.backlog
cssa.broker.bypass_attempt
cssa.finding.created
```

### Required lineage fields

All events affected by a Sentinel-originated control include:

```json
{
  "control_origin": "sentinel_policy",
  "sentinel_incident_id": "inc_...",
  "sentinel_finding_ids": ["fnd_..."],
  "policy_decision_id": "pdec_...",
  "control_id": "ctl_...",
  "policy_generated_effect": true
}
```

This lineage prevents policy-produced denials from being miscounted as independent evidence that the original incident hypothesis was correct.

### CSSA source-finding adapter

`CloudSecurityFinding.v1` maps into the standard Sentinel finding contract while preserving the CSSA detector, immutable evidence references, threshold, policy bundle, hashes, and originating scope. Promotion into a Sentinel incident remains the responsibility of Sentinel Prime or a deterministic incident-formation rule.

## Contract-First Rule

No production Sentinel component consumes undocumented ad hoc telemetry. Producers either emit the canonical envelope or use a registered adapter. Contract changes require compatibility tests and a migration plan.

## Canonical Event Envelope

```json
{
  "event_id": "evt_01J...",
  "event_type": "neuroforge.inference.completed",
  "schema_version": "1.0.0",
  "occurred_at": "2026-06-09T17:15:42.188Z",
  "observed_at": "2026-06-09T17:15:42.421Z",
  "producer": {
    "service": "neuroforge",
    "instance_id": "nf-prod-us-east-1-03",
    "version": "4.2.0",
    "environment": "production"
  },
  "tenant": {"tenant_id": "ten_...", "account_id": "acct_..."},
  "actor": {
    "actor_type": "agent",
    "actor_id": "forge-smithy",
    "session_id": "ses_...",
    "api_key_fingerprint": "sha256:..."
  },
  "subject": {"subject_type": "model_route", "subject_id": "route_codefix_typecheck_v3"},
  "resource": {"resource_type": "repository", "resource_id": "repo_...", "classification": "confidential"},
  "correlation": {"trace_id": "trc_...", "run_id": "run_...", "parent_event_id": "evt_..."},
  "location": {"execution_lane": "cloud", "region": "us-east", "country": "US"},
  "payload": {},
  "data_policy": {
    "content_included": false,
    "sensitivity": "internal",
    "retention_class": "security_365d",
    "cloud_allowed": true
  },
  "integrity": {
    "payload_hash": "sha256:...",
    "signature": "base64:...",
    "signature_key_id": "key_...",
    "idempotency_key": "..."
  }
}
```

## Required Properties

- Producer, environment, tenant/system scope, actor, subject, and resource where relevant
- `occurred_at` and `observed_at`; clock skew is measurable evidence
- Trace/run/session/parent correlation
- Payload hash; signatures for high-value producers
- Sensitivity, content flag, retention, cloud eligibility, redaction state
- Unknown values remain explicit; components do not guess

## Canonical Event Families

### Identity

```text
identity.login.succeeded / failed
identity.mfa.challenged / completed
identity.session.created / revoked
identity.api_key.created / used / revoked
identity.device.registered / changed
identity.privilege.requested / denied
```

### NeuroForge and Models

```text
neuroforge.route.requested / selected
neuroforge.inference.started / completed / failed
neuroforge.fallback.used
neuroforge.champion.changed
neuroforge.challenger.evaluated
neuroforge.model_fingerprint.changed
neuroforge.contract.invalid
neuroforge.tool_call.requested / denied
```

### Agents

```text
agent.run.started / completed / failed
agent.tool.called
agent.permission.requested / denied
agent.patch.proposed / applied / rejected
agent.evaluation.completed
agent.rollback.completed
agent.boundary.violated
```

### Usage, Billing, License

```text
usage.tokens.recorded
usage.cost.estimated / finalized
usage.quota.threshold_reached / exceeded
usage.retry.recorded
usage.egress.recorded
billing.stripe.webhook_verified
billing.subscription.changed
license.entitlement.issued / validated / rejected
license.device.activated / deactivated
license.revalidation.required
license.feature.allowed / denied
```

### Data and Governance

```text
data.object.read / written / exported / imported / quarantined
data.redaction.completed / failed
data.retention.executed
data.cross_tenant.denied
data.integrity.failed
yellowjacket.admission.allowed / denied
hermes.execution.started / completed / failed
smith.proposal.created / approved / rejected
centipede.evidence.imported
operator.action.approved / denied
operator.override.recorded
```

### Sentinel

```text
sentinel.finding.created / expired
sentinel.incident.created / updated
sentinel.recommendation.created
sentinel.policy.evaluated
sentinel.action.requested / receipt
sentinel.calibration.label_created
sentinel.model.promoted / rolled_back
```

## Evidence Record

```json
{
  "evidence_id": "evd_...",
  "source_event_ids": ["evt_..."],
  "evidence_type": "derived_feature",
  "feature_definition": "cost.tokens_per_day.v2",
  "value": 15000000,
  "unit": "tokens/day",
  "scope": {"tenant_id": "ten_...", "actor_id": "user_...", "route_class": "general_cloud"},
  "window": {"start": "2026-06-08T00:00:00Z", "end": "2026-06-09T00:00:00Z"},
  "quality": {
    "score": 0.96,
    "completeness": 1.0,
    "freshness": 0.98,
    "integrity": 1.0,
    "source_reliability": 0.88
  },
  "created_by": {"component": "sentinel-feature-service", "version": "1.3.0"}
}
```

## Finding Contract

```json
{
  "finding_id": "fnd_...",
  "finding_type": "cost.usage_change_extreme",
  "node": {"name": "sentinel-cost", "version": "1.0.0"},
  "subject": {"type": "account", "id": "acct_..."},
  "window": {"start": "2026-06-01T00:00:00Z", "end": "2026-06-09T00:00:00Z"},
  "risk": {"likelihood": 0.74, "impact": 0.82, "confidence": 0.69, "evidence_quality": 0.95},
  "baseline": {"baseline_id": "base_...", "expected": 100000, "observed": 15000000, "change_ratio": 150.0},
  "evidence_ids": ["evd_1", "evd_2"],
  "explanation": {
    "summary": "Daily token usage increased 150x above the account baseline.",
    "top_factors": [
      {"factor": "usage_change_ratio", "contribution": 0.62},
      {"factor": "new_api_key", "contribution": 0.21}
    ],
    "uncertainties": ["The account may be running an approved bulk workload."]
  },
  "recommendation": {"action_class": "REQUEST_OPERATOR", "playbook": "PB-COST-COMPROMISE-01"},
  "expires_at": "2026-06-10T00:00:00Z"
}
```

## Incident Contract

```json
{
  "incident_id": "inc_443",
  "title": "Possible account compromise with rapid usage growth",
  "incident_type": "compound.account_compromise",
  "status": "open",
  "priority": "high",
  "origin": ["cloud", "sentinel-cost", "sentinel-cloud"],
  "subject": {"tenant_id": "ten_...", "account_id": "acct_..."},
  "risk": {"likelihood": 0.82, "impact": 0.88, "confidence": 0.81, "evidence_quality": 0.94},
  "briefing": {
    "issue": "Token usage increased 150x with a new API key, new region/device, and repeated login failures.",
    "where": "NeuroForge cloud route / account acct_...",
    "recommended_fix": "Pause only the new key, require MFA, and review the last 24 hours.",
    "why_now": "Independent weak signals now form a correlated compromise pattern."
  },
  "finding_ids": ["fnd_cost_...", "fnd_cloud_..."],
  "evidence_ids": ["evd_..."],
  "required_authority": ["identity_service", "forge_command_operator"],
  "recommended_actions": [
    {"action_type": "identity.api_key.pause", "target_id": "key_...", "reversible": true, "approval": "single_operator"},
    {"action_type": "identity.mfa.require", "target_id": "acct_...", "reversible": true, "approval": "policy_allowed"}
  ]
}
```

## Decision and Action Receipt

```json
{
  "receipt_id": "rcpt_...",
  "receipt_type": "sentinel.action",
  "incident_id": "inc_443",
  "decision": {
    "decision_id": "dec_...",
    "policy_id": "policy_account_compromise_v3",
    "policy_version": "3.1.0",
    "result": "ALLOW_BOUNDED_ACTION",
    "approver": {"type": "operator", "id": "op_..."}
  },
  "action": {
    "requested": "identity.api_key.pause",
    "executed": "identity.api_key.pause",
    "target_id": "key_...",
    "scope": "single_key",
    "result": "success"
  },
  "rollback": {"supported": true, "action_type": "identity.api_key.resume"},
  "integrity": {"hash": "sha256:...", "signature": "base64:..."}
}
```

## Feedback Labels

Operator action is not automatically ground truth. Reviewed labels include:

```text
confirmed_true_positive
confirmed_false_positive
benign_expected_change
duplicate
insufficient_evidence
policy_correct_model_wrong
model_correct_policy_wrong
action_effective
action_ineffective
action_harmful
unknown
```

Each label records reviewer, evidence available at review time, confidence, reason, incident version, privacy approval, calibration eligibility, training eligibility, and dataset version.

## Versioning

- Semantic versions for contracts
- Additive optional fields: minor version
- Meaning changes/removals: major version
- Consumers reject unknown major versions
- Original schema version is permanent
- Every supported producer version has replay fixtures
- Migrations preserve source hash and create receipts

## Idempotency and Deduplication

Use producer, native event ID, event type, subject, time bucket, and payload hash. Never collapse distinct security events because their text is similar. Prime may group them into one incident while preserving each evidence record.
