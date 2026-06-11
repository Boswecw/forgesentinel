import { clamp01 } from "../contracts/common.js";
import type { EventEnvelope } from "../contracts/envelope.js";
import type { EvidenceRecord } from "../contracts/evidence.js";
import type { Finding } from "../contracts/finding.js";
import { FeatureService, eventEvidence, featureEvidence } from "./features.js";
import { BaselineService } from "./baselines.js";

export const TOKENS_PER_DAY = "cost.tokens_per_day@2.0.0";
export const RETRIES_PER_HOUR = "cost.retries_per_hour@1.0.0";
export const CACHE_HIT_RATE_24H = "cost.cache_hit_rate_24h@1.0.0";
export const COST_ESTIMATED_PER_DAY = "cost.estimated_per_day@1.0.0";
export const COST_FINALIZED_PER_DAY = "cost.finalized_per_day@1.0.0";
export const DAILY_USAGE_BASELINE = "cost.account_daily_usage";

/**
 * Sentinel-Cost (03, SNT-100). Shadow mode: this node produces findings and
 * recommendations only — it holds no authority credentials and cannot
 * execute, suspend, or touch billing truth.
 */
export interface CostNodeConfig {
  extreme_change_ratio: number;
  extreme_robust_score: number;
  sustained_growth_ratio: number;
  sustained_growth_windows: number;
  retry_storm_count: number;
  cache_collapse_current_rate: number;
  cache_collapse_historical_rate: number;
  cache_collapse_min_requests: number;
  cache_collapse_min_history_windows: number;
  billing_divergence_ratio: number;
  billing_divergence_min_estimate: number;
}

export const DEFAULT_COST_CONFIG: CostNodeConfig = {
  extreme_change_ratio: 10,
  extreme_robust_score: 8,
  sustained_growth_ratio: 3,
  sustained_growth_windows: 3,
  retry_storm_count: 50,
  cache_collapse_current_rate: 0.2,
  cache_collapse_historical_rate: 0.5,
  cache_collapse_min_requests: 20,
  cache_collapse_min_history_windows: 7,
  billing_divergence_ratio: 0.25,
  billing_divergence_min_estimate: 1,
};

/** Actions this node may never recommend (03 forbidden direct actions). */
export const COST_FORBIDDEN_ACTIONS = [
  "billing.subscription.cancel",
  "billing.stripe.customer.modify",
  "license.permanent_revoke",
  "usage.evidence.delete",
] as const;

export interface NodeOutput {
  findings: Finding[];
  evidence: EvidenceRecord[];
}

let findingCounter = 0;
function nextFindingId(node: string): string {
  findingCounter += 1;
  return `fnd_${node}_${String(findingCounter).padStart(5, "0")}`;
}

export class SentinelCostNode {
  readonly name = "sentinel-cost";
  readonly version = "1.0.0";
  readonly shadow = true;

  constructor(
    private readonly features: FeatureService,
    private readonly baselines: BaselineService,
    private readonly config: CostNodeConfig = DEFAULT_COST_CONFIG,
  ) {}

  /**
   * Seeds the scoped baseline from non-overlapping historical windows, then
   * evaluates the current rolling window. Replay over the same fixture is
   * deterministic.
   */
  evaluate(scope: { tenant_id: string; account_id: string; route_class: string }, atIso: string): NodeOutput {
    const scopeKey = `tenant_id=${scope.tenant_id}|account_id=${scope.account_id}|route_class=${scope.route_class}`;
    const scopeValues: Record<string, string> = { ...scope };
    const findings: Finding[] = [];
    const evidence: EvidenceRecord[] = [];

    const history = this.features.history(TOKENS_PER_DAY, scopeKey, atIso, 35);
    for (const window of history) {
      if (window.sample_count > 0) {
        this.baselines.addSample(DAILY_USAGE_BASELINE, scopeValues, window.window.start, window.value);
      }
    }
    const current = this.features.evaluateWindow(TOKENS_PER_DAY, scopeKey, atIso);
    const baseline = this.baselines.evaluate(DAILY_USAGE_BASELINE, scopeValues, current.value);

    if (!baseline.sufficient) {
      // Cold start (05): widen uncertainty and gather shadow evidence rather
      // than calling onboarding growth a compromise.
      return { findings, evidence };
    }

    const usageEvidence = featureEvidence(current, "tokens/day", scopeValues, false);

    if (baseline.change_ratio >= this.config.extreme_change_ratio && baseline.robust_score >= this.config.extreme_robust_score) {
      evidence.push(usageEvidence);
      const ratio = baseline.change_ratio;
      findings.push({
        finding_id: nextFindingId("cost"),
        finding_type: "cost.usage_change_extreme",
        node: { name: this.name, version: this.version },
        subject: { type: "account", id: scope.account_id },
        tenant_id: scope.tenant_id,
        window: current.window,
        risk: {
          likelihood: clamp01(0.3 + 0.2 * Math.log10(ratio)),
          impact: clamp01(0.42 + 0.18 * Math.log10(ratio)),
          confidence: clamp01(0.3 + 0.4 * Math.min(1, baseline.sample_count / 21)),
          evidence_quality: usageEvidence.quality.score,
        },
        baseline: {
          baseline_id: `${baseline.baseline_id}@${baseline.baseline_version}`,
          expected: baseline.expected,
          observed: current.value,
          change_ratio: Number(ratio.toFixed(2)),
        },
        evidence_ids: [usageEvidence.evidence_id],
        source_event_roots: [usageEvidence.source_event_root],
        explanation: {
          summary: `Daily token usage increased ${ratio.toFixed(0)}x above the account baseline.`,
          top_factors: [
            { factor: "usage_change_ratio", contribution: 0.62 },
            { factor: "robust_score", contribution: 0.38 },
          ],
          uncertainties: ["The account may be running an approved bulk workload."],
          expected: baseline.expected,
          observed: current.value,
        },
        recommendation: { action_class: "REQUEST_OPERATOR", playbook: "PB-COST-COMPROMISE-01" },
        expires_at: new Date(Date.parse(atIso) + 24 * 3600 * 1000).toISOString(),
        correlation_hints: { account_id: scope.account_id, route_class: scope.route_class },
        policy_generated_effect: false,
      });
    } else if (this.sustainedGrowth(scopeKey, atIso, baseline.expected)) {
      evidence.push(usageEvidence);
      findings.push(this.simpleFinding("cost.usage_sustained_growth", scope, current.window, usageEvidence, {
        likelihood: 0.55,
        impact: 0.6,
        confidence: clamp01(0.3 + 0.4 * Math.min(1, baseline.sample_count / 21)),
        evidence_quality: usageEvidence.quality.score,
      }, `Daily token usage stayed >=${this.config.sustained_growth_ratio}x baseline for ${this.config.sustained_growth_windows} consecutive windows.`, atIso, "RECOMMEND_ONLY"));
    }

    const retries = this.features.evaluateWindow(RETRIES_PER_HOUR, `tenant_id=${scope.tenant_id}|account_id=${scope.account_id}`, atIso);
    if (retries.value >= this.config.retry_storm_count) {
      const retryEvidence = featureEvidence(retries, "retries/hour", { tenant_id: scope.tenant_id, account_id: scope.account_id }, false);
      evidence.push(retryEvidence);
      findings.push(this.simpleFinding("cost.retry_storm", scope, retries.window, retryEvidence, {
        likelihood: 0.65,
        impact: 0.55,
        confidence: 0.75,
        evidence_quality: retryEvidence.quality.score,
      }, `${retries.value} retries recorded in one hour; expected near zero.`, atIso, "REQUEST_OPERATOR"));
    }

    return { findings, evidence };
  }

  /**
   * Account-level findings that need cost/billing/quota event context:
   * cache collapse, estimate/finalized billing divergence, and quota bypass.
   * Estimate and finalized cost remain separate values throughout (SNT-100).
   */
  evaluateAccountEvents(events: EventEnvelope[], scope: { tenant_id: string; account_id: string }, atIso: string): NodeOutput {
    const findings: Finding[] = [];
    const evidence: EvidenceRecord[] = [];
    const scopeKey = `tenant_id=${scope.tenant_id}|account_id=${scope.account_id}`;
    const fullScope = { ...scope, route_class: "account_wide" };

    const cacheCurrent = this.features.evaluateWindow(CACHE_HIT_RATE_24H, scopeKey, atIso);
    if (cacheCurrent.sample_count >= this.config.cache_collapse_min_requests && cacheCurrent.value <= this.config.cache_collapse_current_rate) {
      const history = this.features
        .history(CACHE_HIT_RATE_24H, scopeKey, atIso, 30)
        .filter((window) => window.sample_count >= 5);
      if (history.length >= this.config.cache_collapse_min_history_windows) {
        const historicalMean = history.reduce((sum, window) => sum + window.value, 0) / history.length;
        if (historicalMean >= this.config.cache_collapse_historical_rate) {
          const record = featureEvidence(cacheCurrent, "hit_rate", scope, false);
          evidence.push(record);
          findings.push(this.simpleFinding("cost.cache_collapse", fullScope, cacheCurrent.window, record, {
            likelihood: 0.5,
            impact: 0.55,
            confidence: 0.7,
            evidence_quality: record.quality.score,
          }, `Cache hit rate fell to ${(cacheCurrent.value * 100).toFixed(0)}% against a historical ${(historicalMean * 100).toFixed(0)}%; every miss is now billable provider work.`, atIso, "RECOMMEND_ONLY"));
        }
      }
    }

    const estimated = this.features.evaluateWindow(COST_ESTIMATED_PER_DAY, scopeKey, atIso);
    const finalized = this.features.evaluateWindow(COST_FINALIZED_PER_DAY, scopeKey, atIso);
    if (estimated.value >= this.config.billing_divergence_min_estimate && finalized.sample_count > 0) {
      const divergence = Math.abs(finalized.value - estimated.value) / estimated.value;
      if (divergence >= this.config.billing_divergence_ratio) {
        const record = featureEvidence(finalized, "currency_units/day", scope, false);
        evidence.push(record);
        findings.push(this.simpleFinding("cost.billing_divergence", fullScope, finalized.window, record, {
          likelihood: 0.6,
          impact: 0.7,
          // Arithmetic over verified usage records: high confidence in the
          // divergence itself; the cause still needs reconciliation.
          confidence: 0.8,
          evidence_quality: record.quality.score,
        }, `Finalized cost diverges ${(divergence * 100).toFixed(0)}% from estimated cost (estimated ${estimated.value.toFixed(2)}, finalized ${finalized.value.toFixed(2)}). Open billing reconciliation.`, atIso, "REQUEST_OPERATOR"));
      }
    }

    findings.push(...this.quotaBypass(events, scope, evidence, atIso));
    return { findings, evidence };
  }

  private quotaBypass(events: EventEnvelope[], scope: { tenant_id: string; account_id: string }, evidence: EvidenceRecord[], atIso: string): Finding[] {
    const forAccount = events.filter((event) => event.tenant?.tenant_id === scope.tenant_id && event.tenant?.account_id === scope.account_id);
    const exceeded = forAccount
      .filter((event) => event.event_type === "usage.quota.exceeded")
      .sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at))
      .at(-1);
    if (!exceeded) return [];
    const exceededAt = Date.parse(exceeded.occurred_at);
    const usageAfter = forAccount.filter(
      (event) => event.event_type === "usage.tokens.recorded" && Date.parse(event.occurred_at) > exceededAt,
    );
    if (usageAfter.length === 0) return [];
    const overageAllowed = forAccount.some(
      (event) =>
        event.event_type === "license.feature.allowed" &&
        event.payload["feature"] === "paid_overage" &&
        Date.parse(event.occurred_at) <= Date.parse(usageAfter[0]!.occurred_at),
    );
    if (overageAllowed) return [];
    const record = eventEvidence(exceeded, scope);
    record.source_event_ids = [exceeded.event_id, ...usageAfter.map((event) => event.event_id)];
    evidence.push(record);
    return [
      this.simpleFinding("cost.quota_bypass", { ...scope, route_class: "account_wide" }, { start: exceeded.occurred_at, end: usageAfter.at(-1)!.occurred_at }, record, {
        likelihood: 0.7,
        impact: 0.75,
        confidence: 0.85,
        evidence_quality: record.quality.score,
      }, `${usageAfter.length} usage event(s) recorded after quota was exceeded with no paid-overage entitlement in effect.`, atIso, "REQUEST_OPERATOR"),
    ];
  }

  private sustainedGrowth(scopeKey: string, atIso: string, expected: number): boolean {
    if (expected <= 0) return false;
    const windows = this.features.history(TOKENS_PER_DAY, scopeKey, atIso, this.config.sustained_growth_windows);
    return windows.length === this.config.sustained_growth_windows && windows.every((window) => window.value / expected >= this.config.sustained_growth_ratio);
  }

  private simpleFinding(
    type: string,
    scope: { tenant_id: string; account_id: string; route_class: string },
    window: { start: string; end: string },
    evidenceRecord: EvidenceRecord,
    risk: Finding["risk"],
    summary: string,
    atIso: string,
    actionClass: Finding["recommendation"]["action_class"],
  ): Finding {
    return {
      finding_id: nextFindingId("cost"),
      finding_type: type,
      node: { name: this.name, version: this.version },
      subject: { type: "account", id: scope.account_id },
      tenant_id: scope.tenant_id,
      window,
      risk,
      evidence_ids: [evidenceRecord.evidence_id],
      source_event_roots: [evidenceRecord.source_event_root],
      explanation: { summary, top_factors: [{ factor: type, contribution: 1 }], uncertainties: ["Cause may be a legitimate workload change."] },
      recommendation: { action_class: actionClass },
      expires_at: new Date(Date.parse(atIso) + 24 * 3600 * 1000).toISOString(),
      correlation_hints: { account_id: scope.account_id, route_class: scope.route_class },
      policy_generated_effect: evidenceRecord.policy_generated_effect,
    };
  }
}
