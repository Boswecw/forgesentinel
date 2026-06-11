# Vision and Doctrine


## 2026-06-11 CSSA Boundary Doctrine

Sentinel and CSSA are complementary rather than competing security systems.

```text
CSSA = deterministic prevention at the cloud boundary
Sentinel = persistent intelligence across boundaries and time
```

CSSA may deny, redact, quarantine, reserve quota, or require approval because authenticated contracts and policy explicitly authorize those outcomes. Sentinel may identify patterns and request bounded action, but its natural-language briefings and incident records are never themselves authority.

A Sentinel outage must not weaken CSSA. A CSSA outage or uncertain gate state follows CSSA fail-closed law for governed cloud execution. Safe unrelated local work remains available according to product policy.

CSSA's watchdog emits deterministic edge findings. Sentinel nodes may enrich those findings, and Sentinel Prime decides whether they join or form an ecosystem incident. Forge_Command owns the incident lifecycle after formation.

## Mission

> Detect unsafe or abnormal behavior early, explain the evidence, and route the smallest governed response without becoming an unbounded autonomous authority.

Sentinel combines local and cloud observations across agents, models, providers, identity, licenses, costs, and data movement. Traditional endpoint and runtime agents remain the immediate collectors and hard controls; Sentinel becomes the persistent intelligence layer.

## Agent vs. Node

### Security Agent

- Close to the workload or endpoint
- Optimized for immediate collection and enforcement
- Uses signatures, rules, runtime policy, and bounded ML
- Emits trustworthy telemetry and receipts

### Security Node

- Maintains durable behavioral context
- Correlates weak signals over time
- Builds scoped baselines
- Produces findings and threat hypotheses
- Explains uncertainty
- Requests governed action
- Learns only from validated outcomes

## Governing Principles

### Evidence Before Inference

Every finding names:

- Source event IDs and producer
- Event and observation times
- Schema and transformation versions
- Integrity state
- Feature-definition version
- Rule/model version
- Baseline reference
- Correlation path

A polished summary never substitutes for evidence.

### Intelligence and Authority Stay Separate

Sentinel may observe, score, correlate, recommend, request review, and request a bounded action. It may not independently:

- Patch or promote code
- Change an entitlement or Stripe customer state
- Permanently revoke a license
- Delete customer data
- Rotate credentials
- Expand its own permissions
- Edit its own production policy
- Retrain and promote itself

### Fail Closed at Security Boundaries; Fail Safe for Availability

- Invalid entitlement signature: deny paid cloud privilege.
- Invalid action capability: deny action.
- Missing durable receipt store: deny destructive action.
- Sentinel outage: retain IAM, YellowJacket, signed entitlement, static policy, and quota controls.
- Sentinel outage: do not disable unrelated safe local drafting or offline work.

### Local and Cloud Are Separate Trust Zones

Cloud services are available to all customers, with included usage and paid overage, but local-first privacy still governs data handling.

- Detailed local code/content evidence stays in DataForge Local by default.
- Cloud receives approved metadata, hashes, features, entitlement/billing evidence, provider telemetry, and security summaries.
- Raw code, prompts, manuscripts, or private content require a declared purpose and explicit policy.

### Immutable Provenance

Corrections append; they do not erase.

```text
Event → correction/annotation → finding → incident
→ decision → action receipt → outcome → reviewed label
```

### Scoped Trust

Trust is scoped by:

```text
provider + model fingerprint + endpoint + region
+ task category + route class + tool profile
+ repository/product class + evaluation suite + time window
```

Success on documentation cleanup does not confer authority for authentication or tenant-isolation changes.

### No Hidden Self-Modification

Changes to features, thresholds, rules, models, policies, retention, or automated actions require:

1. Versioned proposal
2. Replay
3. Evaluation
4. Approval
5. Shadow or staged deployment
6. Monitoring
7. Rollback
8. Receipt

### Explainability Is a Product Requirement

The operator must be able to answer:

1. What happened?
2. Where?
3. Why is it abnormal?
4. Which evidence supports it?
5. How confident is Sentinel?
6. What is uncertain or missing?
7. What is recommended?
8. Who has authority?
9. What was actually done?

## Objectives

### Security

- Detect account compromise, credential abuse, agent drift, data exfiltration, provider regression, cost runaway, license abuse, and contract violations.
- Prevent untrusted model routes from handling sensitive work.
- Preserve a complete decision and action chain.

### Business

- Protect included cloud quotas and paid overage.
- Reduce accidental and malicious provider spend.
- Support billing disputes, customer support, fleet oversight, and AAR with evidence.
- Keep Forge_Command as the business central control plane.

### Engineering

- Contract-first integration
- Deterministic replay
- Component isolation
- Shadow before enforcement
- Provider/model version awareness
- Measurable calibration
- Degraded-mode operation

## Non-Goals

Sentinel is not:

- A replacement for IAM, MFA, endpoint security, secrets management, or network controls
- An autonomous SOC with unrestricted powers
- A source-code mutation authority
- A universal truth engine
- A customer-content surveillance system
- A monolithic model
- A global provider popularity leaderboard

## Success Measures

Measure per incident family:

- Precision and recall
- False-positive and false-negative rate
- Calibration error
- Detection delay
- Percentage with complete evidence
- Percentage of actions with valid receipts
- Rollback success
- Operator disagreement
- Cost exposure prevented or contained
- Data-minimization compliance
- Tenant-isolation test success

High alert volume is failure, not success.

## Core Terms

| Term | Meaning |
|---|---|
| Event | Immutable observation from a producer |
| Evidence | Validated event or derived artifact supporting a conclusion |
| Feature | Versioned value derived from evidence |
| Finding | Node-level conclusion before incident formation |
| Incident | Governed case with evidence, risk, recommendation, and lifecycle |
| Receipt | Integrity-protected proof of decision or action |
| Baseline | Expected behavior for a scoped subject/window |
| Drift | Meaningful change from baseline or contract |
| Evidence quality | Completeness, freshness, integrity, and source reliability |
| Trust vector | Multi-dimensional, task-scoped route performance and risk profile |
| Champion | Preferred model/rule/configuration for one defined scope |
| Challenger | Candidate evaluated in replay, shadow, or bounded traffic |
