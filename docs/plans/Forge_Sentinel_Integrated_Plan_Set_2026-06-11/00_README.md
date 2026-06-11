# Forge Sentinel Implementation Plan Set


## 2026-06-11 Integrated CSSA Coordination Update

This revision formally places the **Cloud Service Security Authority (CSSA)** beneath Sentinel as the deterministic cloud enforcement membrane and evidence producer.

```text
Cloud request
→ CSSA CloudSecurityGate
→ CloudActionAuthorization
→ GovernedEgressBroker
→ CloudActionOutcome
→ DataForge evidence
→ Sentinel nodes
→ Sentinel Prime
→ Policy / Forge_Command
→ signed bounded control
→ CSSA or owning authority
```

### Updated division of responsibility

- **CSSA** owns real-time cloud authorization, data-boundary enforcement, atomic quota reservation, provider/action eligibility, governed egress, and immutable authorization/outcome truth.
- **Sentinel** owns durable behavioral context, cross-domain correlation, calibrated findings, compound incidents, explanations, and bounded recommendations.
- **Forge_Command** owns operator review, approval, incident lifecycle, exceptional escalation, and rollback visibility.
- **Policy authorities** convert recommendations into signed, scoped, expiring controls.
- **CSSA never treats a raw Sentinel incident as executable policy.**
- **Sentinel never inserts itself into CSSA's request hot path.**
- **CSSA watchdog output is a source finding, not the final ecosystem incident.**

### New document

`07_CSSA_COORDINATION_AND_CONTROL_LOOP.md` defines the canonical two-way contract, feedback-loop protections, control-directive schema, and implementation sequence.

**Control surface:** Forge_Command  
**AI routing:** NeuroForge / NeuronForge  
**Evidence spine:** DataForge Local + DataForge Cloud + Centipede  
**Code-mutation authority:** SMITH / forge-smithy  
**Runtime admission:** YellowJacket  
**Bounded execution:** Hermes / FA Local  
**Commercial authority:** Entitlements + verified Stripe state

## Purpose

Forge Sentinel is a governed security-intelligence fabric for the Forge ecosystem. It does more than alert on isolated events: it builds behavioral baselines, correlates evidence across time and services, predicts risk, explains its reasoning, and requests a bounded response through the correct authority.

```text
Traditional security agent
Observe → Detect → Alert → Block

Forge Sentinel node
Observe → Normalize → Remember → Correlate → Predict
→ Explain → Recommend → Governed Enforcement → Learn
```

## Target Outcome

```text
ForgeAgents / FA Local ─┐
NeuroForge / NeuronForge ┤
Forge_Command             ┤
Stripe / Entitlements     ┤
Provider APIs             ┤
Identity / Device / Cloud ┘
          │
          ▼
 Sentinel Event Gateway
          │
 Normalize + classify + verify
          │
 DataForge evidence ledger / Centipede reconciliation
          │
 ┌────────┼─────────┬─────────┬─────────┬──────────┐
 ▼        ▼         ▼         ▼         ▼          ▼
Cost    Agent      Cloud    License    Data     Provider
Node    Node       Node     Node       Node      Node
          └──────────────┬────────────────────────┘
                         ▼
                   Sentinel Prime
                         │
       likelihood + impact + confidence + evidence quality
                         │
                 Policy Decision Point
                         │
      Forge_Command / YellowJacket / Identity / Entitlements
                         │
                    Action receipt
                         │
              DataForge + Centipede + AAR
```

## Production Corrections to the Original Concept

1. **Events are governed evidence, not automatic training data.** Only reviewed, labeled, privacy-approved datasets may train or recalibrate a detector.
2. **Sentinel does not grant itself authority.** Nodes produce findings; policy and owning services authorize actions.
3. **No universal model trust score.** Trust is scoped by provider, immutable model fingerprint, task category, route, permissions, repository class, evaluation suite, and time window.
4. **Prediction is not proof.** Every incident carries likelihood, impact, confidence, evidence quality, uncertainty, and evidence references.
5. **Operator overrides are receipts, not immediate labels.** They enter training only after review.
6. **No hidden self-modification.** Feature definitions, thresholds, policies, models, and promotions are versioned, evaluated, approved, and reversible.
7. **Sentinel never patches code directly.** Remediation routes through Centipede → Forge_Command Self-Healing → SMITH → YellowJacket → Hermes.

## Documents

| File | Purpose |
|---|---|
| `01_VISION_AND_DOCTRINE.md` | Mission, principles, objectives, non-goals |
| `02_REFERENCE_ARCHITECTURE.md` | Components, trust boundaries, deployment, authority chain |
| `03_SENTINEL_NODE_TAXONOMY.md` | Cost, Agent, Cloud, License, Data, Provider, and Prime |
| `04_EVENT_EVIDENCE_AND_INCIDENT_CONTRACTS.md` | Canonical events, findings, incidents, receipts, feedback |
| `05_RISK_LEARNING_AND_CALIBRATION.md` | Baselines, scoring, correlation, drift, governed learning |
| `06_POLICY_ENFORCEMENT_AND_AUTHORITY.md` | Action classes, capability tokens, approvals, rollback |
| `07_NEUROFORGE_TRUST_ROUTING.md` | EMA champion integration and model-change handling |
| `08_FORGE_COMMAND_INCIDENT_UX.md` | Scannable operator incident surface and completed stubs |
| `09_THREAT_DATA_PRIVACY_AND_AUDIT.md` | Threat model, data boundaries, retention, tenant isolation |
| `10_IMPLEMENTATION_ROADMAP.md` | Ordered vertical slices and exit gates |
| `11_TESTING_OPERATIONS_AND_RUNBOOKS.md` | Replay, red team, chaos, and incident procedures |
| `12_EPICS_ADRS_AND_EXAMPLES.md` | Backlog, acceptance criteria, decisions, examples |

## Recommended Build Order

```text
Contracts
→ Evidence ingestion and replay
→ Sentinel-Cost + Sentinel-Cloud in shadow mode
→ Forge_Command incident review
→ Policy service + reversible actions
→ Sentinel-Agent + Sentinel-Provider
→ Sentinel-License + Sentinel-Data
→ Sentinel Prime correlation
→ Governed learning and champion/challenger promotion
```

## Definition of Done

Sentinel is production-ready only when:

- Every finding is reconstructable from immutable evidence.
- Every action has an authority owner, exact scope, rollback rule, and receipt.
- Every rule, feature, model, threshold, and policy is versioned.
- Local/cloud data boundaries are enforced and tested.
- A provider alias change cannot silently inherit mature trust.
- False-positive, false-negative, calibration, and detection-delay metrics exist per incident family.
- A compromised Sentinel node cannot mutate code, modify billing truth, permanently revoke a license, or bypass YellowJacket.
- Degraded modes preserve hard security controls and safe local operation.

## Integrated Plan Set File Map

- `01_VISION_AND_DOCTRINE.md`
- `02_REFERENCE_ARCHITECTURE.md`
- `03_SENTINEL_NODE_TAXONOMY.md`
- `04_EVENT_EVIDENCE_AND_INCIDENT_CONTRACTS.md`
- `05_RISK_LEARNING_AND_CALIBRATION.md`
- `06_POLICY_ENFORCEMENT_AND_AUTHORITY.md`
- `07_CSSA_COORDINATION_AND_CONTROL_LOOP.md`
- `08_NEUROFORGE_TRUST_ROUTING.md`
- `09_FORGE_COMMAND_INCIDENT_UX.md`
- `10_THREAT_DATA_PRIVACY_AND_AUDIT.md`
- `11_IMPLEMENTATION_ROADMAP.md`
- `12_TESTING_OPERATIONS_AND_RUNBOOKS.md`
- `13_EPICS_ADRS_AND_EXAMPLES.md`
