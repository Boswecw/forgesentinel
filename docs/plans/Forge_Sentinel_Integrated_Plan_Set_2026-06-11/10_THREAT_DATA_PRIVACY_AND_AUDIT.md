# Threat Model, Data, Privacy, and Audit


## 2026-06-11 CSSA/Sentinel Threat Addendum

### Incident-to-policy injection

**Threat:** An attacker forges or manipulates a Sentinel incident so CSSA blocks customers or routes.

**Controls:** CSSA ignores raw incidents; signed control directives only; allowlisted actions; exact scope; expiry; replay defense; issuer separation; Forge_Command audit; rollback.

### Feedback amplification

**Threat:** Sentinel interprets CSSA denials caused by Sentinel controls as fresh independent attack evidence.

**Controls:** mandatory control lineage; evidence-root grouping; policy-generated-effect flag; no double-counting; calibration separation.

### CSSA bypass

**Threat:** A workload creates a provider SDK or network client outside the broker.

**Controls:** closed transport registry; CI import/construction checks; runtime egress restrictions; bypass finding; Sentinel-Agent correlation.

### Content leakage through security telemetry

**Threat:** CSSA or Sentinel copies R3/R4 payloads into cloud incidents.

**Controls:** metadata/hash/reference first; origin-local quarantine; field allowlists; explicit content flags; default raw-content prohibition; audited exceptional access.

## Protected Assets

### Customer/User

- Identity, sessions, API keys, entitlements, licenses
- Included cloud quota and paid usage
- Local code, repositories, manuscripts, private content
- Prompts, RAG context, model outputs
- DataForge Local records
- Cloud tenant data and billing state

### Company

- Forge_Command administration
- Stripe and provider secrets
- Signing keys
- Routing policy and model registry
- Sentinel policy/models/baselines
- Fleet analytics and incident evidence
- Deployment and CI/CD

### Integrity

- Event provenance
- Evidence ledger
- Baselines and trust vectors
- Provider/model fingerprints
- Policies and action receipts
- Operator decisions and evaluations

## Adversaries

- External attacker or credential stuffer
- Stolen API-key user
- Customer abusing quota/license
- Compromised device, agent, skill, or dependency
- Insider with excessive privilege
- Cross-tenant attacker
- Provider-side compromise or silent model change
- Prompt-injection source
- Baseline/model/label poisoning attacker
- Forged billing-event sender
- Routing manipulator

## Core Threats and Controls

### Account Compromise

Signals: key/device/region novelty, failed logins, concurrency, cost spike, unusual data access.  
Controls: MFA, scoped sessions/keys, reauthentication, correlation, reversible key pause, receipts.

### Cost Runaway

Causes: compromise, agent loop, retry storm, cache failure, expensive misroute, quota bypass, provider mismatch.  
Controls: hard ceilings, retry caps, route quotas, usage reconciliation, throttling, operator approval.

### Agent Drift/Compromise

Signals: patch burst, new tools, scope expansion, repeated denials, evaluation avoidance, unusual files, rollback increase.  
Controls: YellowJacket, sandboxing, SMITH, immutable versions, tool allowlists, replay, quarantine.

### Data Exfiltration

Signals: bulk export, new destination, restricted cloud payload, redaction failure, cross-tenant query, unusual RAG breadth.  
Controls: classification, allowlists, local redaction, tenant isolation, egress caps, scoped block, audit.

### License Abuse

Signals: replayed entitlement, device farm, activation churn, trial cycling, clock manipulation, quota tampering.  
Controls: Ed25519 signatures, staleness limits, verified Stripe webhooks, idempotency, rate limits, operator review.

### Provider/Model Regression

Signals: alias change, output failures, rollback increase, tool violation, price/latency shift.  
Controls: immutable fingerprint, trust reset, champion/challenger, route quarantine, evaluation, provider diversity.

### Sentinel Poisoning

Attack: slowly normalize abuse, flood false events, forge labels, compromise producer, manipulate promotion.  
Controls: signed producers, robust statistics, active-incident exclusion, reviewed labels, dual approval, immutable datasets, replay, baseline freeze.

### Sentinel as an Attack Path

Attack: use Sentinel action channel to revoke access or mutate systems.  
Controls: no authority secrets in nodes, separate policy service, scoped capabilities, executor validation, action allowlists, two-person approval, no direct code mutation.

### Cross-Tenant Exposure

Controls: tenant-bound identities, database/object policies, encryption context, authorization on every read, tenant-aware caches, isolation tests, de-identified analytics.

### Billing Manipulation

Controls: Stripe signature verification, idempotency, append-oriented evidence, provider reconciliation, separation of estimate and finalized billing.

## Prompt and Tool Injection

Model-generated text is untrusted. Natural-language text never grants authority.

Controls:

- Structured action contracts
- Tool allowlists
- YellowJacket admission
- Evidence separated from generated summary
- Schema validation and provenance
- Sanitization
- No direct execution of model-generated shell commands without governed translation/approval

## Data Doctrine

Collect the minimum evidence necessary.

```text
metadata → hashes → derived features → redacted snippets
→ raw content only when explicitly required and authorized
```

Cloud availability does not imply all local content belongs in the cloud.

## Storage Responsibilities

### DataForge Local

- Detailed local events and agent/model runs
- Repository-scoped evidence
- Local data access
- Raw local artifacts allowed by user policy
- Offline queue
- Local incidents and receipts
- Redaction results

### DataForge Cloud

- Tenant/account identifiers
- Cloud usage/cost
- Entitlement/billing evidence
- Cloud identity/session/key events
- Provider/model route evidence
- Approved fleet analytics
- Cloud incidents and receipts
- Aggregated local findings

### Centipede

- Evidence bundle import
- Reconciliation
- Chain of custody
- Incident projection
- Deterministic replay linkage

## Data Classes

| Class | Examples | Default cloud rule |
|---|---|---|
| Public | Model catalog, public provider status | Allowed |
| Internal | Service health, route IDs | Allowed |
| Confidential | Tenant usage, incident detail, repo metadata | Tenant-bound and purpose-limited |
| Restricted | Secrets, tokens, raw private code/content | Prohibited unless explicitly authorized |
| Regulated | Contract/legal-specific data | Policy-specific |

Secrets never belong in event payloads; use fingerprints and secret-manager references.

## Content Handling

### Prompts/Outputs

Default cloud record: size, token count, class, provider, route, hash, policy result, and outcome—not full content.

### Source Code

Detailed code evidence stays local by default. Cloud may receive repository ID, files changed, patch size, category, tests, outcome, and hashes. Source excerpts require purpose and policy.

### Manuscripts/Author Content

Protected customer content. Security telemetry does not ingest prose unless explicitly submitted for analysis.

## Tenant Isolation

- Tenant ID required on every scoped record
- Tenant-bound service authorization
- Tenant-aware storage and cache keys
- No cross-tenant joins in operational APIs
- Aggregation receives minimized approved fields
- CI and production canary isolation tests

## Logical Records

```text
sentinel_events
sentinel_evidence
sentinel_features
sentinel_baselines
sentinel_findings
sentinel_incidents
sentinel_incident_links
sentinel_policy_decisions
sentinel_action_requests
sentinel_action_receipts
sentinel_operator_decisions
sentinel_feedback_labels
sentinel_model_registry
sentinel_model_evaluations
sentinel_provider_fingerprints
sentinel_retention_jobs
sentinel_access_audit
```

## Retention Classes

| Class | Typical use | Example |
|---|---|---|
| `transient_7d` | Debug telemetry | 7 days |
| `ops_30d` | Routine operations | 30 days |
| `security_365d` | Security evidence | 365 days |
| `billing_contract` | Billing/entitlement | Legal/contract rule |
| `incident_extended` | Confirmed material incident | Approved extension |
| `local_user_controlled` | Protected local content | User-controlled |

Exact retention is configurable by product, tenant, data class, and legal requirement. Retention actions create receipts.

## Integrity

- Event hashes
- Producer signatures for high-value events
- Signed entitlements
- Verified Stripe signatures
- Hash-linked receipts where useful
- Key IDs and rotation records
- Versioned critical objects
- WAL/reconciliation for offline evidence

Integrity proves non-tampering, not producer truthfulness.

## Roles and Separation of Duties

```text
sentinel_viewer
sentinel_operator
sentinel_security_admin
sentinel_policy_admin
sentinel_model_admin
billing_operator
support_limited
auditor
```

- Policy admins cannot silently promote models.
- Model admins cannot change enforcement policy.
- Billing operators cannot read raw customer content.
- Support access is tenant-scoped and time-limited.

## Audit

Audit incident reads, evidence exports, policy/model changes, trust resets, operator actions, dismissals, rollbacks, entitlement/key/session changes, retention changes, dataset creation, and role changes.

Every audit entry has actor, scope, reason, before/after reference, and integrity hash.

## Training/Analytics Eligibility

Represent explicitly:

```text
analytics_allowed
security_analysis_allowed
training_allowed
cross_tenant_aggregation_allowed
support_access_allowed
retention_class
purpose
```

No record is automatically eligible for training or cross-tenant analytics.

## Abuse Cases to Test

1. Slow usage increase designed to poison baseline.
2. Gradual agent patch expansion.
3. Provider changes model behind alias.
4. Duplicate/reordered/delayed signed events.
5. Repeated operator dismissal of real incidents.
6. Legitimate new-customer bulk migration.
7. Replayed Stripe webhook.
8. Cloud outage during quota exhaustion.
9. Prime outage while hard entitlement check occurs.
10. Incident proposes broader action than evidence supports.
11. Valid JSON action contains expanded malicious target.
12. Private local content accidentally enters cloud telemetry.
13. Cross-tenant cache collision.
14. Cheap challenger fails security tests.
15. Rollback fails after restriction.
