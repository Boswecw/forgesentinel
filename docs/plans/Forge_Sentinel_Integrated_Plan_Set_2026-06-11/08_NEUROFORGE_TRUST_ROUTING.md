# NeuroForge Trust-Aware Routing


## 2026-06-11 Three-Layer Route Decision

NeuroForge route selection now has three explicit layers:

```text
1. CSSA hard legal/security eligibility
2. Sentinel trust restrictions and incident context
3. NeuroForge EMA utility optimization
```

CSSA determines whether the principal, entitlement, data class, provider, model, region, action, quota, and tool chain are permitted. Sentinel may narrow the eligible set through signed policy controls based on durable risk evidence. NeuroForge selects the best remaining route using EMA performance, category-specific trust, cost, latency, and availability.

Neither Sentinel nor NeuroForge may widen a candidate set that CSSA has denied.

## Purpose

NeuroForge already owns the EMA champion and a self-updating model ladder across providers. Sentinel does not replace it. Sentinel-Provider adds security, identity integrity, policy compatibility, drift detection, and evidence quality.

```text
EMA performance champion
        +
Sentinel trust vector and restrictions
        +
NeuroForge hard eligibility and optimization
        =
route decision
```

## No Global Trust Score

Unsafe:

```text
Provider/model A: 94
Provider/model B: 91
```

Useful:

```yaml
provider: provider_a
model_snapshot: model-2026-06-01
task_category: typescript.type_fix
route_class: code_mutation_supervised
tool_profile: read_patch_test_v2
repository_class: svelte_tauri_application
evaluation_suite: codefix-v7
window: last_500_eligible_runs
trust_vector:
  compile_success: 0.96
  targeted_test_success: 0.93
  rollback_rate: 0.02
  contract_validity: 0.99
  tool_policy_compliance: 1.00
  security_regression_rate: 0.01
  latency_score: 0.72
  cost_efficiency: 0.64
  evidence_quality: 0.92
```

## Immutable Route Identity

Record:

- Provider and provider account/project
- API endpoint and region
- Declared model name
- Provider model ID/snapshot/date
- Deployment or weights fingerprint where exposed
- Context window
- Reasoning mode
- Tool configuration
- Structured-output mode
- Prompt/spec bundle hash
- Safety settings
- Sampling class
- Gateway version

If an alias changes materially:

1. Emit a fingerprint-change finding.
2. Reduce/reset inherited trust.
3. Move the new fingerprint to provisional/challenger state.
4. Re-run critical category evaluations.
5. Permit only bounded low-risk traffic by policy.

## Code-Fix Taxonomy for Routing

### A. Mechanical and Local

- Formatting, lint, imports, syntax, typo/rename
- Dead code, comments/docs, dependency metadata

### B. Type and Compile

- Type mismatch, trait/interface, generic constraint
- Rust borrow/lifetime
- Module/export, build configuration, feature flag
- Generated binding mismatch

### C. Test Repair

- Unit, integration, snapshot, fixture
- Flaky test, mock/stub, timing/concurrency, environment-dependent

### D. Runtime Defect

- Null/undefined
- Error propagation
- State management
- Resource leak
- Concurrency/race
- Performance
- Serialization
- Network/retry

### E. Contract and Integration

- API/schema/event contract
- Provider adapter
- Auth/authz integration
- Database migration
- Cross-repository change
- Tauri/Svelte bridge
- Local/cloud reconciliation

### F. Security Sensitive

- Authentication and authorization
- Cryptography and secrets
- Tenant isolation
- Validation/injection
- Supply chain/sandbox
- Data exfiltration
- Billing/entitlement enforcement

### G. Architecture and Refactor

- Module/service boundaries
- Large refactor
- State-machine redesign
- Persistence/reliability/failover
- Performance architecture

### H. Governance and Operations

- Policy-as-code
- CI/CD and release
- Observability
- Incident response
- Migration/runbook/compliance
- Rollback design

Each leaf category defines required capabilities, max mutation scope, tests, minimum trust, security sensitivity, eligible routes, escalation, and verification.

## Route Decision Stages

### 1. Hard Eligibility

Reject when:

- Provider unavailable or quarantined
- Model fingerprint unknown for sensitive work
- Data/region policy incompatible
- Tool profile exceeds permission
- Context or structured-output support unverified
- Security-category trust below threshold
- Entitlement or budget disallows route
- Active route incident exists

### 2. Candidate Utility

Compare eligible routes using:

- Predicted task/evaluation success
- Cost and latency
- Availability/queue
- Cache potential
- Trust vector
- Security and rollback risk
- Evidence freshness

### 3. Champion/Challenger

- Champion receives normal eligible traffic.
- Challenger receives shadow or bounded traffic.
- Sensitive work stays on validated champions.
- No promotion on cost alone.
- Promotion is scoped to category and route class.

### 4. Post-Run Evidence

Record selected and rejected routes/reasons, fingerprint, cost, latency, contract validity, evaluation, patch result, rollback, incident links, and operator feedback.

## EMA Relationship

EMA measures recent task performance. It does not override:

- Unknown fingerprint
- Security regression
- Data-region conflict
- Tool-policy violation
- Contract failures
- Active incidents

## Provider/Model Change Handling

Monitor catalog changes:

- New/removed/deprecated model
- Alias or snapshot change
- Context/tool/structured-output change
- Price/rate-limit/region change
- Endpoint behavior change

State transitions:

```text
known verified snapshot → normal trust
new snapshot → provisional
material change → reduced inherited trust
failed evaluation → quarantined
validated challenger → scoped promotion
```

Deprecation requires dependency discovery, replacement evaluation, route-policy update, historical identity retention, and migration receipt.

## Security-Sensitive Rules

For authentication, authorization, cryptography, tenant isolation, billing/entitlement, or data boundaries:

- Known verified fingerprint
- High contract validity and tool compliance
- Low rollback/security-regression rate
- SMITH governance
- Targeted security tests
- Independent review route for high blast radius
- Human review where mutation scope is high
- Provider self-evaluation cannot be the only proof

## Provider Risk Signals

- 5xx/timeout/rate-limit shift
- Billing mismatch or price change
- Alias/fingerprint change
- Structured-output/tool-call violations
- Refusal behavior change
- Region/privacy/retention change
- Hallucination/unsupported-claim increase
- Patch success decline and rollback increase
- Security incident
- Provider status conflicting with observed behavior

## Trust Reset Triggers

- Model fingerprint or endpoint change
- Material prompt/spec change
- Expanded tools
- Evaluation-suite or taxonomy change
- Repository/product class change
- Linked security incident
- Stale evidence
- Contract behavior change

Do not carry mature trust into a materially different route because the marketing name stayed the same.
