# ADR-026: HMAC-SHA256 Signing for MVP; Ed25519 Before Production

**Status:** Accepted (2026-06-11)
**Resolves open decisions:** "Local producer signing method" and "Capability format/key ownership" (13_EPICS_ADRS_AND_EXAMPLES)

## Decision

Producer authentication, high-value event signatures, capability tokens, and
CSSA control directives are signed with HMAC-SHA256 over canonical JSON in
the MVP. Key ownership already follows the production split:

- producer keys: held by each producer and the gateway registry
- capability signing key: sentinel-policy-service only
- control-directive signing key: forge-command-policy only — Sentinel nodes
  have no path to it

## Rationale

The enforcement semantics under test (exact scope, expiry, single use,
replay rejection, unknown-field rejection, rollback requirements) are
signature-scheme independent. HMAC keeps the MVP dependency-free while the
verification points are built and exercised.

## Consequences

- Before any non-shadow deployment, swap HMAC for Ed25519 (asymmetric, so
  verifiers hold no signing capability) at the three call sites:
  `spine/producers.ts`, `authority/capability.ts`, `authority/cssa-control.ts`.
  Each already isolates sign/verify into single functions.
- Signed entitlements were always specified as Ed25519 (03) and are not
  affected by this interim choice.
