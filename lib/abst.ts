// lib/abst.ts
//
// In-memory RAG over the pre-chunked Alberta Basic Security Training manual.
//
// At ~200 pages / ~300 chunks, a JSON file + cosine similarity is faster than
// any vector DB and avoids hours of infra setup. See plan Section 3.
//
// `data/abst_chunks.json` is produced by `scripts/prepare_abst.mjs`.
// If the file doesn't exist yet (early in the build) we fall back to a small
// canned chunk set so dev work isn't blocked.

import { embed } from "./bedrock";
import fs from "node:fs";
import path from "node:path";

export type AbstChunk = {
  id: string;
  text: string;
  section: string;
  page?: number;
  embedding: number[];
};

let _chunks: AbstChunk[] | null = null;

export function loadChunks(): AbstChunk[] {
  if (_chunks) return _chunks;

  const filePath = path.join(process.cwd(), "data", "abst_chunks.json");
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf-8");
    _chunks = JSON.parse(raw) as AbstChunk[];
    console.log(`[abst] loaded ${_chunks.length} chunks from ${filePath}`);
    return _chunks;
  }

  console.warn("[abst] abst_chunks.json missing — using canned fallback. Run `npm run prepare-abst`.");
  _chunks = FALLBACK_CHUNKS;
  return _chunks;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

/**
 * Retrieve the top-k chunks most similar to the query.
 * Caller must have already embedded the query via `embed()`.
 */
export function retrieveByEmbedding(queryEmbedding: number[], k = 15): AbstChunk[] {
  const chunks = loadChunks();
  return chunks
    .map((c) => ({ chunk: c, score: cosine(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => r.chunk);
}

/**
 * Convenience: embed the query and retrieve in one call.
 */
export async function retrieve(query: string, k = 15): Promise<AbstChunk[]> {
  const e = await embed(query);
  return retrieveByEmbedding(e, k);
}

/**
 * Format chunks as a concatenated context block for inclusion in a prompt.
 */
export function formatContext(chunks: AbstChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] (${c.section}${c.page ? `, p.${c.page}` : ""})\n${c.text}`)
    .join("\n\n");
}

// Tiny fallback so the app demos before the prep script runs.
const FALLBACK_CHUNKS: AbstChunk[] = [
  {
    id: "fallback-1",
    section: "Role of a Security Guard",
    text: "A security guard's primary role is to observe, deter, document, and report. Security guards do not have police powers and act as private citizens with the same rights and responsibilities under the law.",
    embedding: new Array(64).fill(0).map((_, i) => Math.sin(i)),
  },
  {
    id: "fallback-2",
    section: "Use of Force",
    text: "Use of force must be reasonable, necessary, and proportionate to the threat. Section 25 of the Criminal Code permits the use of as much force as necessary in the lawful execution of duties.",
    embedding: new Array(64).fill(0).map((_, i) => Math.cos(i)),
  },
  {
    id: "fallback-3",
    section: "Trespass to Premises Act",
    text: "Under Alberta's Trespass to Premises Act, an authorized person may direct a trespasser to leave the premises. Failure to leave when directed constitutes an offence.",
    embedding: new Array(64).fill(0).map((_, i) => Math.sin(i * 2)),
  },
  {
    id: "fallback-4",
    section: "Notetaking and Reporting",
    text: "Notes must be made at the time of the event or as soon as practical afterward. Use the 5 W's: Who, What, When, Where, Why. Notes should be factual, objective, and free of opinion.",
    embedding: new Array(64).fill(0).map((_, i) => Math.cos(i * 2)),
  },
  {
    id: "fallback-5",
    section: "Evidence Handling",
    text: "Maintain chain of custody at all times. Document who collected the evidence, when, where, and how it was stored. Any break in the chain may render evidence inadmissible.",
    embedding: new Array(64).fill(0).map((_, i) => Math.sin(i * 3)),
  },
];
