# Policy, Enforcement, and Authority


## 2026-06-11 CSSA Control Directive

Sentinel-originated cloud restrictions require a signed, scoped, expiring control artifact. Raw incident state is never consumed as policy.

```json
{
  "schema_version": "cloud_security.control_directive.v1",
  "control_id": "ctl_...",
  "incident_id": "inc_...",
  "policy_decision_id": "pdec_...",
  "issuer": "forge-command-policy",
  "issued_at": "2026-06-11T16:00:00Z",
  "expires_at": "2026-06-11T16:15:00Z",
  "action": "cssa.cloud_route.hold",
  "target": {
    "tenant_id": "ten_...",
    "principal_id": "user_...",
    "executor_id": "agent_...",
    "cloud_service": "neuroforge",
    "provider": "provider_a",
    "model_fingerprint": "sha256:..."
  },
  "scope": "single_executor_single_route",
  "max_uses": 1,
  "rollback": {
    "required": true,
    "action": "cssa.cloud_route.release"
  },
  "reason_codes": ["SENTINEL_COMPOUND_COMPROMISE"],
  "signature": "base64:..."
}
```

CSSA validates issuer, signature, expiry, exact target, action allowlist, use count, incident/policy references, and rollback requirements. It rejects widened scope, replay, mutation, unknown critical fields, or unsupported actions.

### Updated anomaly-hold doctrine

CSSA may enforce `ANOMALY_HOLD` only through an authenticated control directive or authenticated standing policy. A finding or incident record alone cannot create a hold.

## Core Rule

Sentinel intelligence and enforcement authority remain separate.

```text
Sentinel: "Evidence supports possible compromise."
Policy: "This class may pause one new API key."
Authority: "I own that capability."
Executor: "I executed the exact approved request."
Receipt: "This is what happened and how to reverse it."
```

## Action Classes

### Class 0 — Observe

- Record evidence
- Update features/baselines
- Create low-priority finding

### Class 1 — Recommend

- Request review
- Request sandbox replay
- Suggest model shadow evaluation
- Suggest data-export review

### Class 2 — Guard

Reversible, low-impact, pre-approved controls:

- Increase logging for a bounded period
- Reduce retry limit
- Disable tools for one route
- Require reauthentication
- Hold a newly suspicious key
- Route sensitive work away from a degraded model snapshot

### Class 3 — Restrict

Operator-approved or strict-policy controls:

- Throttle one actor/route
- Pause one key
- Quarantine one agent version
- Block one export destination
- Block one model snapshot for one task category

### Class 4 — Suspend

High-impact temporary actions:

- Suspend cloud access for one account
- Suspend one service identity
- Disable a provider route across production
- Freeze paid overage

Requires strong evidence, explicit rollback, and elevated approval except under narrow emergency policy.

### Class 5 — Revoke or Destruct

- Permanently revoke license
- Delete credentials or customer data
- Terminate account
- Apply irreversible source/infrastructure mutation

Sentinel never autonomously performs Class 5 actions.

## Authority Map

| Domain | Authority |
|---|---|
| Runtime/tool admission | YellowJacket |
| Exact approved execution | Hermes / FA Local |
| Source/config mutation | SMITH / forge-smithy |
| Incident review | Forge_Command operator |
| License/feature/quota/device | Entitlement service |
| Billing truth | Stripe-verified billing service |
| Session/key/MFA | Identity service |
| Provider/model routing | NeuroForge |
| Durable evidence | DataForge |
| Reconciliation/projection | Centipede |
| Permanent customer/business action | Authorized business/security owner |

## Policy Inputs

```text
incident type and subject
tenant, product, environment
likelihood, impact, confidence, evidence quality
asset criticality and blast radius
recommended action and class
reversibility and rollback readiness
cooldown and prior actions
entitlement, identity, and provider state
local/cloud lane
operator availability and emergency state
```

## Policy Result

```json
{
  "policy_decision_id": "pdec_...",
  "incident_id": "inc_...",
  "policy_id": "sentinel_account_compromise",
  "policy_version": "3.1.0",
  "result": "REQUEST_OPERATOR",
  "allowed_actions": [
    {
      "action_type": "identity.api_key.pause",
      "scope": "single_key",
      "expires_in_seconds": 900,
      "requires_approval": "single_operator"
    }
  ],
  "denied_actions": [
    {
      "action_type": "license.permanent_revoke",
      "reason": "Sentinel cannot authorize irreversible commercial revocation."
    }
  ]
}
```

## Example Policy

```yaml
policy_id: sentinel_account_compromise
version: 3.1.0
match:
  incident_type: compound.account_compromise
  environment: production

rules:
  - when:
      likelihood_gte: 0.80
      confidence_gte: 0.75
      evidence_quality_gte: 0.85
      independent_signal_count_gte: 3
      includes_signal:
        - identity.new_api_key
        - identity.new_region
    allow:
      - action: identity.api_key.pause
        scope: single_key
        approval: single_operator
        reversible: true
      - action: identity.mfa.require
        scope: account
        approval: policy_allowed
        reversible: true

  - when:
      impact_gte: 0.90
      active_data_exfiltration: true
      evidence_quality_gte: 0.95
    allow:
      - action: identity.session.revoke
        scope: affected_sessions
        approval: emergency_policy

always_deny:
  - license.permanent_revoke
  - customer_data.delete
  - source_code.direct_patch
```

## Approval Levels

```text
policy_allowed
single_operator
elevated_operator
two_person
business_owner
security_owner
customer_confirmation
```

Permanent commercial, destructive, or broad production actions require two-person or owning-business approval.

## Scoped Capability Tokens

Approved actions use short-lived signed capabilities containing:

- Action type
- Exact target and scope
- Incident and policy-decision IDs
- Issuer and executor
- Expiration
- Maximum attempts
- Rollback requirement
- Signature

Executors reject:

- Expanded target/scope
- Changed action
- Expired or replayed token
- Missing incident/decision
- Unsupported rollback
- Unknown fields that affect scope

## Rollback

Every reversible action requires:

- Pre-action state reference
- Rollback action and authority
- Expiration or restoration condition
- Verification
- Failure handling
- Receipt

| Action | Rollback |
|---|---|
| Pause key | Resume after verification |
| Throttle route | Restore prior quota |
| Quarantine snapshot | Restore prior routing weight |
| Disable agent tool | Restore prior permission set |
| Block destination | Remove temporary block |
| Increase logging | Return to normal collection |

No automatic action is ready until rollback has been exercised.

## Cooldown and Hysteresis

- Minimum hold period after containment
- Higher trigger threshold than release threshold
- Stable evidence required before release
- Maximum action frequency
- Escalation after recurrence
- Operator lock to prevent automated reversal

## Emergency Containment

Permitted only for active, narrow, high-confidence threats:

- Revoke actively abused sessions
- Pause one compromised key
- Block an active cross-tenant request
- Stop an agent attempting forbidden access
- Deny a provider route issuing contract-violating tool actions

Requirements:

- Direct active-threat evidence
- High evidence quality
- Smallest scope
- Immediate receipt and operator notification
- Automatic review deadline
- No permanent commercial penalty
- No source-code mutation

## Operator Override

Operator may approve, deny, modify within policy, defer, dismiss, escalate, or roll back. The override records original recommendation, changed decision, reason, actor/authority, evidence viewed, time, expiration, and training-eligibility status.

## Policy Change Governance

1. Versioned proposal and diff
2. Threat/blast-radius review
3. Historical and adversarial replay
4. Approval
5. Staged deployment
6. Monitoring
7. Rollback
8. Receipt

Sentinel models may propose policy text but cannot deploy it.
