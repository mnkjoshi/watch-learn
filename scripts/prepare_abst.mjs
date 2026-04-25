#!/usr/bin/env node
//
// scripts/prepare_abst.mjs
//
// ⚠️ RUN THIS THE NIGHT BEFORE THE HACKATHON.
// Per plan Section 3 — parsing the PDF live during the hackathon is a
// 30-minute task that can fail in 100 ways. Do it ahead of time.
//
// Usage:
//   1. Drop the ABST manual at data/abst_manual.pdf
//      Source: https://open.alberta.ca/dataset/8afdb67c-38ce-4249-b1a4-d3fdc2a179ca/resource/e79e1511-cc8b-4f24-8bf5-c1c9ce4ccd95/download/abst-particpants-manual-oct-2014-2.pdf
//   2. Make sure .env.local has AWS creds and DEMO_MODE=false (we need real
//      Titan embeddings to ship). If you want to run without AWS and just
//      generate fake embeddings to test the rest of the pipeline, set
//      DEMO_MODE=true — the app will work, but RAG retrieval will return
//      arbitrary chunks.
//   3. Run: node scripts/prepare_abst.mjs
//
// What it does:
//   - Extracts text from the PDF page-by-page.
//   - Splits into ~500-word chunks, snapping to paragraph boundaries.
//   - Detects section headings (heuristic: ALL CAPS lines, or "Section X" / numbered headers).
//   - Computes a Titan v2 embedding for each chunk via Bedrock InvokeModel.
//   - Writes data/abst_chunks.json with shape: AbstChunk[] (see lib/abst.ts).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pdfParse from "pdf-parse";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

// Load .env.local
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PDF_PATH = path.join(ROOT, "data", "abst_manual.pdf");
const OUT_PATH = path.join(ROOT, "data", "abst_chunks.json");

const TARGET_WORDS_PER_CHUNK = 350;
const MAX_WORDS_PER_CHUNK = 600;
const EMBED_MODEL = process.env.BEDROCK_EMBED_MODEL ?? "amazon.titan-embed-text-v2:0";
const REGION = process.env.AWS_REGION ?? "us-east-1";
const DEMO = (process.env.DEMO_MODE ?? "true").toLowerCase() === "true";

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    console.error(`❌ Missing ${PDF_PATH}`);
    console.error(`   Download the ABST manual from open.alberta.ca and place it there.`);
    process.exit(1);
  }

  console.log(`📖 Reading ${PDF_PATH}…`);
  const buffer = fs.readFileSync(PDF_PATH);
  const parsed = await pdfParse(buffer);

  console.log(`   ${parsed.numpages} pages, ${parsed.text.length} characters.`);

  console.log(`✂️  Chunking…`);
  const chunks = chunkText(parsed.text);
  console.log(`   ${chunks.length} chunks.`);

  console.log(`🧮 Computing embeddings (${DEMO ? "FAKE — DEMO_MODE=true" : "real Titan"})…`);
  const client = DEMO ? null : new BedrockRuntimeClient({ region: REGION });
  const out = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const embedding = DEMO ? fakeEmbedding(c.text) : await embed(client, c.text);
    out.push({
      id: `chunk-${i}`,
      text: c.text,
      section: c.section,
      page: c.page,
      embedding,
    });
    if ((i + 1) % 25 === 0 || i === chunks.length - 1) {
      console.log(`   ${i + 1}/${chunks.length}`);
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(out));
  console.log(`✅ Wrote ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1024).toFixed(1)} KB)`);
}

// -------------------- chunking ---------------------------------------

function chunkText(rawText) {
  // Normalize whitespace and split into paragraphs.
  const text = rawText.replace(/\r/g, "").replace(/\f/g, "\n");
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  const chunks = [];
  let currentSection = "Introduction";
  let buffer = [];
  let bufferWordCount = 0;
  let pageEstimate = 1;
  const wordsPerPage = 350; // rough — only used for page estimates in the UI

  let runningWords = 0;

  for (const para of paragraphs) {
    // Detect headings.
    if (looksLikeHeading(para)) {
      // Flush current buffer.
      if (buffer.length > 0) {
        chunks.push(makeChunk(buffer, currentSection, pageEstimate));
        buffer = [];
        bufferWordCount = 0;
      }
      currentSection = cleanHeading(para);
      continue;
    }

    const words = para.split(/\s+/).length;
    runningWords += words;
    pageEstimate = Math.max(1, Math.floor(runningWords / wordsPerPage));

    // If adding this paragraph would exceed the max, flush first.
    if (
      bufferWordCount > 0 &&
      bufferWordCount + words > MAX_WORDS_PER_CHUNK
    ) {
      chunks.push(makeChunk(buffer, currentSection, pageEstimate));
      buffer = [];
      bufferWordCount = 0;
    }

    buffer.push(para);
    bufferWordCount += words;

    // If we've hit the target, flush at a paragraph boundary.
    if (bufferWordCount >= TARGET_WORDS_PER_CHUNK) {
      chunks.push(makeChunk(buffer, currentSection, pageEstimate));
      buffer = [];
      bufferWordCount = 0;
    }
  }
  if (buffer.length > 0) {
    chunks.push(makeChunk(buffer, currentSection, pageEstimate));
  }

  return chunks;
}

function makeChunk(paragraphs, section, page) {
  return {
    text: paragraphs.join("\n\n"),
    section,
    page,
  };
}

function looksLikeHeading(line) {
  if (line.length > 120) return false;
  // Numbered / lettered chapter heading.
  if (/^(chapter|section|module|unit|part)\s+[\dIVX]+/i.test(line)) return true;
  // ALL CAPS heading (with at least 3 words to avoid flagging acronyms).
  const words = line.split(/\s+/);
  if (
    words.length >= 2 &&
    words.length <= 12 &&
    line === line.toUpperCase() &&
    /[A-Z]/.test(line)
  ) {
    return true;
  }
  return false;
}

function cleanHeading(line) {
  return line
    .replace(/^(chapter|section|module|unit|part)\s+[\dIVX]+:?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// -------------------- embeddings -------------------------------------

async function embed(client, text) {
  const cmd = new InvokeModelCommand({
    modelId: EMBED_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({ inputText: text }),
  });
  const res = await client.send(cmd);
  const body = JSON.parse(new TextDecoder().decode(res.body));
  return body.embedding;
}

function fakeEmbedding(text) {
  const dim = 64;
  const out = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    out[i % dim] += text.charCodeAt(i) / 255;
  }
  const norm = Math.sqrt(out.reduce((a, b) => a + b * b, 0)) || 1;
  return out.map((v) => v / norm);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
