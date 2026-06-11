# Sentinel Node Taxonomy


## 2026-06-11 CSSA Evidence Subscriptions

CSSA is a high-integrity producer for multiple Sentinel nodes.

| CSSA evidence | Primary node | Secondary node |
|---|---|---|
| Quota reservations, usage, actual cost | Sentinel-Cost | Sentinel-License |
| Identity/delegation/tenant failures | Sentinel-Cloud | Sentinel-Agent |
| R2/R3/R4 classifications and redaction | Sentinel-Data | Sentinel-Cloud |
| Provider/model/action eligibility | Sentinel-Provider | Sentinel-Cost |
| Tool-chain denials and broker bypass | Sentinel-Agent | Sentinel-Cloud |
| Entitlement outcome | Sentinel-License | Sentinel-Cost |
| Authorization replay/integrity failure | Sentinel-Cloud | Sentinel Prime |
| Recorder backlog/coverage gap | Sentinel Prime health | all affected nodes |

### CSSA watchdog rule

The CSSA watchdog remains close to the enforcement boundary and detects deterministic edge conditions such as authorization replay, signature failure, broker bypass, recorder backlog, reservation leakage, absolute ceilings, and short-window deny streaks.

Its canonical output is `CloudSecurityFinding.v1`. A legacy `SecurityIncident.v1` payload is accepted only through an adapter that marks it as a **source finding**. It cannot create or mutate Sentinel incident lifecycle state directly.

## Standard Node Contract

Every node follows:

```text
Consume evidence → validate scope → compute features → compare baseline
→ evaluate rules/models → produce finding → explain evidence
→ request correlation/action → receive outcome → contribute to calibration
```

Every finding contains:

- Node identity/version
- Finding type
- Subject and scope
- Time window
- Likelihood, impact, confidence, evidence quality
- Baseline reference
- Evidence references
- Top factors and uncertainty
- Recommended action class
- Expiration
- Correlation hints

A node finding is not automatically an incident. Sentinel Prime or a deterministic incident rule promotes it.

---

## Sentinel-Cost

### Mission

Detect accidental, abusive, compromised, or inefficient consumption across cloud APIs, providers, models, storage, and agent execution.

### Inputs

- Token and billable-unit usage
- Provider usage and finalized cost
- Stripe subscription/invoice state
- Included quota and paid-overage policy
- Agent runs and retries
- Cache hits/misses
- Storage and egress
- Model route decisions
- User, tenant, agent, key, and product identity

### Baselines

- Cost/tokens per tenant, account, task, route, and model
- Cost per successful result
- Retry cost
- Agent cost per patch
- Quota consumption curve
- Normal hourly/weekly seasonality
- New-account cohort profile

### Findings

- Sudden or sustained usage increase
- Retry storm or agent loop
- Cache collapse
- Expensive model used for low-risk work
- Provider price/catalog mismatch
- Quota bypass
- Billing/usage divergence
- Compromise suspected when cost combines with identity novelty

### Recommended Actions

- Throttle exact route/actor
- Cap retries
- Pause suspicious key
- Require reauthentication
- Route to a cheaper eligible model
- Pause nonessential cloud work
- Open billing reconciliation

### Forbidden Direct Actions

- Cancel subscription
- Modify Stripe customer truth
- Permanently revoke license
- Delete usage evidence

---

## Sentinel-Agent

### Mission

Detect unsafe, drifting, compromised, looping, or policy-violating agents.

### Inputs

- Run start/end and status
- Tool calls and permissions
- File/repository access
- Patch count and size
- Test/evaluation results
- Rollbacks
- Prompt/spec/skill/agent version
- YellowJacket decisions
- Hermes and SMITH receipts
- Operator overrides

### Baselines

- Runs per period
- Patches/files per task
- Tool distribution
- Evaluation pass rate
- Rollback and denial rate
- Permission escalation
- Normal repository boundaries
- Expected output contracts

### Findings

- Patch burst
- Tool novelty
- Repository boundary violation
- Repeated denied action
- Evaluation avoidance
- Prompt/spec mismatch
- Recursive invocation
- Agent identity or version mismatch
- Excessive rollback
- Acting outside route class

### Recommendations

- Stop one run through YellowJacket
- Move exact agent version to shadow
- Reduce tool permissions
- Quarantine skill/prompt version
- Request sandbox replay
- Require SMITH review
- Route task to a different eligible agent/model

Sentinel-Agent never applies or promotes a patch.

---

## Sentinel-Cloud

### Mission

Detect compromise, misuse, instability, and policy violations in cloud services and access.

### Inputs

- Login/MFA/session events
- Device, IP, ASN, region
- API-key creation/use/revocation
- Service-to-service calls
- Privileged operations
- Secret access
- Deployment and endpoint changes
- WAF/network findings
- Cloud health and rate limits

### Baselines

- Normal devices/regions
- Session concurrency
- Key-use patterns
- Service call graph
- Privileged action frequency
- Deployment cadence
- Error/denial rates

### Findings

- Implausible travel
- New region + key + usage spike
- Credential stuffing
- Session replay
- Service identity misuse
- Privilege escalation attempt
- Unexpected service-call edge
- Security degradation after deployment

### Recommendations

- Require MFA/reauthentication
- Revoke affected sessions
- Pause one key
- Restrict exact route
- Increase logging temporarily
- Isolate a service identity
- Request emergency containment

---

## Sentinel-License

### Mission

Protect signed entitlements, included cloud usage, paid overage, device authorization, trials, and commercial policy.

### Inputs

- Ed25519-signed entitlement and validation
- Activation/deactivation
- Device identity
- Trial/subscription state
- Verified Stripe events
- Quota consumption
- Staleness/revalidation
- Feature access decisions
- Refund/dispute state

### Rule-First Posture

Entitlement behavior is mainly deterministic. Learning detects abuse but never replaces signature or verified billing truth.

### Findings

- Invalid/expired/replayed entitlement
- Shared account/device farm
- Trial cycling
- Clock manipulation
- Quota tampering
- Stripe/entitlement divergence
- Activation churn
- Unauthorized paid feature access

### Recommendations

- Require online revalidation
- Deny exact paid cloud feature
- Restrict new device activation
- Reconcile Stripe state
- Request account verification
- Preserve safe local/free operation where product policy allows

Sentinel-License cannot permanently revoke a license by anomaly score.

---

## Sentinel-Data

### Mission

Detect unauthorized access, excessive collection, suspicious transfer, integrity failures, and possible exfiltration.

### Inputs

- Object access and classification
- Local/cloud transitions
- Export/import
- Query breadth and volume
- Egress and destination
- Encryption/redaction status
- Content hash
- Retention actions
- Cross-tenant attempts
- RAG retrieval metadata
- Backup/restore

### Baselines

- Data classes per actor
- Normal volume, destination, and local/cloud split
- Query breadth
- Export size
- Encryption/key use
- Retention/deletion pattern

### Findings

- Restricted content sent to cloud without policy
- Cross-tenant attempt
- Bulk export or destination novelty
- Repeated denied retrieval
- Redaction bypass
- Integrity mismatch
- Excessive RAG retrieval
- Provider payload larger than necessary
- Retention failure

### Recommendations

- Block exact export/destination
- Require redaction
- Quarantine one object
- Revoke scoped data capability
- Preserve evidence and open privacy/security incident

Sentinel-Data prefers metadata and hashes. Raw-content inspection requires declared purpose and authority.

---

## Sentinel-Provider

### Mission

Measure provider, endpoint, and model-route trust for NeuroForge without creating a simplistic provider leaderboard.

### Inputs

- Provider catalog and model fingerprint
- Inference cost/latency/availability
- Structured-output validity
- Evaluation and patch success
- Rollback and incident rate
- Tool-policy behavior
- Security/privacy compatibility
- Region and retention terms
- Route and task taxonomy

### Trust Vector

```text
reliability
category-specific task success
evaluation quality
latency
cost efficiency
security compliance
privacy compatibility
contract validity
tool-use safety
rollback risk
availability
evidence freshness/quality
```

### Findings

- Model alias/fingerprint changed
- Provider route degraded
- Structured-output or tool regression
- Security-task failure increase
- Price/latency/rate-limit shift
- Region/policy incompatibility
- New snapshot with insufficient evidence
- Trust inherited incorrectly

### Recommendations

- Reduce traffic
- Move snapshot to challenger/shadow
- Reset inherited trust
- Require evaluation
- Disable tool use for one route
- Quarantine exact snapshot/category
- Promote validated challenger through NeuroForge governance

---

## Sentinel Prime

### Mission

Convert specialized findings into coherent incidents and prioritized authority paths.

### Functions

1. Correlate by actor, key, account, agent, route, repository, tenant, resource, and time.
2. Track evidence independence and avoid double-counting derived copies.
3. Form hypotheses: compromise, drift, provider regression, license abuse, exfiltration, cost runaway, contract violation.
4. Preserve node disagreement and missing telemetry.
5. Merge duplicate incidents while preserving all evidence.
6. Compute priority from risk, criticality, blast radius, reversibility, and policy.
7. Select playbook and required authority.
8. Manage lifecycle: open, acknowledged, investigating, action pending, contained, monitoring, resolved, dismissed, reopened.

### Anti-Patterns

Prime must not:

- Average unrelated scores
- Count multiple transformations of one event as independent evidence
- Hide conflicts
- Treat novelty as proof
- Convert provider outage into compromise without identity evidence
- Directly execute high-impact actions

## Deployment Priority

1. Cost
2. Cloud
3. Agent
4. Provider
5. License
6. Data
7. Prime correlation

Prime should begin with deterministic correlation and only add evaluated ML after sufficient reviewed evidence exists.
