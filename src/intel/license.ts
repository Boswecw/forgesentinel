import type { EventEnvelope } from "../contracts/envelope.js";
import type { EvidenceRecord } from "../contracts/evidence.js";
import type { Finding } from "../contracts/finding.js";
import { eventEvidence } from "./features.js";
import type { NodeOutput } from "./cost.js";

/**
 * Sentinel-License (03, SNT-140). Shadow mode, rule-first: entitlement
 * behavior is mainly deterministic, and learning detects abuse but never
 * replaces signature or verified billing truth (ADR-013). This node cannot
 * permanently revoke a license — that action is globally always-denied.
 */
export interface LicenseNodeConfig {
  shared_entitlement_device_count: number;
  trial_cycle_account_count: number;
  activation_churn_count: number;
  window_ms: number;
}

export const DEFAULT_LICENSE_CONFIG: LicenseNodeConfig = {
  shared_entitlement_device_count: 3,
  trial_cycle_account_count: 2,
  activation_churn_count: 5,
  window_ms: 24 * 3600 * 1000,
};

export class SentinelLicenseNode {
  readonly name = "sentinel-license";
  readonly version = "1.0.0";
  readonly shadow = true;

  private findingCounter = 0;

  constructor(private readonly config: LicenseNodeConfig = DEFAULT_LICENSE_CONFIG) {}

  private nextFindingId(): string {
    this.findingCounter += 1;
    return `fnd_license_${String(this.findingCounter).padStart(5, "0")}`;
  }

  process(events: EventEnvelope[]): NodeOutput {
    const findings: Finding[] = [];
    const evidence: EvidenceRecord[] = [];
    const licenseEvents = events.filter((event) => event.tenant?.tenant_id);

    // Deterministic: an entitlement rejected for signature failure already
    // failed closed at the service; the node records evidence-grade findings.
    for (const event of licenseEvents) {
      if (event.event_type === "license.entitlement.rejected" && event.payload["reason"] === "invalid_signature") {
        const record = eventEvidence(event, this.scopeOf(event));
        evidence.push(record);
        findings.push(this.finding("license.invalid_entitlement", event.tenant!.account_id ?? event.subject.subject_id, event, record, {
          likelihood: 0.8,
          impact: 0.7,
          confidence: 0.95,
          evidence_quality: record.quality.score,
        }, "An entitlement with an invalid Ed25519 signature was presented. The service denied it (fail closed); investigate the source.", "REQUEST_OPERATOR"));
      }
    }

    findings.push(...this.sharedEntitlements(licenseEvents, evidence));
    findings.push(...this.trialCycling(licenseEvents, evidence));
    findings.push(...this.activationChurn(licenseEvents, evidence));
    findings.push(...this.stripeDivergence(licenseEvents, evidence));
    return { findings, evidence };
  }

  /** One entitlement validated from many devices: shared account / device farm. */
  private sharedEntitlements(events: EventEnvelope[], evidence: EvidenceRecord[]): Finding[] {
    const findings: Finding[] = [];
    const byEntitlement = new Map<string, { devices: Set<string>; events: EventEnvelope[] }>();
    for (const event of events) {
      if (event.event_type !== "license.entitlement.validated") continue;
      const entitlementId = String(event.payload["entitlement_id"] ?? "");
      const device = String(event.payload["device_fingerprint"] ?? "");
      if (!entitlementId || !device) continue;
      const entry = byEntitlement.get(entitlementId) ?? { devices: new Set<string>(), events: [] };
      entry.devices.add(device);
      entry.events.push(event);
      byEntitlement.set(entitlementId, entry);
    }
    for (const [entitlementId, entry] of byEntitlement) {
      if (entry.devices.size < this.config.shared_entitlement_device_count) continue;
      const last = entry.events.at(-1)!;
      const record = eventEvidence(last, this.scopeOf(last));
      record.source_event_ids = entry.events.map((event) => event.event_id);
      record.source_event_root = `entitlement:${entitlementId}`;
      evidence.push(record);
      findings.push(this.finding("license.entitlement_shared", last.tenant!.account_id ?? last.subject.subject_id, last, record, {
        likelihood: 0.65,
        impact: 0.6,
        confidence: 0.8,
        evidence_quality: record.quality.score,
      }, `Entitlement ${entitlementId} validated from ${entry.devices.size} distinct devices within the window; possible shared account or device farm.`, "REQUEST_OPERATOR"));
    }
    return findings;
  }

  /** One device cycling trial entitlements across accounts. */
  private trialCycling(events: EventEnvelope[], evidence: EvidenceRecord[]): Finding[] {
    const findings: Finding[] = [];
    const byDevice = new Map<string, { accounts: Set<string>; events: EventEnvelope[] }>();
    for (const event of events) {
      if (event.event_type !== "license.entitlement.issued" || event.payload["plan"] !== "trial") continue;
      const device = String(event.payload["device_fingerprint"] ?? "");
      const account = event.tenant?.account_id ?? "";
      if (!device || !account) continue;
      const entry = byDevice.get(device) ?? { accounts: new Set<string>(), events: [] };
      entry.accounts.add(account);
      entry.events.push(event);
      byDevice.set(device, entry);
    }
    for (const [device, entry] of byDevice) {
      if (entry.accounts.size < this.config.trial_cycle_account_count) continue;
      const last = entry.events.at(-1)!;
      const record = eventEvidence(last, this.scopeOf(last));
      record.source_event_ids = entry.events.map((event) => event.event_id);
      record.source_event_root = `trial_device:${device}`;
      evidence.push(record);
      findings.push(this.finding("license.trial_cycling", last.tenant!.account_id ?? last.subject.subject_id, last, record, {
        likelihood: 0.7,
        impact: 0.55,
        confidence: 0.85,
        evidence_quality: record.quality.score,
      }, `Device ${device.slice(-8)} received trial entitlements under ${entry.accounts.size} different accounts.`, "REQUEST_OPERATOR"));
    }
    return findings;
  }

  private activationChurn(events: EventEnvelope[], evidence: EvidenceRecord[]): Finding[] {
    const findings: Finding[] = [];
    const byAccount = new Map<string, EventEnvelope[]>();
    for (const event of events) {
      if (event.event_type !== "license.device.activated") continue;
      const account = event.tenant?.account_id;
      if (!account) continue;
      byAccount.set(account, [...(byAccount.get(account) ?? []), event]);
    }
    for (const [account, activations] of byAccount) {
      const last = activations.at(-1)!;
      const windowStart = Date.parse(last.occurred_at) - this.config.window_ms;
      const inWindow = activations.filter((event) => Date.parse(event.occurred_at) >= windowStart);
      if (inWindow.length < this.config.activation_churn_count) continue;
      const record = eventEvidence(last, this.scopeOf(last));
      record.source_event_ids = inWindow.map((event) => event.event_id);
      record.source_event_root = `activation_churn:${account}`;
      evidence.push(record);
      findings.push(this.finding("license.activation_churn", account, last, record, {
        likelihood: 0.6,
        impact: 0.5,
        confidence: 0.8,
        evidence_quality: record.quality.score,
      }, `${inWindow.length} device activations within the window for one account.`, "RECOMMEND_ONLY"));
    }
    return findings;
  }

  /** Latest verified Stripe plan disagrees with the latest issued entitlement. */
  private stripeDivergence(events: EventEnvelope[], evidence: EvidenceRecord[]): Finding[] {
    const findings: Finding[] = [];
    const latestByAccount = new Map<string, { stripe?: EventEnvelope; entitlement?: EventEnvelope }>();
    for (const event of events) {
      const account = event.tenant?.account_id;
      if (!account) continue;
      const entry = latestByAccount.get(account) ?? {};
      if (event.event_type === "billing.subscription.changed") {
        if (!entry.stripe || Date.parse(event.occurred_at) > Date.parse(entry.stripe.occurred_at)) entry.stripe = event;
      }
      if (event.event_type === "license.entitlement.issued") {
        if (!entry.entitlement || Date.parse(event.occurred_at) > Date.parse(entry.entitlement.occurred_at)) entry.entitlement = event;
      }
      latestByAccount.set(account, entry);
    }
    for (const [account, entry] of latestByAccount) {
      if (!entry.stripe || !entry.entitlement) continue;
      const stripePlan = String(entry.stripe.payload["plan"] ?? "");
      const entitlementPlan = String(entry.entitlement.payload["plan"] ?? "");
      if (!stripePlan || !entitlementPlan || stripePlan === entitlementPlan) continue;
      const record = eventEvidence(entry.entitlement, this.scopeOf(entry.entitlement));
      record.source_event_ids = [entry.stripe.event_id, entry.entitlement.event_id];
      record.source_event_root = `stripe_divergence:${account}`;
      evidence.push(record);
      findings.push(this.finding("license.stripe_divergence", account, entry.entitlement, record, {
        likelihood: 0.6,
        impact: 0.7,
        confidence: 0.9,
        evidence_quality: record.quality.score,
      }, `Verified Stripe state says plan "${stripePlan}" but the latest entitlement was issued for plan "${entitlementPlan}". Reconcile Stripe state; verified billing remains authoritative.`, "REQUEST_OPERATOR"));
    }
    return findings;
  }

  private scopeOf(event: EventEnvelope): Record<string, string> {
    return {
      tenant_id: event.tenant!.tenant_id,
      ...(event.tenant!.account_id !== undefined ? { account_id: event.tenant!.account_id } : {}),
    };
  }

  private finding(
    type: string,
    subjectId: string,
    event: EventEnvelope,
    record: EvidenceRecord,
    risk: Finding["risk"],
    summary: string,
    actionClass: Finding["recommendation"]["action_class"],
  ): Finding {
    return {
      finding_id: this.nextFindingId(),
      finding_type: type,
      node: { name: this.name, version: this.version },
      subject: { type: "account", id: subjectId },
      tenant_id: event.tenant!.tenant_id,
      window: { start: event.occurred_at, end: event.occurred_at },
      risk,
      evidence_ids: [record.evidence_id],
      source_event_roots: [record.source_event_root],
      explanation: {
        summary,
        top_factors: [{ factor: type, contribution: 1 }],
        uncertainties: ["Legitimate device migrations and plan changes can resemble abuse; verified billing state is authoritative."],
      },
      recommendation: { action_class: actionClass, playbook: "PB-LICENSE-ABUSE-01" },
      expires_at: new Date(Date.parse(event.occurred_at) + 24 * 3600 * 1000).toISOString(),
      correlation_hints: { ...(event.tenant?.account_id !== undefined ? { account_id: event.tenant.account_id } : {}) },
      policy_generated_effect: event.control_lineage?.policy_generated_effect === true,
    };
  }
}
