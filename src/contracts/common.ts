import { createHash } from "node:crypto";

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export function ok(): ValidationResult {
  return { ok: true, issues: [] };
}

export function fail(issues: ValidationIssue[]): ValidationResult {
  return { ok: false, issues };
}

export class Issues {
  readonly list: ValidationIssue[] = [];

  add(path: string, code: string, message: string): void {
    this.list.push({ path, code, message });
  }

  merge(result: ValidationResult, prefix = ""): void {
    for (const issue of result.issues) {
      this.list.push({ ...issue, path: prefix ? `${prefix}.${issue.path}` : issue.path });
    }
  }

  result(): ValidationResult {
    return { ok: this.list.length === 0, issues: [...this.list] };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireString(
  issues: Issues,
  obj: Record<string, unknown>,
  field: string,
  opts: { prefix?: string; enum?: readonly string[]; pattern?: RegExp } = {},
): string | undefined {
  const value = obj[field];
  const path = opts.prefix ? `${opts.prefix}.${field}` : field;
  if (typeof value !== "string" || value.length === 0) {
    issues.add(path, "required_string", `field "${path}" must be a non-empty string`);
    return undefined;
  }
  if (opts.enum && !opts.enum.includes(value)) {
    issues.add(path, "invalid_enum", `field "${path}" must be one of [${opts.enum.join(", ")}], got "${value}"`);
    return undefined;
  }
  if (opts.pattern && !opts.pattern.test(value)) {
    issues.add(path, "invalid_format", `field "${path}" does not match required format`);
    return undefined;
  }
  return value;
}

export function requireBoolean(
  issues: Issues,
  obj: Record<string, unknown>,
  field: string,
  prefix?: string,
): boolean | undefined {
  const value = obj[field];
  const path = prefix ? `${prefix}.${field}` : field;
  if (typeof value !== "boolean") {
    issues.add(path, "required_boolean", `field "${path}" must be a boolean`);
    return undefined;
  }
  return value;
}

export function requireNumber(
  issues: Issues,
  obj: Record<string, unknown>,
  field: string,
  opts: { prefix?: string; min?: number; max?: number } = {},
): number | undefined {
  const value = obj[field];
  const path = opts.prefix ? `${opts.prefix}.${field}` : field;
  if (typeof value !== "number" || Number.isNaN(value)) {
    issues.add(path, "required_number", `field "${path}" must be a number`);
    return undefined;
  }
  if (opts.min !== undefined && value < opts.min) {
    issues.add(path, "out_of_range", `field "${path}" must be >= ${opts.min}`);
    return undefined;
  }
  if (opts.max !== undefined && value > opts.max) {
    issues.add(path, "out_of_range", `field "${path}" must be <= ${opts.max}`);
    return undefined;
  }
  return value;
}

export function requireIsoTimestamp(
  issues: Issues,
  obj: Record<string, unknown>,
  field: string,
  prefix?: string,
): string | undefined {
  const value = requireString(issues, obj, field, prefix ? { prefix } : {});
  if (value === undefined) return undefined;
  const path = prefix ? `${prefix}.${field}` : field;
  if (Number.isNaN(Date.parse(value))) {
    issues.add(path, "invalid_timestamp", `field "${path}" must be an ISO-8601 timestamp`);
    return undefined;
  }
  return value;
}

export function requireObject(
  issues: Issues,
  obj: Record<string, unknown>,
  field: string,
  prefix?: string,
): Record<string, unknown> | undefined {
  const value = obj[field];
  const path = prefix ? `${prefix}.${field}` : field;
  if (!isRecord(value)) {
    issues.add(path, "required_object", `field "${path}" must be an object`);
    return undefined;
  }
  return value;
}

/**
 * Serializes with recursively sorted keys so hashes and signatures are
 * stable regardless of property insertion order.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortValue(value[key]);
    }
    return sorted;
  }
  return value;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hashPayload(payload: unknown): string {
  return `sha256:${sha256Hex(canonicalJson(payload))}`;
}

export const RISK_DIMENSION_FIELDS = ["likelihood", "impact", "confidence", "evidence_quality"] as const;

/** ADR-010: risk dimensions stay separate; never collapse them into one score. */
export interface RiskDimensions {
  likelihood: number;
  impact: number;
  confidence: number;
  evidence_quality: number;
}

export function validateRiskDimensions(value: unknown, prefix: string): ValidationResult {
  const issues = new Issues();
  if (!isRecord(value)) {
    issues.add(prefix, "required_object", `field "${prefix}" must be an object`);
    return issues.result();
  }
  for (const field of RISK_DIMENSION_FIELDS) {
    requireNumber(issues, value, field, { prefix, min: 0, max: 1 });
  }
  return issues.result();
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
