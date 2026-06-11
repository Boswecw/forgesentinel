# Implementation Roadmap


## 2026-06-11 CSSA Coordination Workstream

### Integration Gate A — Contract alignment

- Add CSSA canonical event mappings.
- Add `CloudSecurityFinding.v1`.
- Add `CloudSecurityControlDirective.v1`.
- Define legacy `SecurityIncident.v1` compatibility mapping.
- Define lineage and policy-generated-effect fields.
- Approve one incident-lifecycle owner: Forge_Command.

### Integration Gate B — Evidence flow

- Register CSSA as a producer.
- Persist decisions, authorizations, outcomes, quota records, classifications, and findings.
- Prove tenant and local/cloud field policies.
- Reconstruct a cloud attempt end-to-end from request through outcome.

### Integration Gate C — Correlation in shadow

- Feed CSSA evidence to Cost, Cloud, Agent, Provider, License, and Data nodes.
- Run Prime correlation without changing CSSA behavior.
- Verify no double-counting between decision, authorization, outcome, and watchdog records.

### Integration Gate D — Signed return controls

- Implement control-directive issuer, registry, validation, application, expiration, and rollback.
- Start with one reversible Class 2 control.
- Prove that a raw incident cannot alter CSSA decisions.
- Prove control lineage appears in receipts.

### Integration Gate E — Unified operations

- One Forge_Command incident timeline.
- CSSA and Sentinel health displayed separately.
- Control failure and rollback failure create new evidence and escalation.
- AAR includes both hot-path and intelligence-path behavior.

## Delivery Strategy

Use bounded vertical slices. Every slice should include contract, producer, storage, replay, finding, Forge_Command view, tests, and receipt/outcome evidence. Avoid creating every node as an empty service shell.

## Wave 0 — Architecture Lock and Contracts

### Deliverables

- Approve doctrine, authority map, trust boundaries, and local/cloud policy
- Event, evidence, finding, incident, policy, capability, receipt, fingerprint, and trust-vector contracts in `forge_contract_core`
- Event/feature registries
- Tenant/environment identity rules
- Producer authentication
- ADR register

### Exit Gate

- Rust/TypeScript consumers share compatible contracts
- Unknown major versions fail safely
- Golden fixtures and compatibility tests pass
- Threat model reviewed
- No unresolved authority ambiguity

## Wave 1 — Evidence Spine

### Deliverables

- Event Gateway and producer registry
- Validation, idempotency, hashing/signatures
- Classification/redaction
- DataForge Local/Cloud persistence
- Centipede import/reconciliation format
- Replay CLI
- Event inspection in Forge_Command

### Initial Producers

- NeuroForge inference/routing
- ForgeAgents run/tool/patch
- Forge_Command operator actions
- Entitlement validation
- Verified Stripe webhook

### Exit Gate

- Events ingest, reject, replay, and trace
- Duplicates are safe
- Local/cloud field-policy tests pass
- DataForge outage path is proven

## Wave 2 — Sentinel-Cost

### Deliverables

- Cost/token features and baselines
- Quota correlation
- Spike, sustained-growth, retry-storm, cache-collapse, and billing-divergence findings
- Forge_Command cost incidents
- Shadow recommendations only

### Exit Gate

- Historical replay is stable
- Approved spikes can be annotated
- No automatic suspension
- Briefing shows expected, observed, evidence quality, and exact recommended scope

## Wave 3 — Sentinel-Cloud

### Deliverables

- Login/session/key/device/region adapters
- Novelty and login-failure correlation
- Account-compromise playbook
- Identity authority adapter
- Policy service MVP
- Reversible key/session actions and receipts

### Exit Gate

- Compound compromise replay succeeds
- New region alone cannot suspend account
- Executor validates capability scope
- Key pause/rollback works
- Emergency policy is narrow and tested

## Wave 4 — Forge_Command Incident Surface

### Deliverables

- Active list and detail drawer
- Source badges and evidence timeline
- Recommendations and exact action cards
- Approve/deny/defer/escalate
- Completed receipt stub
- Search/filter
- Self-Healing projection

### Exit Gate

Operator can answer what, where, why, source, fix, authority, reversibility, and result. Missing evidence is visible. No broad “fix all.”

## Wave 5 — Sentinel-Agent

### Deliverables

- Agent/skill/prompt/tool fingerprints
- Run/patch/tool baselines
- Boundary, denial, loop, and drift findings
- YellowJacket stop/quarantine
- Sandbox replay
- SMITH handoff

### Exit Gate

- Patch burst and boundary violation detected
- Sentinel cannot patch code
- Quarantine targets exact version
- Re-enable path tested
- Release boundaries prevent baseline mixing

## Wave 6 — Sentinel-Provider + NeuroForge

### Deliverables

- Fingerprint registry
- Task-scoped trust vectors
- Alias-change and provider-drift findings
- Hard eligibility integration
- EMA + trust integration
- Challenger shadow evaluation
- Quarantine/rollback

### Exit Gate

- Changed alias cannot silently inherit trust
- Sensitive categories require verified fingerprint
- Promotion and rollback create receipts
- Trust remains category/route scoped

## Wave 7 — Sentinel-License

### Deliverables

- Signed-entitlement evidence
- Device activation and staleness behavior
- Trial/activation abuse
- Stripe/entitlement divergence
- Revalidation and quota controls

### Exit Gate

- Invalid signature fails closed
- Offline cached-entitlement behavior defined
- Stripe replay idempotent
- Sentinel cannot permanently revoke
- Local safe behavior follows product policy

## Wave 8 — Sentinel-Data

### Deliverables

- Classification and local/cloud transition events
- Export/destination baselines
- Redaction evidence
- Cross-tenant denial
- Egress anomaly
- Scoped quarantine/block

### Exit Gate

- Protected content absent from default cloud telemetry
- Cross-tenant access denied and recorded
- Redaction failure blocks transfer where required
- Retention failure becomes incident

## Wave 9 — Sentinel Prime

### Deliverables

- Cross-node correlation
- Duplicate collapse and evidence independence
- Compound hypotheses
- Conflict preservation
- Priority/playbook/authority selection
- Reopen and linked timelines

### Exit Gate

- Shared source not double-counted
- Conflicts visible
- Compound compromise increases priority appropriately
- Provider outage alone does not become compromise
- Prime outage cannot bypass hard controls

## Wave 10 — Governed Learning

### Deliverables

- Reviewed labels and training eligibility
- Dataset registry
- Offline/historical/adversarial evaluation
- Shadow challenger
- Calibration reports
- Promotion/rollback receipts
- Poisoning controls

### Exit Gate

- No event automatically trains
- Dataset/features reproducible
- False-positive budget enforced
- Rollback restores prior champion
- Model and policy governance remain separate

## Wave 11 — Production Hardening

### Deliverables

- Capacity, performance, chaos, tenant-isolation, key-rotation, backup/restore
- On-call runbooks and alert grouping
- SLOs
- Privacy/security review
- Operator training
- AAR integration

### Exit Gate

- Critical runbooks exercised
- Degraded modes proven
- Receipts durable
- Access audit complete
- Launch sign-off recorded

## Repository Impact

### `forge_contract_core`

Contracts and bindings for events, findings, incidents, decisions, capabilities, receipts, fingerprints, and trust vectors.

### `Forge_Command`

Incident review, receipts, Sentinel health, provider trust, policy/model versions, license/security administration, Self-Healing handoff.

### `NeuroForge`

Route/inference events, model fingerprint, task taxonomy, EMA integration, eligibility, challenger routing, route receipts.

### `NeuronForge`

Local model identity, local route outcomes, private-data classification.

### `ForgeAgents` / `FA Local`

Run/tool/patch/permission events, fingerprints, sandbox replay, execution receipts.

### `DataForge Local/Cloud`

Evidence, features, baselines, incidents, receipts, retention, audit, tenant isolation.

### `Centipede`

Bundle import, reconciliation, incident projection, chain of custody, replay.

### `SMITH / forge-smithy`

Governed remediation, mutation policy, verification, promotion/rollback receipts.

### `YellowJacket`

Admission, capability validation, permission denials, emergency stop.

### `Hermes`

Exact-scope action execution, receipts, rollback.

### Entitlement/Billing

Signed entitlement, verified Stripe events, quota/feature/device decisions, revalidation.

## Migration

- Add contracts without changing current behavior.
- Dual-write only with reconciliation.
- Run nodes in shadow.
- Compare with existing telemetry and operator judgment.
- Enable one Class 2 playbook at a time.
- Exercise rollback before automation.
- Preserve legacy incident IDs through mapping.
- Remove old telemetry only after replay/parity.

## First Production MVP

- Contract package
- Evidence persistence/replay
- Sentinel-Cost and Sentinel-Cloud
- Basic provider fingerprinting
- Forge_Command incident list/detail
- Policy service
- Reversible key/session controls
- Receipts
- No autonomous training
- No permanent license action
- No direct code mutation
