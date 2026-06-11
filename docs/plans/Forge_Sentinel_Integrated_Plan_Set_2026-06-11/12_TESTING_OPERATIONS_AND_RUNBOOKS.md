# Testing, Operations, and Runbooks


## 2026-06-11 CSSA Coordination Test Matrix

### Independence

- Sentinel down: CSSA gate, broker, quota, classification, and recording continue.
- CSSA watchdog down: gate continues; coverage gap is visible.
- Sentinel Prime down: CSSA source findings queue; no hard control is weakened.
- Forge_Command unavailable: pre-approved narrow policy continues; approval-required actions remain pending or blocked.

### Authority

- Raw Sentinel incident sent to CSSA: rejected as non-authoritative.
- Unsigned control directive: rejected.
- Expired/replayed directive: rejected.
- Directive target widened after signing: rejected.
- Unsupported rollback: rejected.
- Valid narrow directive: applied once with receipt.

### Feedback-loop resistance

- Sentinel-originated deny streak does not count as new independent compromise evidence.
- Standing-policy deny remains distinguishable from control-generated deny.
- Rollback events do not erase prior evidence.
- CSSA decision, authorization, outcome, and watchdog copy share one evidence root where appropriate.

### End-to-end scenario

```text
new key + new region + usage spike
→ CSSA evidence
→ Sentinel-Cost and Sentinel-Cloud findings
→ Prime compound incident
→ operator approves key hold
→ signed directive
→ CSSA applies exact hold
→ outcome and receipt
→ monitoring
→ reviewed label
```

## Test Doctrine

Test the complete chain:

```text
Producer → contract → ingestion → evidence → feature → finding
→ correlation → policy → authority → execution → receipt → outcome
```

A detector unit test alone is insufficient.

## Test Layers

### Contract

Required fields, unknown major versions, additive minor fields, invalid tenant/signature, clock skew, forbidden content, idempotency, producer compatibility.

### Unit

Feature extraction, baseline selection, novelty, change detection, evidence independence, time decay, risk composition, policy, capability scope, rollback generation.

### Integration

- NeuroForge route → provider finding
- Agent tool/patch → drift finding
- Stripe → entitlement reconciliation
- Identity events → compromise incident
- Export → data incident
- Forge_Command approval → authority execution
- Receipt → incident state

### Replay

Immutable fixtures for normal behavior, true incidents, false positives, provider changes, releases, billing changes, outages, and adversarial sequences.

### End-to-End

Realistic test tenants across service boundaries.

## Core Scenarios

### Usage Spike Only

Cost finding; moderate/low confidence; monitor/request context; no account suspension.

### Spike + New Key + New Region/Device + Failed Logins

Cost/Cloud findings; Prime compound incident; scoped key pause + MFA; operator review; receipts.

### Approved Bulk Migration

Spike detected; approved change window lowers risk; no containment; baseline updates only after approved window.

### Agent Patch Burst

Agent finding; YellowJacket stop/quarantine; no direct Sentinel patch; SMITH handoff.

### Provider Alias Change

Fingerprint change; trust reset; challenger state; sensitive work restricted; evaluation required.

### Cross-Tenant Attempt

Hard denial; Sentinel-Data incident; no protected data in event; exact actor/target evidence.

### Replayed Stripe Webhook

Signature verified; idempotency prevents duplicate effect; event recorded.

### Prime Outage

Nodes continue; hard controls continue; no false-safe state; queued correlation; health incident.

### DataForge Cloud Outage

WAL/local queue; no destructive action requiring missing receipt; later hash reconciliation.

### Capability Expansion

Executor rejects changed scope; security incident; no partial broad action.

## Calibration

Per incident family measure:

- Precision/recall
- False-positive/negative rate
- Brier score or equivalent
- Calibration curve
- Detection delay
- Cohort performance
- Performance by evidence coverage
- Performance after system/model change

Do not hide critical-class failure in one aggregate metric.

## Historical/Adversarial Replay

Include confirmed/dismissed incidents, releases, provider changes, onboarding spikes, outages, seasonal peaks, and sparse accounts. Keep related events in the same evaluation split.

Red-team:

- Slow baseline poisoning
- Duplicate/reordered/delayed events
- Label poisoning
- Alias swap
- Prompt/tool injection
- Capability tampering
- Cross-tenant collision
- Evidence deletion
- Conflicting nodes
- Operator misuse
- Rollback failure

## Security and Privacy Tests

- OAuth/JWT/PKCE where applicable
- Admin restrictions and RBAC
- Producer/signature verification
- Stripe and entitlement verification
- Rate limits
- Tenant/cache isolation
- Secret scanning
- injection/path traversal/SSRF/replay/confused deputy
- No raw protected content in default cloud events
- Redaction before transfer
- Retention/deletion from caches/indexes
- Training eligibility enforcement
- Support-role limits and export audit

## Performance and Chaos

Measure ingestion p95/p99, feature/finding/correlation latency, policy/action latency, replay throughput, storage growth, cardinality, queue/backpressure, and tenant fairness.

Chaos:

- Kill node/Prime/DataForge
- Delay provider events
- Rotate signing key
- Corrupt WAL entry
- Duplicate Stripe event
- Partial network partition
- Stale entitlement
- Slow authority
- Failed rollback
- Clock skew
- Malformed producer upgrade

## Promotion Gate

No detector/model/policy enters enforcement until contracts, replay, calibration, false-positive budget, privacy/security review, shadow results, rollback, operator explanation, authority validation, and promotion receipt all pass.

---

# Operational Health

Track:

- Gateway and producer freshness
- Rejection/signature failure
- Queue and reconciliation lag
- DataForge writes
- Feature/finding/Prime lag
- Policy/action failures
- Receipt durability
- Rollback readiness
- Version skew
- Tenant-isolation canary
- Retention jobs

Service health and evidence coverage are separate statuses.

## Runbook: Suspected Account Compromise

1. Verify evidence integrity and approved changes.
2. Identify affected account, sessions, key, data access, and cost.
3. Pause only suspicious key; require MFA/reauth.
4. Revoke active abused sessions if policy permits.
5. Throttle only when necessary.
6. Preserve safe local operation.
7. Review data/cost, restore verified access, label after review.

## Runbook: Cost Runaway

Check approved workload, retries, loop, cache, provider pricing, compromise, route classification, and quota bypass. Contain with retry cap, exact-route throttle, cheaper eligible route, key pause, or one-run stop. Reconcile estimate vs finalized usage; restore gradually and monitor hysteresis.

## Runbook: Agent Drift

Stop current run through YellowJacket; quarantine exact agent/skill/prompt version; preserve workspace/receipts; sandbox replay; compare known-good; hand repair to SMITH; validate and restore bounded traffic.

## Runbook: Provider Regression

Reduce affected route/category; pin known-good snapshot if available; evaluate challenger; preserve response metadata; protect sensitive categories; re-run evaluations; restore gradually with promotion receipt.

## Runbook: Data Exfiltration

Block exact export/destination; revoke scoped capability; preserve evidence without copying raw sensitive content; identify tenant/data class; rotate affected capability; confirm deletion obligations; restore least privilege.

## Runbook: License Abuse

Validate signed entitlement and verified Stripe state separately; require revalidation; restrict invalid paid cloud feature; preserve product-defined local behavior; never permanently revoke from anomaly alone.

## Runbook: False Positive

Preserve finding and dismissal; identify baseline/feature/model/rule/change-context cause; review label; replay correction; ensure correction does not hide true incidents; promote through governance.

## Runbook: Miss

Reconstruct evidence available at the time; identify missing producer/feature/correlation/threshold/policy; avoid hindsight-only labeling; add fixture; test false-positive budget; version and record AAR.

## Runbook: Evidence Pipeline Failure

Declare coverage gap; queue locally; retain hard controls; deny destructive actions requiring receipts; repair ingestion; reconcile hashes/sequence; mark delayed events; recompute affected findings.

## Runbook: Rollback Failure

Treat as high priority: stop similar actions, preserve state, escalate to owning authority, perform manual recovery, inspect contract/implementation, revalidate active instances, disable automation until fixed.

## Review Cadence

### Operational

High/critical incidents, action/rollback failures, coverage gaps, lag, policy errors, provider/model changes.

### Calibration

False positives, misses, operator disagreement, confidence calibration, cohort bias, stale baselines.

### Governance

Policy changes, model promotions, access changes, training datasets, retention, emergency actions, dual approvals.

## AAR

Capture event, timeline, available/missing evidence, decisions/actions, outcome, cost/data/customer impact, what worked/failed, false assumptions, required change, owner, and verification artifact. AAR may propose changes but cannot auto-deploy them.
