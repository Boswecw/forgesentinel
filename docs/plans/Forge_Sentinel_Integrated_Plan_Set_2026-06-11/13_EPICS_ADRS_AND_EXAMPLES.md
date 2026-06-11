# Epics, ADRs, and Configuration Examples


## 2026-06-11 Added Epics

### SNT-115 CSSA Evidence Adapter

**Acceptance:** All CSSA record families map to canonical events; hashes and lineage survive; forbidden content is rejected; replay is deterministic.

### SNT-205 CSSA Finding Normalization

**Acceptance:** `CloudSecurityFinding.v1` becomes a source finding; legacy incidents cannot seize Sentinel lifecycle; Prime promotion is explicit.

### SNT-215 Signed Cloud Control Directives

**Acceptance:** Exact scope, issuer, signature, expiry, replay protection, rollback, and receipt are enforced; raw incident input cannot alter CSSA behavior.

### SNT-305 Unified CSSA/Sentinel Timeline

**Acceptance:** Forge_Command shows original behavior, CSSA decisions, Sentinel reasoning, approved controls, enforcement outcomes, and rollback in one case.

### SNT-405 Feedback-Loop Calibration

**Acceptance:** Policy-generated effects are excluded from independent evidence counts and tracked separately during calibration.

## Added ADRs

### ADR-019 CSSA Is the Cloud Enforcement Membrane

Sentinel does not join the per-request authorization hot path.

### ADR-020 CSSA Watchdog Emits Findings, Not Final Incidents

Forge_Command remains the sole incident-lifecycle owner after Sentinel formation.

### ADR-021 Incidents Do Not Grant Cloud Authority

Only authenticated policy bundles, approvals, entitlements, quota state, and signed control directives affect CSSA decisions.

### ADR-022 Control Effects Carry Mandatory Lineage

Sentinel-generated controls cannot create self-confirming evidence loops.

### ADR-023 NeuroForge Cannot Widen CSSA Eligibility

CSSA bounds the candidate set; Sentinel can narrow it through governance; NeuroForge optimizes inside it.

# Part I — Implementation Epics

## SNT-000 Contract Foundation

**Acceptance:** Event/evidence/finding/incident/policy/capability/receipt/feedback/fingerprint/trust contracts exist; major-version rejection works; Rust/TypeScript bindings share one source; golden fixtures and provenance exist.

## SNT-010 Event Gateway

**Acceptance:** Producer auth, tenant/schema validation, idempotency, hashes/signatures, explicit rejection, backpressure, version/environment recording.

## SNT-020 DataForge Evidence Ledger

**Acceptance:** Local/cloud field policy, immutable originals, linked corrections, mandatory retention, tenant isolation, replay, WAL reconciliation.

## SNT-030 Feature/Baseline Service

**Acceptance:** Versioned features, scoped baselines, cohort fallback, incident exclusion, change windows, replay, freshness/quality.

## SNT-100 Sentinel-Cost

**Acceptance:** Sudden/sustained growth, retry storm, cost-per-success regression, actor/key/route/model correlation, estimate/final separation, no permanent commercial action, Forge_Command briefing.

## SNT-110 Sentinel-Cloud

**Acceptance:** Identity/key/device/region events, compound compromise, novelty alone cannot suspend, scoped key pause, capability validation, MFA and rollback receipts.

## SNT-120 Sentinel-Agent

**Acceptance:** Version fingerprints, patch/boundary/denial detection, YellowJacket stop/quarantine, no direct patch, SMITH projection, sandbox replay.

## SNT-130 Sentinel-Provider

**Acceptance:** Fingerprint registry, alias detection, scoped trust vector, NeuroForge eligibility, shadow challenger, promotion/rollback receipts, sensitive-category policy.

## SNT-140 Sentinel-License

**Acceptance:** Signed entitlement authoritative, Stripe verification/idempotency, replay/activation/quota findings, revalidation, no permanent Sentinel revocation, offline behavior tested.

## SNT-150 Sentinel-Data

**Acceptance:** Classification and transfer policy, redaction evidence, cross-tenant denial, export/destination detection, no raw protected cloud telemetry by default, scoped block/rollback.

## SNT-200 Sentinel Prime

**Acceptance:** Correlation, evidence independence, no double-counting, conflicts, compound incidents, playbook/authority, reopen, outage safety.

## SNT-210 Policy Service

**Acceptance:** Versioned deterministic policies, always-deny actions, approvals, cooldown, narrow emergency policy, replay, no model-edited policy.

## SNT-220 Action/Receipt Service

**Acceptance:** Signed scoped capabilities, executor scope rejection, receipt for every attempt, before/after, rollback, rollback-failure incident, duplicate control.

## SNT-300 Forge_Command Page

**Acceptance:** Scannable list; issue/location/source/recommendation/authority/state; risk dimensions; evidence timeline; exact scope/rollback; completed stub; filters/search.

## SNT-310 Self-Healing/Centipede Handoff

**Acceptance:** Governed evidence export; advisory proposal; SMITH mutation authority; YellowJacket admission; Hermes execution; verification/receipts; no unsupported “safe” label.

## SNT-400 Feedback/Calibration

**Acceptance:** Operator decision separate from reviewed label; explicit training eligibility; dataset versions; per-class calibration; false-positive budget; challenger replay/shadow; rollback.

## Priority

- **P0:** SNT-000, 010, 020, 030, 100, 110, 210, 220, 300
- **P1:** SNT-120, 130, 140, 200, 310
- **P2:** SNT-150, 400 and production hardening

Sentinel-Data is later only because safe implementation depends on mature classification and tenant isolation.

---

# Part II — Architecture Decisions

## ADR-001 Separate Agents and Nodes

Agents collect/enforce locally; nodes correlate durably; authorities execute.

## ADR-002 Advisory by Default

Probabilistic detectors do not own high-impact permissions.

## ADR-003 DataForge Is Durable Evidence; Centipede Reconciles

Avoid a competing truth store.

## ADR-004 Events Are Not Automatic Training Data

Training requires eligibility, labeling, privacy, dataset, evaluation, and promotion.

## ADR-005 Trust Is Scoped and Multi-Dimensional

No global provider/model score.

## ADR-006 Model Aliases Are Not Identities

Record fingerprints and reset trust after material change.

## ADR-007 Prime Cannot Mutate Code

Repair routes through Centipede, Forge_Command, SMITH, YellowJacket, and Hermes.

## ADR-008 Enforcement Uses Scoped Capability Tokens

Executors validate exact action and target.

## ADR-009 Local/Cloud Evidence Remain Distinct

Detailed private evidence stays local by default; cloud receives approved metadata/summaries.

## ADR-010 Risk Dimensions Stay Separate

Likelihood, impact, confidence, and evidence quality are independent fields.

## ADR-011 Shadow Before Enforcement

New nodes/models/policies progress from replay to shadow to bounded actions.

## ADR-012 Overrides Are Receipts, Not Immediate Labels

Reviewed labeling is separate.

## ADR-013 Signed Entitlement and Verified Stripe State Are Authoritative

Sentinel detects anomalies but does not create commercial truth.

## ADR-014 Routing Remains in NeuroForge

Sentinel supplies trust/restrictions; NeuroForge selects routes.

## ADR-015 Forge_Command Is Operator Control Surface

Public customer traffic does not depend on the desktop UI.

## ADR-016 Every Action Is Reconstructable

Decision, action, rollback, and outcome receipts are durable.

## ADR-017 Sentinel Cannot Declare Its Policy Changes Safe

External governance and replay are mandatory.

## ADR-018 Deterministic Methods Lead the MVP

Complex ML waits for high-quality labels and demonstrated value.

## Open Decisions

- Gateway repository/service boundary
- Modular monolith vs separate node deployables
- Canonical schema and binding generator
- DataForge physical table strategy
- Local producer signing method
- Capability format/key ownership
- Incident-ID mapping to Centipede/Self-Healing
- Identity service ownership for keys/sessions
- Stripe-to-entitlement reconciliation service
- First Class 2 automated playbooks

---

# Part III — Examples

## Node Registration

```yaml
node:
  id: sentinel-cost
  version: 1.0.0
  service_identity: svc_sentinel_cost
subscriptions:
  - usage.tokens.recorded
  - usage.cost.estimated
  - usage.cost.finalized
  - usage.retry.recorded
  - identity.api_key.created
  - neuroforge.route.selected
  - neuroforge.inference.completed
data_access:
  raw_content: false
  tenant_scope: required
outputs:
  finding_contract: sentinel.finding.v1
  signed: true
```

## Feature Definition

```yaml
feature_id: cost.tokens_per_day
version: 2.0.0
source_events: [usage.tokens.recorded]
scope: [tenant_id, account_id, route_class]
window: {type: rolling, duration: 24h, lateness_allowance: 15m}
aggregation: {operation: sum, field: payload.total_tokens}
privacy: {stores_content: false, cloud_allowed: true, retention_class: security_365d}
```

## Baseline

```yaml
baseline_id: cost.account_daily_usage
version: 1.1.0
feature: cost.tokens_per_day@2.0.0
scope_priority:
  - [tenant_id, account_id, route_class, day_of_week]
  - [tenant_id, account_id, route_class]
  - [tenant_id, route_class]
  - [product_cohort, route_class]
method:
  type: robust_seasonal
  minimum_samples: 21
  center: median
  dispersion: median_absolute_deviation
  ema_alpha: 0.15
protections:
  exclude_active_incidents: true
  max_single_window_influence: 0.05
  freeze_on_confirmed_compromise: true
```

## Prime Correlation

```yaml
correlation_id: prime.account_compromise_compound
version: 1.0.0
subject_key: [tenant_id, account_id]
window: 2h
supporting:
  - {finding_type: cloud.new_api_key, weight: 0.25}
  - {finding_type: cloud.new_region, weight: 0.20}
  - {finding_type: cloud.new_device, weight: 0.15}
  - {finding_type: cost.usage_change_extreme, weight: 0.30}
  - {finding_type: cloud.login_failure_burst, weight: 0.25}
independence:
  group_by: [source_event_root, producer]
  minimum_groups: 3
emit:
  incident_type: compound.account_compromise
  playbook: PB-ACCOUNT-COMPROMISE-01
```

## Capability Claims

```json
{
  "iss": "sentinel-policy-service",
  "aud": "identity-service",
  "jti": "cap_...",
  "incident_id": "inc_443",
  "policy_decision_id": "pdec_...",
  "action": "identity.api_key.pause",
  "target": "key_...",
  "scope": "single_key",
  "max_attempts": 1,
  "rollback_required": true,
  "exp": 1781026740
}
```

## Suggested Repository Docs

```text
docs/sentinel/
  README.md
  architecture/
    doctrine.md
    reference-architecture.md
    threat-model.md
    adrs/
  contracts/
    event.md
    finding.md
    incident.md
    receipt.md
    model-fingerprint.md
    trust-vector.md
  nodes/
    cost.md
    agent.md
    cloud.md
    license.md
    data.md
    provider.md
    prime.md
  policies/
    action-classes.md
    account-compromise.md
    provider-quarantine.md
  operations/
    runbooks.md
    testing.md
    privacy-retention.md
```
