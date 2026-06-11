# ADR-025: TypeScript Reference Contracts with Golden Fixtures as the Cross-Language Surface

**Status:** Accepted (2026-06-11)
**Resolves open decision:** "Canonical schema and binding generator" (13_EPICS_ADRS_AND_EXAMPLES)

## Decision

`src/contracts/` (TypeScript) is the single contract source for the MVP. The
cross-language compatibility surface is the committed golden fixture set
(`fixtures/golden/` + `manifest.json`): any future binding (Rust first) must
reproduce the manifest's accept/reject results exactly.

## Rationale

- Wave 0's exit gate requires Rust/TypeScript consumers to share compatible
  contracts with golden fixtures and compatibility tests. Fixtures are the
  part both languages can verify byte-for-byte; a schema generator can be
  added later without changing them.
- Hand-rolled validators keep rejection reasons explicit (`unsupported_major_version`,
  `forbidden_content_policy`, `unknown_critical_field`), which the plan treats
  as product behavior, not incidental detail.

## Consequences

- A Rust `forge_contract_core` crate must ship with a test that walks
  `fixtures/golden/manifest.json`.
- Contract changes require regenerating fixtures (`npm run fixtures`), which
  forces a review diff on the compatibility surface — the migration-plan
  hook the contract-first rule demands.
