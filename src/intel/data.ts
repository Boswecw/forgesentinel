import type { EventEnvelope } from "../contracts/envelope.js";
import type { EvidenceRecord } from "../contracts/evidence.js";
import type { Finding } from "../contracts/finding.js";
import { FeatureService, eventEvidence, featureEvidence } from "./features.js";
import type { NodeOutput } from "./cost.js";

export const EXPORT_BYTES_24H = "data.export_bytes_24h@1.0.0";

/**
 * Sentinel-Data (03, SNT-150). Shadow mode. The node works from metadata,
 * hashes, and classification outcomes — raw content inspection requires a
 * declared purpose and authority it does not have. Hard denials (cross
 * tenant) already happened at the boundary; this node turns them into
 * durable incident-grade evidence.
 */
export interface DataNodeConfig {
  bulk_export_bytes: number;
}

export const DEFAULT_DATA_CONFIG: DataNodeConfig = {
  bulk_export_bytes: 5_000_000_000,
};

export class SentinelDataNode {
  readonly name = "sentinel-data";
  readonly version = "1.0.0";
  readonly shadow = true;

  private readonly seenDestinations = new Map<string, Set<string>>();
  private findingCounter = 0;

  constructor(
    private readonly features: FeatureService,
    private readonly config: DataNodeConfig = DEFAULT_DATA_CONFIG,
  ) {}

  private nextFindingId(): string {
    this.findingCounter += 1;
    return `fnd_data_${String(this.findingCounter).padStart(5, "0")}`;
  }

  process(events: EventEnvelope[], noveltyLearnedBefore: string): NodeOutput {
    const findings: Finding[] = [];
    const evidence: EvidenceRecord[] = [];
    const learnCutoff = Date.parse(noveltyLearnedBefore);
    const sorted = [...events].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
    const exportScopes = new Map<string, { tenant_id: string; account_id: string; lastIso: string }>();

    for (const event of sorted) {
      const tenantId = event.tenant?.tenant_id;
      if (!tenantId) continue;

      if (event.event_type === "data.cross_tenant.denied") {
        const record = eventEvidence(event, { tenant_id: tenantId });
        evidence.push(record);
        findings.push(this.finding("data.cross_tenant_attempt", event, record, {
          likelihood: 0.8,
          impact: 0.85,
          confidence: 0.95,
          evidence_quality: record.quality.score,
        }, `Actor ${event.actor.actor_id} attempted cross-tenant access to ${event.subject.subject_type} ${event.subject.subject_id} and was denied at the boundary.`, "REQUEST_OPERATOR"));
      }

      if (event.event_type === "data.redaction.failed") {
        const record = eventEvidence(event, { tenant_id: tenantId });
        evidence.push(record);
        findings.push(this.finding("data.redaction_failure", event, record, {
          likelihood: 0.7,
          impact: 0.75,
          confidence: 0.9,
          evidence_quality: record.quality.score,
        }, `Redaction failed for ${event.subject.subject_type} ${event.subject.subject_id}; where policy requires redaction the transfer must stay blocked until it succeeds.`, "REQUEST_OPERATOR"));
      }

      if (event.event_type === "data.object.exported") {
        const accountId = event.tenant?.account_id;
        const destination = typeof event.payload["destination"] === "string" ? (event.payload["destination"] as string) : undefined;
        if (accountId) {
          exportScopes.set(`${tenantId}/${accountId}`, { tenant_id: tenantId, account_id: accountId, lastIso: event.occurred_at });
        }
        if (destination && accountId) {
          const key = `${tenantId}/${accountId}`;
          const seen = this.seenDestinations.get(key) ?? new Set<string>();
          const novel = !seen.has(destination);
          seen.add(destination);
          this.seenDestinations.set(key, seen);
          if (novel && Date.parse(event.occurred_at) >= learnCutoff) {
            const record = eventEvidence(event, { tenant_id: tenantId, account_id: accountId });
            evidence.push(record);
            findings.push(this.finding("data.new_destination", event, record, {
              likelihood: 0.3,
              impact: 0.5,
              confidence: 0.6,
              evidence_quality: record.quality.score,
            }, `First observed export destination "${destination}" for this account.`, "OBSERVE", destination));
          }
        }
      }
    }

    for (const scope of exportScopes.values()) {
      const scopeKey = `tenant_id=${scope.tenant_id}|account_id=${scope.account_id}`;
      const window = this.features.evaluateWindow(EXPORT_BYTES_24H, scopeKey, scope.lastIso);
      if (window.value >= this.config.bulk_export_bytes) {
        const record = featureEvidence(window, "bytes/day", { tenant_id: scope.tenant_id, account_id: scope.account_id }, false);
        evidence.push(record);
        const gigabytes = (window.value / 1e9).toFixed(1);
        findings.push({
          finding_id: this.nextFindingId(),
          finding_type: "data.bulk_export",
          node: { name: this.name, version: this.version },
          subject: { type: "account", id: scope.account_id },
          tenant_id: scope.tenant_id,
          window: window.window,
          risk: { likelihood: 0.55, impact: 0.7, confidence: 0.75, evidence_quality: record.quality.score },
          evidence_ids: [record.evidence_id],
          source_event_roots: [record.source_event_root],
          explanation: {
            summary: `${gigabytes} GB exported in 24 hours by one account.`,
            top_factors: [{ factor: "data.bulk_export", contribution: 1 }],
            uncertainties: ["Backups and approved migrations also move bulk data."],
          },
          recommendation: { action_class: "REQUEST_OPERATOR", playbook: "PB-DATA-EXFIL-01" },
          expires_at: new Date(Date.parse(scope.lastIso) + 24 * 3600 * 1000).toISOString(),
          correlation_hints: { account_id: scope.account_id },
          policy_generated_effect: record.policy_generated_effect,
        });
      }
    }

    return { findings, evidence };
  }

  private finding(
    type: string,
    event: EventEnvelope,
    record: EvidenceRecord,
    risk: Finding["risk"],
    summary: string,
    actionClass: Finding["recommendation"]["action_class"],
    destination?: string,
  ): Finding {
    const tenantId = event.tenant!.tenant_id;
    const accountId = event.tenant?.account_id;
    return {
      finding_id: this.nextFindingId(),
      finding_type: type,
      node: { name: this.name, version: this.version },
      subject: accountId ? { type: "account", id: accountId } : { type: event.subject.subject_type, id: event.subject.subject_id },
      tenant_id: tenantId,
      window: { start: event.occurred_at, end: event.occurred_at },
      risk,
      evidence_ids: [record.evidence_id],
      source_event_roots: [record.source_event_root],
      explanation: {
        summary,
        top_factors: [{ factor: type, contribution: 1 }],
        uncertainties: type === "data.cross_tenant_attempt" ? ["A defective integration can also produce cross-tenant requests."] : ["Legitimate workflows can resemble this pattern; correlation decides."],
      },
      recommendation: { action_class: actionClass, playbook: "PB-DATA-EXFIL-01" },
      expires_at: new Date(Date.parse(event.occurred_at) + 24 * 3600 * 1000).toISOString(),
      correlation_hints: {
        ...(accountId !== undefined ? { account_id: accountId } : {}),
        ...(destination !== undefined ? { destination } : {}),
      },
      policy_generated_effect: event.control_lineage?.policy_generated_effect === true,
    };
  }
}
