# Risk, Learning, and Calibration


## 2026-06-11 Control-Effect and Feedback-Loop Rules

Sentinel must separate four different signal classes:

1. Natural workload or attacker behavior.
2. CSSA decisions made from standing deterministic policy.
3. CSSA decisions caused by a Sentinel-originated signed control.
4. Operator overrides and rollbacks.

Policy-caused denials, throttles, redactions, or quarantines are operational outcomes, not independent confirmation of the original hypothesis.

### Calibration record extension

```text
origin_signal
standing_policy_effect
sentinel_control_effect
operator_effect
rollback_effect
later_external_outcome
```

A reviewed label may conclude that the recommendation was useful, unnecessary, harmful, or inconclusive. No control outcome automatically becomes a true-positive label.

## Design Goal

Detect meaningful change without becoming an opaque self-training system.

```text
Deterministic rules
+ robust statistical baselines
+ correlation graph
+ evaluated ML where justified
+ reviewed outcome feedback
```

Start transparent and replayable. Add ML only when it beats simpler methods on a defined incident family.

## Separate Risk Dimensions

### Likelihood

Probability that the threat or failure hypothesis is true.

### Impact

Consequence if true.

### Confidence

Stability of the inference given uncertainty and evidence coverage.

### Evidence Quality

Completeness, freshness, integrity, independence, and source reliability.

### Priority

Policy-derived urgency using risk, asset criticality, blast radius, reversibility, and time sensitivity.

Do not reduce these to one unexplained anomaly number.

## Baseline Hierarchy

Use the most specific valid baseline, then back off:

```text
actor + category + route + hour-of-week
actor + route + day-of-week
tenant + category
tenant + route
product cohort
global safe cohort
```

Each baseline stores scope, feature version, period, sample count, seasonality, distribution, known change windows, confidence, expiration, incident exclusions, and source quality.

## Initial Methods

### Robust Change Detection

Median and median absolute deviation for heavy-tailed features such as tokens, cost, patches, files, login failures, egress, retries, and latency.

### EMA/EWMA

For slowly changing provider latency, patch success, rollback, cost per success, structured-output validity, and evaluation pass rate.

NeuroForge's EMA champion remains a performance signal; Sentinel adds security, identity, drift, and evidence quality.

### Change-Point Detection

Find sustained regime shifts after provider snapshots, agent releases, deployments, price changes, legitimate travel, or product launches.

### Novelty

First-seen or rare key, device, region, tool, repository, endpoint, model fingerprint, destination, or data class. Novelty alone rarely justifies enforcement.

### Correlation Graph

```text
account ─ uses ─ key ─ calls ─ route ─ selects ─ model snapshot
agent ─ modifies ─ repository
session ─ originates ─ device/region
event ─ accesses ─ data object
incident ─ triggers ─ action
```

## Compound Evidence

Example:

```text
Usage increase             weak/moderate
New API key                weak
New country/device         weak/moderate
Failed login burst         moderate
Shared timing/key          strong correlation
-----------------------------------------------
Compromise hypothesis      high
```

Rules:

- Track independent root evidence.
- Do not count derived copies as separate sources.
- Apply time decay.
- Preserve contradictory evidence.
- Lower confidence when expected telemetry is missing.
- Name temporal or causal relationships.

## Risk Composition

Policy owns final composition. A conceptual structure:

```text
adjusted likelihood = base likelihood
× evidence-quality adjustment
× correlation strength
× freshness
× independence factor
```

Impact remains separate. Priority uses likelihood, impact, confidence, criticality, blast radius, reversibility, time sensitivity, and policy.

Exact formulas are versioned and calibrated per incident family.

## Explainability Package

Every finding exposes:

- Expected range and observed value
- Magnitude and duration
- Top factors
- Total and independent evidence counts
- Missing sources
- Conflicts
- Similar prior incidents
- Rule/model/feature versions
- Threshold crossed
- Next evidence that would reduce uncertainty

Generated prose cannot invent an explanation after the fact; it must summarize recorded factors.

## Governed Learning Loop

```text
Event → validated evidence → versioned features → finding → incident
→ decision/action → observed outcome → reviewed label
→ calibration dataset → candidate → offline evaluation
→ shadow challenger → bounded promotion
```

### Training Eligibility

A record enters a training dataset only when:

- Data classification and tenant policy allow it.
- Required redaction is complete.
- Provenance and label quality are sufficient.
- Duplicate/leakage controls pass.
- Purpose and dataset version are declared.
- Evaluation splits keep related incidents together.

## Champion/Challenger

Each incident family has its own champion:

```text
cost_runaway
account_compromise
agent_drift
provider_regression
license_abuse
data_exfiltration
```

A challenger must pass:

- Holdout evaluation
- Historical and adversarial replay
- Calibration
- Privacy/security review
- Shadow deployment
- Stability test
- False-positive budget
- Rollback test

Promotion receipt records old/new champion, dataset, features, evaluation suite, metrics, approver, and rollback artifact.

## Drift Types

- **Data drift:** input distribution changed
- **Concept drift:** meaning changed, such as a product launch making high usage normal
- **Model drift:** detector accuracy declined
- **System drift:** producer, contract, provider alias, route, permission, or data source changed

System drift often pauses trust inheritance.

## Cold Start

- Use product/cohort baselines.
- Widen uncertainty.
- Limit automatic enforcement.
- Keep deterministic hard rules.
- Gather shadow evidence.
- Avoid calling legitimate onboarding growth compromise.

## Poisoning Resistance

- Exclude active incidents from baseline updates.
- Cap influence of short windows.
- Require stable minimum history.
- Freeze baselines during material incidents.
- Review labels.
- Separate override from training approval.
- Detect repeated boundary-pushing below thresholds.
- Store baseline versions.
- Restrict model/policy promotion roles.

## Feedback Quality

Track:

```text
node recommendation
policy decision
operator decision
action result
later outcome
```

Operators can be wrong or lack later evidence. Preserve the entire sequence.

## MVP vs. Later

### MVP

- Rules
- Robust statistics
- EMA/EWMA
- Novelty
- Time-window and graph correlation
- Calibrated policy thresholds

### Later

- Supervised classifiers by incident family
- Sequence models for agent behavior
- Graph models for identity/key/provider relationships
- Cost forecasting
- Causal analysis of releases/provider changes

All later models remain subordinate to evidence, policy, and authority.
