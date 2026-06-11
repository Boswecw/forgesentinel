# ADR-024: Modular Monolith for the MVP Slice

**Status:** Accepted (2026-06-11)
**Resolves open decision:** "Modular monolith vs separate node deployables" (13_EPICS_ADRS_AND_EXAMPLES)

## Decision

The first production MVP slice is built as one deployable with hard module
boundaries (`contracts/`, `spine/`, `intel/`, `authority/`) instead of one
service per Sentinel node.

## Rationale

- The roadmap warns against "creating every node as an empty service shell"
  (11, Delivery Strategy). Vertical completeness beats topology.
- Isolation rules that matter are preserved in code: nodes receive only
  feature/baseline/ledger views, hold no authority credentials, and cannot
  reach executors; policy thresholds live outside node code.
- Replay determinism and exit-gate testing are far cheaper in one process.

## Consequences

- Node extraction later is mechanical: each node already has an isolated
  interface (`evaluate`/`process` over evidence, findings out).
- Service identities, transport auth, and per-node deployment land when the
  first node leaves shadow mode for bounded production traffic.
