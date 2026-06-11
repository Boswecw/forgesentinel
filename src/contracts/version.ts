import { Issues, type ValidationResult } from "./common.js";

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseSemver(version: string): SemVer | null {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Contract versioning rules (04_EVENT_EVIDENCE_AND_INCIDENT_CONTRACTS):
 * additive optional fields bump the minor version and remain consumable;
 * meaning changes bump the major version and consumers MUST reject
 * unknown majors rather than guess.
 */
export function checkSchemaVersion(
  version: unknown,
  supportedMajor: number,
  path = "schema_version",
): ValidationResult {
  const issues = new Issues();
  if (typeof version !== "string") {
    issues.add(path, "required_string", `field "${path}" must be a semantic version string`);
    return issues.result();
  }
  const parsed = parseSemver(version);
  if (!parsed) {
    issues.add(path, "invalid_semver", `field "${path}" must be MAJOR.MINOR.PATCH, got "${version}"`);
    return issues.result();
  }
  if (parsed.major !== supportedMajor) {
    issues.add(
      path,
      "unsupported_major_version",
      `unsupported major version ${parsed.major} (supported: ${supportedMajor}); failing safely instead of guessing`,
    );
  }
  return issues.result();
}
