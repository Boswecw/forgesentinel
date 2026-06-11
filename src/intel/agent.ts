import type { EventEnvelope } from "../contracts/envelope.js";
import type { EvidenceRecord } from "../contracts/evidence.js";
import type { Finding } from "../contracts/finding.js";
import { FeatureService, eventEvidence, featureEvidence } from "./features.js";
import type { NodeOutput } from "./cost.js";

export const PATCHES_PER_HOUR = "agent.patches_per_hour@1.0.0";
export const DENIALS_PER_HOUR = "agent.denials_per_hour@1.0.0";
export const RUNS_PER_HOUR = "agent.runs_per_hour@1.0.0";

/**
 * Sentinel-Agent (03, SNT-120). Shadow mode. Findings target the exact
 * agent fingerprint (immutable version identity): features are scoped per
 * fingerprint, so release boundaries can never mix baselines, and any
 * quarantine recommendation names one exact version.
 *
 * This node never applies, promotes, or proposes a patch (03): repair
 * routes through Centipede -> Forge_Command -> SMITH -> YellowJacket ->
 * Hermes (ADR-007).
 */
export const AGENT_FORBIDDEN_ACTIONS = [
  "agent.patch.apply",
  "agent.patch.promote",
  "source_code.direct_patch",
  "smith.proposal.approve",
] as const;

export interface AgentNodeConfig {
  patch_burst_count: number;
  denial_burst_count: number;
  run_loop_count: number;
}

export const DEFAULT_AGENT_CONFIG: AgentNodeConfig = {
  patch_burst_count: 15,
  denial_burst_count: 5,
  run_loop_count: 10,
};

function agentFingerprint(event: EventEnvelope): string | undefined {
  const fromPayload = event.payload["agent_fingerprint"];
  return typeof fromPayload === "string" ? fromPayload : undefined;
}

export class SentinelAgentNode {
  readonly name = "sentinel-agent";
  readonly version = "1.0.0";
  readonly shadow = true;

  private findingCounter = 0;

  constructor(
    private readonly features: FeatureService,
    private readonly config: AgentNodeConfig = DEFAULT_AGENT_CONFIG,
  ) {}

  private nextFindingId(): string {
    this.findingCounter += 1;
    return `fnd_agent_${String(this.findingCounter).padStart(5, "0")}`;
  }

  process(events: EventEnvelope[]): NodeOutput {
    const findings: Finding[] = [];
    const evidence: EvidenceRecord[] = [];
    const agentEvents = events.filter((event) => event.event_type.startsWith("agent.") && event.tenant?.tenant_id && agentFingerprint(event));

    // Boundary violations are deterministic, per-event findings.
    for (const event of agentEvents) {
      if (event.event_type !== "agent.boundary.violated") continue;
      const fingerprint = agentFingerprint(event)!;
      const tenantId = event.tenant!.tenant_id;
      const record = eventEvidence(event, { tenant_id: tenantId, agent_fingerprint: fingerprint });
      evidence.push(record);
      findings.push({
        finding_id: this.nextFindingId(),
        finding_type: "agent.boundary_violation",
        node: { name: this.name, version: this.version },
        subject: { type: "agent_version", id: fingerprint },
        tenant_id: tenantId,
        window: { start: event.occurred_at, end: event.occurred_at },
        risk: { likelihood: 0.85, impact: 0.8, confidence: 0.9, evidence_quality: record.quality.score },
        evidence_ids: [record.evidence_id],
        source_event_roots: [record.source_event_root],
        explanation: {
          summary: `Agent ${fingerprint} attempted access outside its repository boundary (${String(event.payload["boundary"] ?? "unspecified boundary")}).`,
          top_factors: [{ factor: "agent.boundary_violation", contribution: 1 }],
          uncertainties: ["A misconfigured task spec can produce a boundary attempt without compromise."],
        },
        recommendation: { action_class: "REQUEST_BOUNDED_ACTION", playbook: "PB-AGENT-DRIFT-01" },
        expires_at: new Date(Date.parse(event.occurred_at) + 24 * 3600 * 1000).toISOString(),
        correlation_hints: {
          agent_fingerprint: fingerprint,
          ...(event.correlation.run_id !== undefined ? { run_id: event.correlation.run_id } : {}),
        },
        policy_generated_effect: event.control_lineage?.policy_generated_effect === true,
      });
    }

    // Rate findings are evaluated per exact fingerprint scope.
    const scopes = new Map<string, { tenant_id: string; agent_fingerprint: string; lastIso: string }>();
    for (const event of agentEvents) {
      const fingerprint = agentFingerprint(event)!;
      const key = `tenant_id=${event.tenant!.tenant_id}|agent_fingerprint=${fingerprint}`;
      const existing = scopes.get(key);
      if (!existing || Date.parse(event.occurred_at) > Date.parse(existing.lastIso)) {
        scopes.set(key, { tenant_id: event.tenant!.tenant_id, agent_fingerprint: fingerprint, lastIso: event.occurred_at });
      }
    }

    for (const [scopeKey, scope] of scopes) {
      const patches = this.features.evaluateWindow(PATCHES_PER_HOUR, scopeKey, scope.lastIso);
      if (patches.value >= this.config.patch_burst_count) {
        const record = featureEvidence(patches, "patches/hour", { tenant_id: scope.tenant_id, agent_fingerprint: scope.agent_fingerprint }, false);
        evidence.push(record);
        findings.push(this.rateFinding("agent.patch_burst", scope, patches.window, record, {
          likelihood: 0.6,
          impact: 0.7,
          confidence: 0.75,
          evidence_quality: record.quality.score,
        }, `Agent ${scope.agent_fingerprint} applied/proposed ${patches.value} patches in one hour.`));
      }

      const denials = this.features.evaluateWindow(DENIALS_PER_HOUR, scopeKey, scope.lastIso);
      if (denials.value >= this.config.denial_burst_count) {
        const record = featureEvidence(denials, "denials/hour", { tenant_id: scope.tenant_id, agent_fingerprint: scope.agent_fingerprint }, false);
        evidence.push(record);
        findings.push(this.rateFinding("agent.repeated_denials", scope, denials.window, record, {
          likelihood: 0.55,
          impact: 0.6,
          confidence: 0.75,
          evidence_quality: record.quality.score,
        }, `Agent ${scope.agent_fingerprint} hit ${denials.value} permission denials in one hour; it keeps requesting actions policy forbids.`));
      }

      const runs = this.features.evaluateWindow(RUNS_PER_HOUR, scopeKey, scope.lastIso);
      if (runs.value >= this.config.run_loop_count) {
        const record = featureEvidence(runs, "runs/hour", { tenant_id: scope.tenant_id, agent_fingerprint: scope.agent_fingerprint }, false);
        evidence.push(record);
        findings.push(this.rateFinding("agent.loop_suspected", scope, runs.window, record, {
          likelihood: 0.5,
          impact: 0.55,
          confidence: 0.7,
          evidence_quality: record.quality.score,
        }, `Agent ${scope.agent_fingerprint} started ${runs.value} runs in one hour; possible recursive invocation.`));
      }
    }

    return { findings, evidence };
  }

  private rateFinding(
    type: string,
    scope: { tenant_id: string; agent_fingerprint: string; lastIso: string },
    window: { start: string; end: string },
    record: EvidenceRecord,
    risk: Finding["risk"],
    summary: string,
  ): Finding {
    return {
      finding_id: this.nextFindingId(),
      finding_type: type,
      node: { name: this.name, version: this.version },
      subject: { type: "agent_version", id: scope.agent_fingerprint },
      tenant_id: scope.tenant_id,
      window,
      risk,
      evidence_ids: [record.evidence_id],
      source_event_roots: [record.source_event_root],
      explanation: {
        summary,
        top_factors: [{ factor: type, contribution: 1 }],
        uncertainties: ["A legitimate large refactor or migration can raise agent activity."],
      },
      recommendation: { action_class: "REQUEST_OPERATOR", playbook: "PB-AGENT-DRIFT-01" },
      expires_at: new Date(Date.parse(scope.lastIso) + 24 * 3600 * 1000).toISOString(),
      correlation_hints: { agent_fingerprint: scope.agent_fingerprint },
      policy_generated_effect: record.policy_generated_effect,
    };
  }
}
