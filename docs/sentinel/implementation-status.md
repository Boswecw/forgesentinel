# Implementation Status

Tracks delivery against `docs/plans/Forge_Sentinel_Integrated_Plan_Set_2026-06-11/11_IMPLEMENTATION_ROADMAP.md`.

Status values: `done (MVP)` — implemented and exit-gate tested at MVP depth in this
repository; `partial` — meaningful subset implemented; `not started`.

## Waves

| Wave | Scope | Status | Notes |
|---|---|---|---|
| 0 | Architecture lock and contracts | done (MVP) | All contracts in `src/contracts/`; golden fixtures + manifest in `fixtures/golden/`; unknown-major rejection and additive-minor acceptance tested. TypeScript is the single contract source; Rust bindings pending (ADR-025). |
| 1 | Evidence spine | done (MVP) | Gateway (auth, signatures, idempotency, explicit rejections), append-only ledger with WAL + corrections, local/cloud field policy, tenant-isolation denials, replay CLI. Centipede import format not yet implemented. |
| 2 | Sentinel-Cost | done (MVP) | Extreme spike, sustained growth, retry storm, **cache-collapse** (robust hit-ratio baseline), **billing/usage-divergence** (metered estimate vs finalized), and **quota-bypass** (feeds Prime correlation) — all shadow/recommend-only, covered by `test/cost.test.ts`. |
| 3 | Sentinel-Cloud | done (MVP) | Key/region/device novelty + login-failure bursts, **implausible-travel** (region-geo speed check), **session-replay** (session-id seen from ≥2 devices), and **service-identity-misuse** (privileged identity op by a service identity) in shadow; reversible key pause/resume + MFA require via capability-validated identity authority adapter. Covered by `test/cloud.test.ts`. |
| 4 | Forge_Command incident surface | not started | Incident/briefing contracts and CLI shadow report exist as the data layer; UI lives in the Forge_Command repository. |
| 5 | Sentinel-Agent | not started | Agent event families registered in contracts only. |
| 6 | Sentinel-Provider + NeuroForge | partial | Model fingerprint + scoped trust-vector contracts and material-change detection helper; routing integration pending. |
| 7 | Sentinel-License | not started | License/billing event families and signature-required ingestion enforced; detector pending. |
| 8 | Sentinel-Data | partial (early) | Cross-tenant denial recording and cloud field policy enforced at the ledger now (the plan's reason to defer Sentinel-Data was the need for these foundations). Export/egress detectors pending. |
| 9 | Sentinel Prime | partial | Deterministic compound correlation, independence accounting, feedback-loop exclusion, conflict preservation, duplicate merge, lifecycle. ML correlation deliberately deferred (ADR-018). |
| 10 | Governed learning | not started | Feedback-label contract with training-eligibility/privacy gating exists; calibration pipeline pending. |
| 11 | Production hardening | not started | |

## CSSA integration gates (2026-06-11 addendum)

| Gate | Status | Notes |
|---|---|---|
| A — Contract alignment | done (MVP) | CSSA event mappings, `CloudSecurityFinding.v1`, `CloudSecurityControlDirective.v1`, lineage fields; legacy `SecurityIncident.v1` rejected outside the adapter; Forge_Command is the sole lifecycle owner. |
| B — Evidence flow | partial | CSSA registered as a signing producer; decision/authorization/outcome copies share one evidence root via `run_id`. Full record-family persistence pending. |
| C — Correlation in shadow | partial | Watchdog findings adapt to source findings; shared-root accounting prevents double counting; Prime promotion explicit. |
| D — Signed return controls | done (MVP) | Issuer, registry, validation (issuer/signature/expiry/scope/replay/rollback/unknown-fields), single-use application with receipts, rollback receipts; raw incidents rejected as non-authoritative; lineage flows into downstream events and is excluded from independence. |
| E — Unified operations | not started | Forge_Command UI scope. |

## Epic checklist (13_EPICS)

- SNT-000 Contract Foundation — **done (MVP)** (Rust bindings pending)
- SNT-010 Event Gateway — **done (MVP)**
- SNT-020 Evidence Ledger — **done (MVP)** (DataForge service integration pending)
- SNT-030 Feature/Baseline Service — **done (MVP)**
- SNT-100 Sentinel-Cost — **done (MVP)**
- SNT-110 Sentinel-Cloud — **done (MVP)**
- SNT-115 CSSA Evidence Adapter — **partial**
- SNT-120/130/140/150 remaining nodes — **not started** (130 contracts exist)
- SNT-200 Sentinel Prime — **partial (deterministic MVP)**
- SNT-205 CSSA Finding Normalization — **done (MVP)**
- SNT-210 Policy Service — **done (MVP)**
- SNT-215 Signed Cloud Control Directives — **done (MVP)**
- SNT-220 Action/Receipt Service — **done (MVP)**
- SNT-300/305/310 Forge_Command surfaces — **not started**
- SNT-400/405 Feedback/Calibration — **contracts only**

## Definition-of-done tracking (00_README)

| Criterion | Status |
|---|---|
| Every finding reconstructable from immutable evidence | tested (`e2e.replay.test.ts`) |
| Every action has authority owner, exact scope, rollback, receipt | tested (`capability.test.ts`, `cssa.test.ts`) |
| Every rule/feature/policy versioned | yes (feature/baseline/policy/correlation versions) |
| Local/cloud boundaries enforced and tested | tested (`ledger.test.ts`) |
| Alias change cannot inherit trust | contract helper only; routing integration pending |
| Calibration metrics per incident family | pending |
| Compromised node cannot mutate code/billing/license | enforced via `GLOBAL_ALWAYS_DENY` + no authority credentials in nodes; tested |
| Degraded modes preserve hard controls | partially demonstrated (WAL reload); chaos tests pending |
