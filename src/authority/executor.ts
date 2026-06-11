import type { CapabilityToken } from "../contracts/capability.js";
import type { ActionReceipt } from "../contracts/receipt.js";
import type { CapabilityService } from "./capability.js";
import type { ReceiptService } from "./receipts.js";

/**
 * Identity authority adapter (02 authority adapters). The identity service —
 * not Sentinel — owns key/session/MFA state. It executes only the exact
 * approved action presented with a valid capability, and every attempt
 * (success, rejection, rollback) yields a receipt.
 */
export class IdentityAuthority {
  readonly audience = "identity-service";
  private readonly keyStates = new Map<string, "active" | "paused">();
  private readonly mfaRequired = new Set<string>();

  constructor(
    private readonly capabilities: CapabilityService,
    private readonly receipts: ReceiptService,
  ) {}

  registerKey(keyFingerprint: string): void {
    this.keyStates.set(keyFingerprint, "active");
  }

  keyState(keyFingerprint: string): "active" | "paused" | undefined {
    return this.keyStates.get(keyFingerprint);
  }

  mfaIsRequired(accountId: string): boolean {
    return this.mfaRequired.has(accountId);
  }

  execute(token: CapabilityToken, presented: { action: string; target: string; scope: string }, nowIso: string): ActionReceipt {
    const validation = this.capabilities.validate(token, { audience: this.audience, ...presented }, nowIso);
    const decision = {
      decision_id: token.claims.policy_decision_id,
      policy_id: "sentinel_account_compromise",
      policy_version: "3.1.0",
      result: "ALLOW_BOUNDED_ACTION",
      approver: { type: "operator", id: "via_capability" },
    };

    if (!validation.ok) {
      return this.receipts.create(
        {
          receipt_type: "sentinel.action",
          incident_id: token.claims.incident_id,
          decision,
          action: {
            requested: presented.action,
            executed: null,
            target_id: presented.target,
            scope: presented.scope,
            result: "rejected",
            failure_reason: validation.issues.map((issue) => `${issue.code}: ${issue.message}`).join("; "),
          },
          rollback: { supported: false },
          control_lineage: { policy_decision_id: token.claims.policy_decision_id },
        },
        nowIso,
      );
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    let result: "success" | "failure" = "success";
    let rollbackAction: string | undefined;

    switch (presented.action) {
      case "identity.api_key.pause": {
        const state = this.keyStates.get(presented.target);
        if (state === undefined) {
          result = "failure";
        } else {
          before["key_state"] = state;
          this.keyStates.set(presented.target, "paused");
          after["key_state"] = "paused";
          rollbackAction = "identity.api_key.resume";
        }
        break;
      }
      case "identity.api_key.resume": {
        const state = this.keyStates.get(presented.target);
        if (state === undefined) {
          result = "failure";
        } else {
          before["key_state"] = state;
          this.keyStates.set(presented.target, "active");
          after["key_state"] = "active";
        }
        break;
      }
      case "identity.mfa.require": {
        before["mfa_required"] = this.mfaRequired.has(presented.target);
        this.mfaRequired.add(presented.target);
        after["mfa_required"] = true;
        rollbackAction = "identity.mfa.release";
        break;
      }
      default:
        result = "failure";
    }

    return this.receipts.create(
      {
        receipt_type: "sentinel.action",
        incident_id: token.claims.incident_id,
        decision,
        action: {
          requested: presented.action,
          executed: result === "success" ? presented.action : null,
          target_id: presented.target,
          scope: presented.scope,
          result,
          ...(result === "failure" ? { failure_reason: "target unknown or action unsupported by this authority" } : {}),
        },
        before_state: before,
        after_state: after,
        rollback: rollbackAction ? { supported: true, action_type: rollbackAction } : { supported: false },
        control_lineage: { policy_decision_id: token.claims.policy_decision_id },
      },
      nowIso,
    );
  }

  /** Rollback is itself a receipted action referencing what it reverses. */
  rollback(original: ActionReceipt, nowIso: string): ActionReceipt {
    if (!original.rollback.supported || !original.rollback.action_type) {
      throw new Error(`receipt ${original.receipt_id} does not support rollback`);
    }
    const action = original.rollback.action_type;
    const target = original.action.target_id;
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    let result: "success" | "failure" = "success";

    if (action === "identity.api_key.resume") {
      const state = this.keyStates.get(target);
      if (state === undefined) {
        result = "failure";
      } else {
        before["key_state"] = state;
        this.keyStates.set(target, "active");
        after["key_state"] = "active";
      }
    } else if (action === "identity.mfa.release") {
      before["mfa_required"] = this.mfaRequired.has(target);
      this.mfaRequired.delete(target);
      after["mfa_required"] = false;
    } else {
      result = "failure";
    }

    return this.receipts.create(
      {
        receipt_type: "sentinel.rollback",
        incident_id: original.incident_id,
        decision: original.decision,
        action: {
          requested: action,
          executed: result === "success" ? action : null,
          target_id: target,
          scope: original.action.scope,
          result: result === "success" ? "rolled_back" : "failure",
        },
        before_state: before,
        after_state: after,
        rollback: { supported: false, rollback_of: original.receipt_id },
        ...(original.control_lineage !== undefined ? { control_lineage: original.control_lineage } : {}),
      },
      nowIso,
    );
  }
}
