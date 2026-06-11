/**
 * Scoped baselines with robust statistics (05, SNT-030): median + MAD for
 * heavy-tailed features, bounded-influence EMA, most-specific-scope-first
 * fallback, and poisoning protections (active-incident exclusion, freeze on
 * confirmed compromise, capped single-window influence).
 */
export interface BaselineConfig {
  baseline_id: string;
  version: string;
  feature: string;
  scope_priority: string[][];
  method: {
    type: "robust_seasonal";
    minimum_samples: number;
    center: "median";
    dispersion: "median_absolute_deviation";
    ema_alpha: number;
  };
  protections: {
    exclude_active_incidents: boolean;
    max_single_window_influence: number;
    freeze_on_confirmed_compromise: boolean;
  };
}

interface BaselineSample {
  window_start: string;
  value: number;
  active_incident: boolean;
}

export interface BaselineEvaluation {
  baseline_id: string;
  baseline_version: string;
  scope_used: string[] | null;
  scope_key: string | null;
  expected: number;
  mad: number;
  ema: number;
  robust_score: number;
  change_ratio: number;
  sample_count: number;
  sufficient: boolean;
  frozen: boolean;
}

const MAD_TO_SIGMA = 1.4826;

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function medianAbsoluteDeviation(values: number[], center: number): number {
  return median(values.map((value) => Math.abs(value - center)));
}

export class BaselineService {
  private readonly configs = new Map<string, BaselineConfig>();
  private readonly samples = new Map<string, BaselineSample[]>();
  private readonly ema = new Map<string, number>();
  private readonly frozen = new Set<string>();

  register(config: BaselineConfig): void {
    this.configs.set(config.baseline_id, config);
  }

  config(baselineId: string): BaselineConfig {
    const config = this.configs.get(baselineId);
    if (!config) throw new Error(`unknown baseline "${baselineId}"`);
    return config;
  }

  private sampleKey(baselineId: string, scopeFields: string[], scopeValues: Record<string, string>): string | null {
    const parts: string[] = [];
    for (const field of scopeFields) {
      const value = scopeValues[field];
      if (value === undefined) return null;
      parts.push(`${field}=${value}`);
    }
    return `${baselineId}::${parts.join("|")}`;
  }

  freeze(baselineId: string, scopeValues: Record<string, string>): void {
    const config = this.config(baselineId);
    for (const scopeFields of config.scope_priority) {
      const key = this.sampleKey(baselineId, scopeFields, scopeValues);
      if (key) this.frozen.add(key);
    }
  }

  addSample(
    baselineId: string,
    scopeValues: Record<string, string>,
    windowStart: string,
    value: number,
    flags: { active_incident?: boolean } = {},
  ): void {
    const config = this.config(baselineId);
    for (const scopeFields of config.scope_priority) {
      const key = this.sampleKey(baselineId, scopeFields, scopeValues);
      if (!key) continue;
      if (config.protections.freeze_on_confirmed_compromise && this.frozen.has(key)) continue;
      const activeIncident = flags.active_incident === true;
      const list = this.samples.get(key) ?? [];
      list.push({ window_start: windowStart, value, active_incident: activeIncident });
      this.samples.set(key, list);
      if (!(config.protections.exclude_active_incidents && activeIncident)) {
        const previous = this.ema.get(key);
        if (previous === undefined) {
          this.ema.set(key, value);
        } else {
          // Bounded-influence EMA: one window may move the average by at most
          // max_single_window_influence of its current magnitude, which blunts
          // slow poisoning via a single extreme window (05 poisoning resistance).
          const step = config.method.ema_alpha * (value - previous);
          const cap = config.protections.max_single_window_influence * Math.max(Math.abs(previous), 1);
          this.ema.set(key, previous + Math.max(-cap, Math.min(cap, step)));
        }
      }
    }
  }

  evaluate(baselineId: string, scopeValues: Record<string, string>, observed: number): BaselineEvaluation {
    const config = this.config(baselineId);
    for (const scopeFields of config.scope_priority) {
      const key = this.sampleKey(baselineId, scopeFields, scopeValues);
      if (!key) continue;
      const usable = (this.samples.get(key) ?? []).filter(
        (sample) => !(config.protections.exclude_active_incidents && sample.active_incident),
      );
      if (usable.length < config.method.minimum_samples) continue;
      const values = usable.map((sample) => sample.value);
      const center = median(values);
      const mad = medianAbsoluteDeviation(values, center);
      const sigma = MAD_TO_SIGMA * mad;
      const robustScore = sigma > 0 ? Math.abs(observed - center) / sigma : observed === center ? 0 : Number.POSITIVE_INFINITY;
      return {
        baseline_id: baselineId,
        baseline_version: config.version,
        scope_used: scopeFields,
        scope_key: key,
        expected: center,
        mad,
        ema: this.ema.get(key) ?? center,
        robust_score: robustScore,
        change_ratio: center > 0 ? observed / center : Number.POSITIVE_INFINITY,
        sample_count: usable.length,
        sufficient: true,
        frozen: this.frozen.has(key),
      };
    }
    // Cold start (05): no sufficient scope; widen uncertainty, do not guess.
    return {
      baseline_id: baselineId,
      baseline_version: config.version,
      scope_used: null,
      scope_key: null,
      expected: 0,
      mad: 0,
      ema: 0,
      robust_score: 0,
      change_ratio: 0,
      sample_count: 0,
      sufficient: false,
      frozen: false,
    };
  }
}
