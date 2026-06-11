# Implementation Status

Tracks delivery against `docs/plans/Forge_Sentinel_Integrated_Plan_Set_2026-06-11/11_IMPLEMENTATION_ROADMAP.md`.

Status values: `done (MVP)` — implemented and exit-gate tested at MVP depth in this
repository; `partial` — meaningful subset implemented; `not started`.

## Waves

| Wave | Scope | Status | Notes |
|---|---|---|---|
| 0 | Architecture lock and contracts | done (MVP) | All contracts in `src/contracts/`; golden fixtures + manifest in `fixtures/golden/`; unknown-major rejection and additive-minor acceptance tested. TypeScript is the single contract source; Rust bindings pending (ADR-025). |
| 1 | Evidence spine | done (MVP) | Gateway (auth, signatures, idempotency, explicit rejections), append-only ledger with WAL + corrections, local/cloud field policy, tenant-isolation denials, replay CLI. Centipede import format not yet implemented. |
| 2 | Sentinel-Cost | done (MVP) | Extreme spike, sustained growth, retry storm, cache collapse, billing divergence (estimate/finalized kept separate), and quota bypass — all in shadow with scoped robust baselines. Forge_Command cost view is Wave 4 scope. |
| 3 | Sentinel-Cloud | partial | Key/region/device novelty + login-failure bursts in shadow; reversible key pause/resume + MFA require via capability-validated identity authority adapter. Implausible travel, session replay, service-identity findings pending. |
| 4 | Forge_Command incident surface | not started | Incident/briefing contracts and CLI shadow report exist as the data layer; UI lives in the Forge_Command repository. |
| 5 | Sentinel-Agent | done (MVP) | Fingerprint-scoped features (release boundaries cannot mix baselines), boundary-violation/patch-burst/denial/loop findings, compound drift correlation, `sentinel_agent_drift@1.0.0` policy, YellowJacket stop + exact-version quarantine with receipted re-enable. All five Wave 5 exit-gate items tested. Sandbox replay and SMITH handoff projection pending. |
| 6 | Sentinel-Provider + NeuroForge | partial | Fingerprint registry with alias-change findings; trust reset on material change (no silent inheritance, historical identity retained); sensitive-category eligibility gate. EMA integration, challenger shadow evaluation, and NeuroForge routing integration pending. |
| 7 | Sentinel-License | done (MVP) | Real Ed25519 entitlement verification failing closed (unknown key, bad signature, expiry); stale cached entitlements keep safe local operation but require revalidation for paid cloud; shared-entitlement/device-farm, trial-cycling, activation-churn, Stripe-divergence, and invalid-entitlement findings. All five Wave 7 exit-gate items tested. Revalidation executor lives with the entitlement service. |
| 8 | Sentinel-Data | partial | Cross-tenant attempt, redaction failure, export-destination novelty, and bulk-export findings; compound exfiltration correlation with exact-destination block via `sentinel_data_exfiltration@1.0.0`; cloud field policy + recorded denials at the ledger. Retention-failure incidents and classification-transition detectors pending. |
| 9 | Sentinel Prime | partial | Deterministic compound correlation (account compromise, agent drift, data exfiltration), independence accounting, feedback-loop exclusion, conflict preservation, duplicate merge, lifecycle. ML correlation deliberately deferred (ADR-018). |
| 10 | Governed learning | partial | FeedbackStore with contract-validated reviewed labels, explicit training eligibility (privacy approval required), and per-family calibration reports that exclude control-effect-only labels from outcome rates (SNT-405). Dataset registry and champion/challenger pipeline pending. |
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
- SNT-110 Sentinel-Cloud — **partial**
- SNT-115 CSSA Evidence Adapter — **partial**
- SNT-120 Sentinel-Agent — **done (MVP)** (sandbox replay + SMITH handoff pending)
- SNT-130 Sentinel-Provider — **partial** (fingerprint registry + trust reset; NeuroForge integration pending)
- SNT-140 Sentinel-License — **done (MVP)**
- SNT-150 Sentinel-Data — **partial**
- SNT-200 Sentinel Prime — **partial (deterministic MVP)**
- SNT-205 CSSA Finding Normalization — **done (MVP)**
- SNT-210 Policy Service — **done (MVP)**
- SNT-215 Signed Cloud Control Directives — **done (MVP)**
- SNT-220 Action/Receipt Service — **done (MVP)**
- SNT-300/305/310 Forge_Command surfaces — **not started**
- SNT-400 Feedback/Calibration — **partial** (reviewed-label store, training eligibility, per-family calibration; dataset registry + challenger pipeline pending)
- SNT-405 Feedback-Loop Calibration — **done (MVP)** (control lineage excluded from independence and tracked separately in calibration)

## Definition-of-done tracking (00_README)

| Criterion | Status |
|---|---|
| Every finding reconstructable from immutable evidence | tested (`e2e.replay.test.ts`) |
| Every action has authority owner, exact scope, rollback, receipt | tested (`capability.test.ts`, `cssa.test.ts`) |
| Every rule/feature/policy versioned | yes (feature/baseline/policy/correlation versions) |
| Local/cloud boundaries enforced and tested | tested (`ledger.test.ts`) |
| Alias change cannot inherit trust | tested (`provider.test.ts`): provisional successor with zeroed task trust |
| Calibration metrics per incident family | partial (`feedback.test.ts`): precision + calibration gap per family with control-effect separation; recall/detection delay pending |
| Compromised node cannot mutate code/billing/license | enforced via `GLOBAL_ALWAYS_DENY` + no authority credentials in nodes; tested |
| Degraded modes preserve hard controls | partially demonstrated (WAL reload); chaos tests pending |
