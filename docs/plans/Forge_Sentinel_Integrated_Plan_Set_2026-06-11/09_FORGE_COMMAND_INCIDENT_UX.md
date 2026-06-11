# Forge_Command Sentinel Incident Experience


## 2026-06-11 Unified CSSA/Sentinel Incident Experience

Forge_Command shows one incident lifecycle even when CSSA and several Sentinel nodes contributed evidence.

Add source badges:

```text
CSSA-GATE
CSSA-EGRESS
CSSA-WATCHDOG
CSSA-RECORDER
```

The detail drawer separates:

- **Original behavior**
- **CSSA standing-policy decisions**
- **Sentinel interpretation**
- **Approved control**
- **CSSA enforcement result**
- **Rollback and later outcome**

Every cloud action card shows the exact CSSA target and whether the control is standing policy, operator-approved, emergency, or Sentinel-originated. A CSSA finding never appears as already resolved merely because the gate blocked one request.

## Product Goal

The primary Sentinel page is a clean operator decision surface, not a telemetry wall.

For each active incident, the operator should immediately see:

- What is wrong
- Where it is
- Where the proposal came from
- Risk, confidence, and evidence quality
- Recommended fix
- Required authority
- Current state
- Whether the action is reversible
- Completed receipt stub after resolution

Local and cloud incidents share one surface but remain clearly labeled.

## Primary List

| Column | Meaning |
|---|---|
| Priority | Critical, High, Medium, Low |
| Incident | One-line issue briefing |
| Location | Account, service, agent, model route, repo, device, data object |
| Source | Local, Cloud, Correlated |
| Proposed by | Sentinel node(s), Centipede, FailureForge, provider monitor, operator |
| Recommendation | Short action summary |
| Authority | Operator, YellowJacket, SMITH, Identity, Entitlement, NeuroForge |
| Age | Time since incident formation |
| State | Open, Review, Action Pending, Monitoring, Resolved |

Order by:

```text
active threat → impact → confidence → age
```

Do not sort only by anomaly score.

## Incident Row

```text
HIGH  Possible account compromise
      NeuroForge Cloud / Account acct_2041
      Source: CLOUD · Sentinel-Cost + Sentinel-Cloud
      Recommendation: Pause new API key and require MFA
      Authority: Identity + Operator
      Opened: 12 minutes ago
```

## Detail Drawer

Opening a row should preserve list context.

### Header

```text
Incident #443
Possible account compromise
Risk: High
Likelihood: 82%
Confidence: 81%
Evidence quality: 94%
Source: Correlated Cloud
Status: Review Required
```

### Briefing

**Issue**  
Token usage increased 150x and is linked to a new API key, new country, new browser/device, and repeated login failures.

**Where**  
NeuroForge cloud access for account `acct_2041`; key fingerprint `…7fa2`.

**Why it matters**  
Each change is inconclusive alone, but shared timing and the same key form a correlated compromise pattern.

**Recommended fix**  
Pause only the new key, require MFA, and review the last 24 hours.

**Authority**  
Identity service executes. Operator approval is required. The key pause is reversible.

### Evidence Summary

```text
150x token increase                    last 24h
New API key                            38m ago
First access from new country          34m ago
New browser/device                     34m ago
7 failed logins                        41m–36m ago
Normal account history                 prior 90d
```

Every evidence item opens the source event and provenance.

### Timeline

```text
16:39 Failed login
16:42 New API key created
16:43 New region/device observed
16:45 Usage acceleration begins
17:02 Sentinel-Cost finding
17:03 Sentinel-Cloud finding
17:04 Sentinel Prime incident
17:08 Operator opened incident
```

### Action Cards

Show exact target, scope, authority, reversibility, expected effect, action risk, approval requirement, expiration, and rollback.

### Controls

```text
Approve selected actions
Modify within policy
Dismiss
Defer
Escalate
Request more evidence
Open Self-Healing / SMITH proposal
```

No generic **Fix Everything** button.

## Source Badges

```text
LOCAL
CLOUD
CORRELATED
CENTIPEDE
FAILUREFORGE
SENTINEL-COST
SENTINEL-AGENT
SENTINEL-CLOUD
SENTINEL-LICENSE
SENTINEL-DATA
SENTINEL-PROVIDER
OPERATOR
```

## Lifecycle

```text
OPEN
ACKNOWLEDGED
INVESTIGATING
ACTION_PENDING
CONTAINED
MONITORING
RESOLVED
DISMISSED
REOPENED
```

- `CONTAINED` means immediate risk is limited, not root cause fixed.
- `RESOLVED` requires outcome evidence.
- `DISMISSED` requires reason.
- `REOPENED` links the prior decision and new evidence.

## Completed Stub

```text
RESOLVED · Incident #443
Possible account compromise

Action:
- Paused API key …7fa2
- Required MFA
- Reviewed 24h activity

Outcome:
No additional unauthorized activity detected during monitoring.

Completed by:
Operator op_17 + Identity service

Receipts:
rcpt_91a… · rcpt_91b…

Resolved:
2026-06-09 14:42 EDT
```

The stub remains searchable and opens the full chain.

## Self-Healing Integration

```text
Sentinel incident
→ Centipede normalized evidence
→ Forge_Command Self-Healing proposal
→ Operator review
→ SMITH governance
→ YellowJacket admission
→ Hermes execution
→ Verification + receipt
```

Applicable examples:

- Entitlement validator defect
- Provider adapter contract regression
- Agent permission leak
- Redaction failure
- Retry storm caused by code/config defect

Sentinel provides evidence and recommended scope; it never labels a repair inherently safe.

## Filters

- Active / Completed
- Priority
- Local / Cloud / Correlated
- Node/source
- Authority required
- Incident type
- Product/tenant
- Time range

Search covers incident ID, account, service, agent, route, repository, provider, and model fingerprint.

## Notifications

- Critical active containment: immediate
- High requiring approval: immediate
- Medium: grouped
- Low: digest
- Duplicate signals update existing incident
- Escalation/action failure/rollback failure: notify

## Accessibility and Safety

- Never rely on color alone.
- Show likelihood, impact, confidence, and evidence quality separately.
- Use absolute timestamps in detail view.
- Show exact action scope before confirmation.
- Distinguish irreversible actions.
- Require typed confirmation for exceptional high-impact action.
- Keep rollback visible beside action.
- Expose missing evidence instead of hiding it behind AI prose.
