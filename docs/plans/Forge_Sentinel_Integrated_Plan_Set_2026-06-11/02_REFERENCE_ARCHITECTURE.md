# Reference Architecture


## 2026-06-11 CSSA Integration Architecture

### Cloud hot path

```text
Caller
  │
  ▼
CSSA CloudSecurityGate
  ├─ principal / executor / delegation
  ├─ signed entitlement
  ├─ atomic quota reservation
  ├─ R0–R4 classification and redaction plan
  ├─ provider/model/action/tool-chain policy
  └─ single-use authorization
  │
  ▼
CloudActionAuthorization persisted
  │
  ▼
GovernedEgressBroker
  │
  ▼
Approved provider adapter
  │
  ▼
CloudActionOutcome persisted
```

Sentinel is deliberately absent from this synchronous path.

### Evidence and control path

```text
CSSA decisions / authorizations / outcomes / edge findings
→ registered Sentinel adapter
→ canonical events and evidence
→ Sentinel-Cost / Cloud / Data / Provider / Agent / License
→ Sentinel Prime
→ Policy Decision Point
→ Forge_Command or owning authority
→ signed CloudSecurityControlDirective
→ CSSA control registry
→ normal CSSA gate evaluation
→ receipt and outcome evidence
```

### Updated authority rows

| Surface | Intelligence | Policy owner | Execution owner |
|---|---|---|---|
| Cloud request authorization | CSSA deterministic evaluators | CSSA authenticated policy bundle | CSSA Gate |
| Cloud egress | CSSA | CSSA registry/policy | GovernedEgressBroker |
| Cross-request behavioral risk | Sentinel nodes/Prime | Sentinel policy service / Forge_Command | Owning service |
| Sentinel-originated cloud hold | Sentinel recommends | Forge_Command/policy authority signs | CSSA Gate enforces |
| Identity key/session response | Sentinel recommends | Identity policy/Forge_Command | Identity service |
| Provider route restriction | Sentinel-Provider recommends | NeuroForge policy | NeuroForge and CSSA eligibility |
| Code repair | Sentinel supplies evidence | SMITH governance | YellowJacket + Hermes |

### Non-negotiable control rule

A raw incident, finding, generated summary, or anomaly score is not a CSSA authorization artifact. CSSA consumes only authenticated policy bundles, entitlements, approvals, quota state, and signed scoped control directives.

## Architectural Position

Sentinel sits between ecosystem telemetry and governed action. It must be visible, contract-bound, and unable to impersonate an authority.

```text
PRODUCERS                    INTELLIGENCE                     AUTHORITIES
ForgeAgents / FA Local ─┐
NeuroForge / NeuronForge ┤
Forge_Command             ┤   Event Gateway
Stripe / Entitlements     ┤        │
Identity / Device / Cloud ┤        ▼
Provider APIs             ┘   Evidence Pipeline
                                  │
                         Specialized Sentinel Nodes
                                  │
                            Sentinel Prime
                                  │
                         Policy Decision Point
                                  │
       ┌──────────────────────────┼─────────────────────────┐
       ▼                          ▼                         ▼
 Forge_Command                YellowJacket          Identity/Entitlement
 operator review              admission             commercial/access
       │                          │                         │
       └──────────────────────────┼─────────────────────────┘
                                  ▼
                               Hermes
                         bounded execution
                                  │
                            Action receipts
                                  │
                  DataForge + Centipede + AAR
```

Code/configuration repair follows:

```text
Sentinel incident
→ Centipede evidence/reconciliation
→ Forge_Command Self-Healing review
→ SMITH / forge-smithy proposal governance
→ YellowJacket admission
→ Hermes execution
→ verification + receipt
```

## Components

### Producer Adapters

Adapters translate native events without inventing facts. Required adapters include:

- ForgeAgents and FA Local runs, tools, patches, permissions
- NeuroForge routing, inference, champion/challenger, provider usage
- NeuronForge local inference
- Forge_Command operator actions
- Centipede evidence and incident projection
- DataForge integrity and persistence
- Entitlement/license validation
- Verified Stripe webhooks and billing state
- Identity/session/API-key/device/region events
- YellowJacket admission decisions
- Hermes action receipts
- SMITH proposal, verification, rollback

### Sentinel Event Gateway

Responsibilities:

- Authenticate producer
- Verify signature where required
- Validate schema version
- Enforce tenant/environment boundary
- Apply idempotency
- Reject malformed or forbidden fields
- Assign ingestion metadata
- Route accepted events to normalization

The gateway does not compute risk.

### Normalization and Classification

- Normalize timestamps, units, identities, regions, routes, models, and resources
- Attach data sensitivity and retention
- Redact or tokenize forbidden fields
- Map native event names to canonical families
- Preserve original payload hash and transformation version
- Mark missing facts explicitly

### Evidence Ledger

Append-oriented records in DataForge contain:

- Canonical event
- Producer and integrity state
- Validation outcome
- Source hash
- transformation history
- correlation IDs
- data class and retention
- correction/supersession links

### Feature and Baseline Service

Versioned features include:

- Tokens/cost per actor, tenant, agent, route, model, and task
- Retry rate, cache behavior, patch count/size, file scope
- Login failures, key/device/region novelty
- Data egress, export breadth, destination novelty
- Provider latency, contract validity, evaluation success, rollback rate
- Baseline distance and change-point probability

### Specialized Nodes

- Sentinel-Cost
- Sentinel-Agent
- Sentinel-Cloud
- Sentinel-License
- Sentinel-Data
- Sentinel-Provider

Each has a minimum event subscription, isolated service identity, feature view, finding contract, and no authority credentials.

### Sentinel Prime

Prime:

- Correlates findings across subjects and time
- Tracks evidence independence
- Merges duplicates without deleting evidence
- Forms threat hypotheses
- Preserves conflicting conclusions
- Selects incident priority and playbook
- Produces the operator briefing
- Manages incident lifecycle

Prime does not directly execute high-impact actions.

### Policy Decision Point

Inputs:

```text
incident type, likelihood, impact, confidence, evidence quality,
asset criticality, tenant/product policy, current state,
action class, reversibility, blast radius, cooldown,
required approvals, rollback readiness
```

Outputs:

```text
DENY_ACTION
RECOMMEND_ONLY
REQUEST_OPERATOR
ALLOW_BOUNDED_ACTION
ALLOW_EMERGENCY_CONTAINMENT
```

### Authority Adapters

| Authority | Owned actions |
|---|---|
| Forge_Command operator | Review, approve, dismiss, escalate, roll back |
| YellowJacket | Runtime/tool admission and stop |
| Hermes / FA Local | Execute exact approved action |
| SMITH / forge-smithy | Govern source/config mutation |
| Identity service | Session, MFA, API-key controls |
| Entitlement service | Feature, quota, device, license access |
| Stripe-verified billing service | Billing truth and commercial state |
| NeuroForge | Provider/model route selection and weights |
| DataForge | Evidence durability and data-object controls |

### Receipt Service

Every decision and action attempt records:

- Incident and decision IDs
- Policy/model/feature versions
- Requested and executed action
- Exact target and scope
- Authority and actor
- Before/after references
- Result
- Rollback path
- Time and integrity hash/signature

## Deployment Topology

### Local Plane

- Local agent/model behavior
- Repository and local data evidence
- Redaction before cloud transmission
- Offline event queue
- Local incident projection
- Local action receipts

### Cloud Plane

- Cross-device identity behavior
- Provider/cloud usage and cost
- Entitlement and Stripe reconciliation
- Fleet-wide provider/model risk
- Tenant-isolated incidents
- Approved analytics

### Forge_Command

Forge_Command is the operator/admin surface over cloud and business systems. Public customer traffic does not route through the desktop UI.

## Trust Boundaries

| Boundary | Risk | Required control |
|---|---|---|
| Producer → Gateway | Spoofed events | Producer auth, signature, schema validation |
| Local → Cloud | Private data leakage | Field allowlist, classification, redaction |
| Tenant → Tenant | Cross-customer exposure | Tenant-bound auth, storage and cache isolation |
| Node → Prime | Forged/stale finding | Signed finding, freshness, version pinning |
| Prime → Policy | Score manipulation | Policy-owned thresholds, recomputation |
| Policy → Authority | Expanded action | Scoped short-lived capability |
| Authority → Executor | Confused deputy | Exact schema and target validation |
| Provider → NeuroForge | Alias drift | Model fingerprint and trust reset |
| Stripe → Entitlement | Forged/replayed event | Signature and idempotency |
| Operator → Control Plane | Privilege misuse | MFA, RBAC, audit, dual approval |

## Degraded Modes

### One Node Down

- Other nodes continue.
- Prime displays missing coverage.
- Confidence cannot increase due to missing telemetry.
- Actions requiring the missing node are disabled.

### Cloud Down

- Local plane queues integrity-protected evidence.
- Safe local operation continues.
- Cached signed entitlement follows staleness policy.
- Reconciliation occurs through Centipede.

### DataForge Down

- Use bounded WAL/cache.
- Mark receipts pending durability.
- Deny destructive actions requiring durable proof.
- Verify hashes during reconciliation.

### Sentinel Down

- IAM, static policy, YellowJacket, signed entitlement, quotas, and other hard controls continue.
- Predictive automation stops.
- Outage becomes a health incident.

## Isolation Rules

- Nodes have separate service identities and minimum subscriptions.
- Prime has no raw protected-content access by default.
- Feature extraction and enforcement are separate.
- Policy thresholds live outside node code.
- Node deployments contain no authority credentials.
- Provider secrets stay with NeuroForge/provider gateway.
- Stripe secrets stay with billing services.
- Local keys stay in OS keyring or approved secret storage.
