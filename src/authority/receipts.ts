import { canonicalJson, sha256Hex } from "../contracts/common.js";
import type { ActionReceipt } from "../contracts/receipt.js";
import type { EvidenceLedger } from "../spine/ledger.js";

let receiptCounter = 0;

/**
 * Receipt service (02, SNT-220): every decision and every action attempt —
 * including rejections and rollbacks — produces a durable, hash-protected
 * receipt in the ledger (ADR-016).
 */
export class ReceiptService {
  constructor(private readonly ledger: EvidenceLedger) {}

  create(input: Omit<ActionReceipt, "receipt_id" | "created_at" | "integrity">, atIso: string): ActionReceipt {
    receiptCounter += 1;
    const body = {
      ...input,
      receipt_id: `rcpt_${String(receiptCounter).padStart(5, "0")}`,
      created_at: atIso,
    };
    const receipt: ActionReceipt = {
      ...body,
      integrity: { hash: `sha256:${sha256Hex(canonicalJson(body))}` },
    };
    this.ledger.append({
      kind: "receipt",
      gateway_version: "receipt-service.1.0.0",
      validation: "accepted",
      transformation_version: "1.0.0",
      body: receipt,
    });
    return receipt;
  }

  byIncident(incidentId: string): ActionReceipt[] {
    return this.ledger
      .all()
      .filter((record) => record.kind === "receipt")
      .map((record) => record.body as ActionReceipt)
      .filter((receipt) => receipt.incident_id === incidentId);
  }
}
