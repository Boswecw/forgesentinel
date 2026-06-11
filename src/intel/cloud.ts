import { clamp01 } from "../contracts/common.js";
import type { EventEnvelope } from "../contracts/envelope.js";
import type { EvidenceRecord } from "../contracts/evidence.js";
import type { Finding } from "../contracts/finding.js";
import { eventEvidence, featureEvidence, FeatureService } from "./features.js";
import type { NodeOutput } from "./cost.js";

export const LOGIN_FAILURES_15M = "cloud.login_failures_15m@1.0.0";

/**
 * Sentinel-Cloud (03, SNT-110). Shadow mode. Novelty findings are weak
 * signals: novelty alone never justifies enforcement (05), so their
 * recommendations stay at OBSERVE/RECOMMEND_ONLY and they exist mainly as
 * compound-correlation inputs for Prime.
 */
export class SentinelCloudNode {
  readonly name = "sentinel-cloud";
  readonly version = "1.0.0";
  readonly shadow = true;

  private readonly seenKeys = new Map<string, Set<string>>();
  private readonly seenRegions = new Map<string, Set<string>>();
  private readonly seenDevices = new Map<string, Set<string>>();
  private findingCounter = 0;

  constructor(private readonly features: FeatureService) {}

  private nextFindingId(): string {
    this.findingCounter += 1;
    return `fnd_cloud_${String(this.findingCounter).padStart(5, "0")}`;
  }

  /**
   * Processes identity events in time order. Events older than
   * `noveltyLearnedBefore` only train the seen sets (history learning);
   * later events can emit findings.
   */
  process(events: EventEnvelope[], noveltyLearnedBefore: string): NodeOutput {
    const findings: Finding[] = [];
    const evidence: EvidenceRecord[] = [];
    const learnCutoff = Date.parse(noveltyLearnedBefore);
    const sorted = [...events].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));

    for (const event of sorted) {
      const tenantId = event.tenant?.tenant_id;
      const accountId = event.tenant?.account_id;
      if (!tenantId || !accountId) continue;
      const accountKey = `${tenantId}/${accountId}`;
      const isLearning = Date.parse(event.occurred_at) < learnCutoff;

      if (event.event_type === "identity.api_key.created") {
        const fingerprint = event.actor.api_key_fingerprint ?? String(event.payload["api_key_fingerprint"] ?? "");
        if (fingerprint) {
          const novel = this.markSeen(this.seenKeys, accountKey, fingerprint);
          if (novel && !isLearning) {
            const record = eventEvidence(event, { tenant_id: tenantId, account_id: accountId });
            evidence.push(record);
            findings.push(this.noveltyFinding("cloud.new_api_key", event, record, 0.3, `New API key ${fingerprint.slice(-8)} created; account has no prior history with this key.`, fingerprint));
          }
        }
      }

      if (event.event_type === "identity.session.created" || event.event_type === "identity.api_key.used") {
        const region = typeof event.payload["region"] === "string" ? (event.payload["region"] as string) : event.location.region;
        const device = typeof event.payload["device_fingerprint"] === "string" ? (event.payload["device_fingerprint"] as string) : undefined;
        if (region) {
          const novel = this.markSeen(this.seenRegions, accountKey, region);
          if (novel && !isLearning) {
            const record = eventEvidence(event, { tenant_id: tenantId, account_id: accountId });
            evidence.push(record);
            findings.push(this.noveltyFinding("cloud.new_region", event, record, 0.3, `First observed access from region "${region}" for this account.`));
          }
        }
        if (device) {
          const novel = this.markSeen(this.seenDevices, accountKey, device);
          if (novel && !isLearning) {
            const record = eventEvidence(event, { tenant_id: tenantId, account_id: accountId });
            evidence.push(record);
            findings.push(this.noveltyFinding("cloud.new_device", event, record, 0.25, `First observed access from device ${device.slice(-8)} for this account.`));
          }
        }
      }
    }

    const burstFindings = this.loginFailureBursts(sorted, learnCutoff);
    findings.push(...burstFindings.findings);
    evidence.push(...burstFindings.evidence);
    return { findings, evidence };
  }

  private loginFailureBursts(events: EventEnvelope[], learnCutoff: number): NodeOutput {
    const findings: Finding[] = [];
    const evidence: EvidenceRecord[] = [];
    const failures = events.filter((event) => event.event_type === "identity.login.failed" && Date.parse(event.occurred_at) >= learnCutoff);
    const byAccount = new Map<string, EventEnvelope[]>();
    for (const event of failures) {
      const key = `${event.tenant?.tenant_id}/${event.tenant?.account_id}`;
      byAccount.set(key, [...(byAccount.get(key) ?? []), event]);
    }
    for (const [accountKey, accountFailures] of byAccount) {
      const last = accountFailures[accountFailures.length - 1];
      if (!last) continue;
      const [tenantId, accountId] = accountKey.split("/") as [string, string];
      const scopeKey = `tenant_id=${tenantId}|account_id=${accountId}`;
      const window = this.features.evaluateWindow(LOGIN_FAILURES_15M, scopeKey, last.occurred_at);
      if (window.value >= 5) {
        const record = featureEvidence(window, "failures/15m", { tenant_id: tenantId, account_id: accountId }, false);
        evidence.push(record);
        findings.push({
          finding_id: this.nextFindingId(),
          finding_type: "cloud.login_failure_burst",
          node: { name: this.name, version: this.version },
          subject: { type: "account", id: accountId },
          tenant_id: tenantId,
          window: window.window,
          risk: { likelihood: clamp01(0.4 + 0.03 * window.value), impact: 0.5, confidence: 0.7, evidence_quality: record.quality.score },
          evidence_ids: [record.evidence_id],
          source_event_roots: [record.source_event_root],
          explanation: {
            summary: `${window.value} failed logins within 15 minutes for this account.`,
            top_factors: [{ factor: "login_failure_burst", contribution: 1 }],
            uncertainties: ["Could be a user with a forgotten password rather than credential stuffing."],
            observed: window.value,
            expected: 0,
          },
          recommendation: { action_class: "RECOMMEND_ONLY" },
          expires_at: new Date(Date.parse(last.occurred_at) + 24 * 3600 * 1000).toISOString(),
          correlation_hints: { account_id: accountId },
          policy_generated_effect: false,
        });
      }
    }
    return { findings, evidence };
  }

  private markSeen(map: Map<string, Set<string>>, accountKey: string, value: string): boolean {
    const set = map.get(accountKey) ?? new Set<string>();
    const novel = !set.has(value);
    set.add(value);
    map.set(accountKey, set);
    return novel;
  }

  private noveltyFinding(type: string, event: EventEnvelope, record: EvidenceRecord, likelihood: number, summary: string, keyFingerprint?: string): Finding {
    const tenantId = event.tenant?.tenant_id ?? "unknown";
    const accountId = event.tenant?.account_id ?? "unknown";
    return {
      finding_id: this.nextFindingId(),
      finding_type: type,
      node: { name: this.name, version: this.version },
      subject: { type: "account", id: accountId },
      tenant_id: tenantId,
      window: { start: event.occurred_at, end: event.occurred_at },
      risk: { likelihood, impact: 0.5, confidence: 0.6, evidence_quality: record.quality.score },
      evidence_ids: [record.evidence_id],
      source_event_roots: [record.source_event_root],
      explanation: {
        summary,
        top_factors: [{ factor: type, contribution: 1 }],
        uncertainties: ["Novelty alone is a weak signal; it rarely justifies enforcement by itself."],
      },
      recommendation: { action_class: "OBSERVE" },
      expires_at: new Date(Date.parse(event.occurred_at) + 24 * 3600 * 1000).toISOString(),
      correlation_hints: {
        account_id: accountId,
        ...(keyFingerprint !== undefined ? { api_key_fingerprint: keyFingerprint } : {}),
      },
      policy_generated_effect: event.control_lineage?.policy_generated_effect === true,
    };
  }
}
