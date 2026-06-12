import { clamp01 } from "../contracts/common.js";
import type { EvidenceRecord } from "../contracts/evidence.js";
import type { Finding } from "../contracts/finding.js";
import { FeatureService, featureEvidence } from "./features.js";
import { BaselineService } from "./baselines.js";

export const TOKENS_PER_DAY = "cost.tokens_per_day@2.0.0";
export const RETRIES_PER_HOUR = "cost.retries_per_hour@1.0.0";
export const DAILY_USAGE_BASELINE = "cost.account_daily_usage";
export const CACHE_HITS = "cost.cache_hits@1.0.0";
export const CACHE_MISSES = "cost.cache_misses@1.0.0";
export const CACHE_HIT_RATIO_BASELINE = "cost.account_cache_hit_ratio";
export const ESTIMATED_CENTS = "cost.estimated_cents@1.0.0";
export const FINALIZED_CENTS = "cost.finalized_cents@1.0.0";
export const QUOTA_EXCEEDED_PER_DAY = "cost.quota_exceeded_per_day@1.0.0";

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
  /** Cache collapse fires when the hit ratio drops to <= this fraction of baseline. */
  cache_collapse_ratio: number;
  cache_collapse_robust_score: number;
  /** Minimum hits+misses in the window before a ratio is trusted (noise floor). */
  cache_min_volume: number;
  /** Billing divergence tolerance as a fraction of the metered estimate. */
  billing_divergence_tolerance: number;
  /** Absolute floor (cents) so tiny accounts do not trip on rounding. */
  billing_min_gap_cents: number;
  /** Quota-exceeded events per day before a bypass finding is raised. */
  quota_breach_count: number;
}

export const DEFAULT_COST_CONFIG: CostNodeConfig = {
  extreme_change_ratio: 10,
  extreme_robust_score: 8,
  sustained_growth_ratio: 3,
  sustained_growth_windows: 3,
  retry_storm_count: 50,
  cache_collapse_ratio: 0.5,
  cache_collapse_robust_score: 4,
  cache_min_volume: 50,
  billing_divergence_tolerance: 0.25,
  billing_min_gap_cents: 500,
  quota_breach_count: 3,
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

    // Cache collapse is independent of the usage baseline, so it runs before
    // the usage cold-start return below.
    this.detectCacheCollapse(scope, scopeKey, scopeValues, atIso, findings, evidence);

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
   * Cache collapse (03, SNT-100): the prompt/result cache hit-ratio falls
   * sharply below its robust baseline, inflating recompute cost. Cost-inflation
   * signal, not a compromise — recommend investigation only.
   */
  private detectCacheCollapse(
    scope: { tenant_id: string; account_id: string; route_class: string },
    scopeKey: string,
    scopeValues: Record<string, string>,
    atIso: string,
    findings: Finding[],
    evidence: EvidenceRecord[],
  ): void {
    const hits = this.features.evaluateWindow(CACHE_HITS, scopeKey, atIso);
    const misses = this.features.evaluateWindow(CACHE_MISSES, scopeKey, atIso);
    const total = hits.value + misses.value;
    if (total < this.config.cache_min_volume) return;
    const ratio = hits.value / total;

    const histHits = this.features.history(CACHE_HITS, scopeKey, atIso, 35);
    const histMisses = this.features.history(CACHE_MISSES, scopeKey, atIso, 35);
    for (let index = 0; index < histHits.length; index++) {
      const historyHits = histHits[index]!;
      const historyMisses = histMisses[index]!;
      const windowTotal = historyHits.value + historyMisses.value;
      if (windowTotal > 0) {
        this.baselines.addSample(CACHE_HIT_RATIO_BASELINE, scopeValues, historyHits.window.start, historyHits.value / windowTotal);
      }
    }
    const baseline = this.baselines.evaluate(CACHE_HIT_RATIO_BASELINE, scopeValues, ratio);
    if (!baseline.sufficient) return; // cold start (05): not enough cache history
    const collapsed = ratio < baseline.expected
      && baseline.change_ratio <= this.config.cache_collapse_ratio
      && baseline.robust_score >= this.config.cache_collapse_robust_score;
    if (!collapsed) return;

    const missEvidence = featureEvidence(misses, "cache_misses/day", scopeValues, false);
    evidence.push(missEvidence);
    findings.push({
      finding_id: nextFindingId("cost"),
      finding_type: "cost.cache_collapse",
      node: { name: this.name, version: this.version },
      subject: { type: "account", id: scope.account_id },
      tenant_id: scope.tenant_id,
      window: misses.window,
      risk: {
        likelihood: clamp01(0.35 + 0.25 * (1 - baseline.change_ratio)),
        impact: 0.5,
        confidence: clamp01(0.3 + 0.4 * Math.min(1, baseline.sample_count / 21)),
        evidence_quality: missEvidence.quality.score,
      },
      baseline: {
        baseline_id: `${baseline.baseline_id}@${baseline.baseline_version}`,
        expected: Number(baseline.expected.toFixed(4)),
        observed: Number(ratio.toFixed(4)),
        change_ratio: Number(baseline.change_ratio.toFixed(2)),
      },
      evidence_ids: [missEvidence.evidence_id],
      source_event_roots: [missEvidence.source_event_root],
      explanation: {
        summary: `Cache hit ratio fell to ${(ratio * 100).toFixed(0)}% from a ~${(baseline.expected * 100).toFixed(0)}% baseline, inflating recompute cost.`,
        top_factors: [
          { factor: "cache_hit_ratio_drop", contribution: 0.7 },
          { factor: "cache_miss_volume", contribution: 0.3 },
        ],
        uncertainties: ["A cache flush, deploy, or workload change can lower the hit ratio without compromise."],
        expected: baseline.expected,
        observed: ratio,
      },
      recommendation: { action_class: "RECOMMEND_ONLY", playbook: "PB-COST-CACHE-01" },
      expires_at: new Date(Date.parse(atIso) + 24 * 3600 * 1000).toISOString(),
      correlation_hints: { account_id: scope.account_id, route_class: scope.route_class },
      policy_generated_effect: false,
    });
  }

  /**
   * Account-scoped detectors (03, SNT-100) that do not depend on route class:
   * billing/usage divergence and quota-bypass. Called once per account so a
   * multi-route account is not double-flagged.
   */
  evaluateAccount(scope: { tenant_id: string; account_id: string }, atIso: string): NodeOutput {
    const findings: Finding[] = [];
    const evidence: EvidenceRecord[] = [];
    const scopeKey = `tenant_id=${scope.tenant_id}|account_id=${scope.account_id}`;
    const scopeValues: Record<string, string> = { tenant_id: scope.tenant_id, account_id: scope.account_id };

    // Billing / usage divergence: our metered estimate departs from finalized
    // billing truth. Recommend reconciliation; never modify Stripe truth.
    const estimated = this.features.evaluateWindow(ESTIMATED_CENTS, scopeKey, atIso);
    const finalized = this.features.evaluateWindow(FINALIZED_CENTS, scopeKey, atIso);
    if (estimated.sample_count > 0 && finalized.sample_count > 0 && estimated.value > 0) {
      const gap = Math.abs(finalized.value - estimated.value);
      const divergence = gap / Math.max(estimated.value, 1);
      if (divergence >= this.config.billing_divergence_tolerance && gap >= this.config.billing_min_gap_cents) {
        const estimateEvidence = featureEvidence(estimated, "cents/day", scopeValues, false);
        const finalEvidence = featureEvidence(finalized, "cents/day", scopeValues, false);
        evidence.push(estimateEvidence, finalEvidence);
        findings.push({
          finding_id: nextFindingId("cost"),
          finding_type: "cost.billing_divergence",
          node: { name: this.name, version: this.version },
          subject: { type: "account", id: scope.account_id },
          tenant_id: scope.tenant_id,
          window: finalized.window,
          risk: {
            likelihood: clamp01(0.4 + 0.3 * Math.min(1, divergence)),
            impact: clamp01(0.45 + 0.2 * Math.min(1, divergence)),
            confidence: 0.8,
            evidence_quality: Math.min(estimateEvidence.quality.score, finalEvidence.quality.score),
          },
          evidence_ids: [estimateEvidence.evidence_id, finalEvidence.evidence_id],
          source_event_roots: [estimateEvidence.source_event_root, finalEvidence.source_event_root],
          explanation: {
            summary: `Finalized cost diverged ${(divergence * 100).toFixed(0)}% from the metered estimate over 24h (estimate ${estimated.value}c vs finalized ${finalized.value}c).`,
            top_factors: [{ factor: "billing_usage_divergence", contribution: 1 }],
            uncertainties: ["Provider price/catalog updates or late finalization can cause benign divergence."],
            expected: estimated.value,
            observed: finalized.value,
          },
          recommendation: { action_class: "REQUEST_OPERATOR", playbook: "PB-COST-RECONCILE-01" },
          expires_at: new Date(Date.parse(atIso) + 24 * 3600 * 1000).toISOString(),
          correlation_hints: { account_id: scope.account_id },
          policy_generated_effect: false,
        });
      }
    }

    // Quota bypass / correlation: repeated breaches of included quota. The
    // correlation hint lets Prime compound this with usage and identity novelty.
    const quota = this.features.evaluateWindow(QUOTA_EXCEEDED_PER_DAY, scopeKey, atIso);
    if (quota.value >= this.config.quota_breach_count) {
      const quotaEvidence = featureEvidence(quota, "quota_exceeded/day", scopeValues, false);
      evidence.push(quotaEvidence);
      findings.push({
        finding_id: nextFindingId("cost"),
        finding_type: "cost.quota_bypass",
        node: { name: this.name, version: this.version },
        subject: { type: "account", id: scope.account_id },
        tenant_id: scope.tenant_id,
        window: quota.window,
        risk: { likelihood: 0.6, impact: 0.55, confidence: 0.7, evidence_quality: quotaEvidence.quality.score },
        evidence_ids: [quotaEvidence.evidence_id],
        source_event_roots: [quotaEvidence.source_event_root],
        explanation: {
          summary: `${quota.value} quota-exceeded events in 24h; included quota repeatedly breached without throttle.`,
          top_factors: [{ factor: "quota_exceeded_count", contribution: 1 }],
          uncertainties: ["A legitimate plan upgrade or burst workload can breach included quota."],
        },
        recommendation: { action_class: "REQUEST_OPERATOR", playbook: "PB-COST-QUOTA-01" },
        expires_at: new Date(Date.parse(atIso) + 24 * 3600 * 1000).toISOString(),
        correlation_hints: { account_id: scope.account_id },
        policy_generated_effect: false,
      });
    }

    return { findings, evidence };
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
