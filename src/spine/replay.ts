import { readFileSync } from "node:fs";
import type { EventEnvelope } from "../contracts/envelope.js";
import type { EventGateway, IngestResult } from "./gateway.js";
import type { ProducerCredential } from "./producers.js";

export interface ReplayLine {
  event: EventEnvelope;
  credential: ProducerCredential;
}

export interface ReplaySummary {
  total: number;
  accepted: number;
  duplicates: number;
  rejected: number;
  results: IngestResult[];
}

export function parseReplayJsonl(content: string): ReplayLine[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as ReplayLine);
}

export function loadReplayFile(path: string): ReplayLine[] {
  return parseReplayJsonl(readFileSync(path, "utf8"));
}

/** Deterministic replay: identical input fixtures produce identical ledgers. */
export function replayInto(gateway: EventGateway, lines: ReplayLine[]): ReplaySummary {
  const results = lines.map((line) => gateway.ingest(line.event, line.credential));
  return {
    total: results.length,
    accepted: results.filter((result) => result.status === "accepted").length,
    duplicates: results.filter((result) => result.status === "duplicate").length,
    rejected: results.filter((result) => result.status === "rejected").length,
    results,
  };
}
