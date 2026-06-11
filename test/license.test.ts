import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as edSign } from "node:crypto";
import {
  EntitlementVerifier,
  entitlementSigningPayload,
  SentinelLicenseNode,
  GLOBAL_ALWAYS_DENY,
  buildEvent,
  standardProducers,
  type SignedEntitlement,
  type EventEnvelope,
} from "../src/index.js";

const NOW = "2026-06-09T12:00:00.000Z";
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();

function makeEntitlement(overrides: Partial<SignedEntitlement> = {}): SignedEntitlement {
  const unsigned: SignedEntitlement = {
    entitlement_id: "ent_001",
    account_id: "acct_1",
    plan: "pro",
    features: ["cloud_inference", "paid_overage"],
    device_limit: 3,
    issued_at: "2026-06-08T00:00:00.000Z",
    expires_at: "2026-07-08T00:00:00.000Z",
    signing_key_id: "key_ent_01",
    signature: "",
    ...overrides,
  };
  unsigned.signature = edSign(null, entitlementSigningPayload(unsigned), privateKey).toString("base64");
  return unsigned;
}

function verifier(): EntitlementVerifier {
  const instance = new EntitlementVerifier();
  instance.registerKey("key_ent_01", publicPem);
  return instance;
}

test("valid Ed25519 entitlement verifies and allows paid cloud", () => {
  const decision = verifier().verify(makeEntitlement(), NOW);
  assert.equal(decision.valid, true);
  assert.equal(decision.paid_cloud_allowed, true);
  assert.equal(decision.requires_revalidation, false);
});

test("invalid signature fails closed (Wave 7 exit gate)", () => {
  const tampered = { ...makeEntitlement(), plan: "enterprise" };
  const decision = verifier().verify(tampered, NOW);
  assert.equal(decision.valid, false);
  assert.equal(decision.reason, "invalid_signature");
  assert.equal(decision.paid_cloud_allowed, false);
});

test("unknown signing key and expiry fail closed", () => {
  const unknownKey = verifier().verify(makeEntitlement({ signing_key_id: "key_rogue" }), NOW);
  assert.equal(unknownKey.valid, false);
  assert.equal(unknownKey.reason, "unknown_signing_key");

  const expired = verifier().verify(makeEntitlement({ expires_at: "2026-06-01T00:00:00.000Z" }), NOW);
  assert.equal(expired.valid, false);
  assert.equal(expired.reason, "expired");
});

test("stale cached entitlement keeps safe local operation but requires revalidation for paid cloud", () => {
  const stale = makeEntitlement({ issued_at: "2026-05-01T00:00:00.000Z" });
  const decision = verifier().verify(stale, NOW);
  assert.equal(decision.valid, true, "signature and expiry are still good: local operation is preserved");
  assert.equal(decision.requires_revalidation, true);
  assert.equal(decision.paid_cloud_allowed, false);
});

// --- node findings ---------------------------------------------------------

const producers = Object.fromEntries(standardProducers("production").map((producer) => [producer.service, producer]));

function licenseEvent(id: string, eventType: string, occurredAt: string, accountId: string, payload: Record<string, unknown>): EventEnvelope {
  return buildEvent(producers["billing-service"]!, {
    event_id: id,
    event_type: eventType,
    occurred_at: occurredAt,
    tenant: { tenant_id: "ten_a", account_id: accountId },
    actor: { actor_type: "service", actor_id: "entitlement-service" },
    subject: { subject_type: "account", subject_id: accountId },
    correlation: { trace_id: `trc_${id}` },
    payload,
  }).event;
}

test("one entitlement validated from many devices yields a shared-entitlement finding", () => {
  const node = new SentinelLicenseNode();
  const events = [0, 1, 2, 3].map((index) =>
    licenseEvent(`evt_val_${index}`, "license.entitlement.validated", NOW, "acct_1", {
      entitlement_id: "ent_001",
      device_fingerprint: `dev_${index}`,
    }),
  );
  const output = node.process(events);
  const shared = output.findings.find((finding) => finding.finding_type === "license.entitlement_shared");
  assert.ok(shared);
  assert.match(shared.explanation.summary, /4 distinct devices/);
});

test("trial cycling across accounts on one device is detected", () => {
  const node = new SentinelLicenseNode();
  const events = [
    licenseEvent("evt_trial_1", "license.entitlement.issued", NOW, "acct_a", { plan: "trial", device_fingerprint: "dev_farm" }),
    licenseEvent("evt_trial_2", "license.entitlement.issued", NOW, "acct_b", { plan: "trial", device_fingerprint: "dev_farm" }),
  ];
  const output = node.process(events);
  assert.ok(output.findings.some((finding) => finding.finding_type === "license.trial_cycling"));
});

test("Stripe/entitlement divergence opens reconciliation; entitlement state is never silently trusted over billing", () => {
  const node = new SentinelLicenseNode();
  const events = [
    licenseEvent("evt_stripe", "billing.subscription.changed", "2026-06-09T10:00:00.000Z", "acct_1", { plan: "starter" }),
    licenseEvent("evt_ent", "license.entitlement.issued", "2026-06-09T11:00:00.000Z", "acct_1", { plan: "enterprise" }),
  ];
  const output = node.process(events);
  const divergence = output.findings.find((finding) => finding.finding_type === "license.stripe_divergence");
  assert.ok(divergence);
  assert.match(divergence.explanation.summary, /verified billing remains authoritative/i);
  assert.equal(divergence.recommendation.action_class, "REQUEST_OPERATOR");
});

test("rejected entitlements with invalid signatures become evidence-grade findings", () => {
  const node = new SentinelLicenseNode();
  const output = node.process([
    licenseEvent("evt_rej", "license.entitlement.rejected", NOW, "acct_1", { reason: "invalid_signature", entitlement_id: "ent_x" }),
  ]);
  const finding = output.findings.find((candidate) => candidate.finding_type === "license.invalid_entitlement");
  assert.ok(finding);
  assert.equal(finding.risk.confidence, 0.95);
});

test("Sentinel can never permanently revoke a license (Wave 7 exit gate)", () => {
  assert.ok(GLOBAL_ALWAYS_DENY["license.permanent_revoke"]);
});
