#!/usr/bin/env node
//
// scripts/prepare_abst.mjs
//
// Extracts the full ABST manual using Claude vision (page images → text),
// then chunks and embeds for the reader + RAG pipeline.
//
// Produces two files:
//   data/abst_pages.json  — per-page extracted text (reusable for any feature)
//   data/abst_chunks.json — chunked + embedded (used by lib/abst.ts)
//
// Usage:
//   1. Place the ABST manual at data/abst_manual.pdf
//   2. Set AWS creds in .env / .env.local
//   3. Run: node scripts/prepare_abst.mjs
//
// The vision extraction step is expensive (~200 API calls). If
// data/abst_pages.json already exists, re-chunking skips extraction.
// To force re-extraction: node scripts/prepare_abst.mjs --force

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pdf } from "pdf-to-img";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PDF_PATH = path.join(ROOT, "data", "abst_manual.pdf");
const PAGES_PATH = path.join(ROOT, "data", "abst_pages.json");
const CHUNKS_PATH = path.join(ROOT, "data", "abst_chunks.json");

const TARGET_WORDS = 400;
const MAX_WORDS = 650;
const REGION = process.env.AWS_REGION ?? "us-east-1";
const VISION_MODEL = "anthropic.claude-3-haiku-20240307-v1:0";
const EMBED_MODEL = process.env.BEDROCK_EMBED_MODEL ?? "amazon.titan-embed-text-v2:0";
const DEMO = (process.env.DEMO_MODE ?? "true").toLowerCase() === "true";
const FORCE = process.argv.includes("--force");

const client = new BedrockRuntimeClient({ region: REGION });

// -------------------- main ------------------------------------------

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    console.error(`❌ Missing ${PDF_PATH}`);
    process.exit(1);
  }

  // Step 1: Vision extraction (or resume from checkpoint)
  let skipPages = 0;
  if (!FORCE && fs.existsSync(PAGES_PATH)) {
    const cached = JSON.parse(fs.readFileSync(PAGES_PATH, "utf-8"));
    skipPages = cached.length;
    console.log(`📄 Found ${skipPages} cached pages. Resuming from page ${skipPages + 1}…`);
  }
  const pages = await extractPages(skipPages);
  console.log(`✅ ${pages.length} pages in ${PAGES_PATH} (${(fs.statSync(PAGES_PATH).size / 1024).toFixed(1)} KB)`);

  // Step 2: Chunk
  console.log(`\n✂️  Chunking…`);
  const chunks = chunkPages(pages);
  console.log(`   ${chunks.length} chunks.`);

  // Step 3: Embed
  console.log(`\n🧮 Computing embeddings (${DEMO ? "FAKE" : "real Titan"})…`);
  const out = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const embedding = DEMO ? fakeEmbedding(c.text) : await embed(c.text);
    out.push({ id: `chunk-${i}`, ...c, embedding });
    if ((i + 1) % 25 === 0 || i === chunks.length - 1) {
      console.log(`   ${i + 1}/${chunks.length}`);
    }
  }

  fs.writeFileSync(CHUNKS_PATH, JSON.stringify(out));
  console.log(`\n✅ Wrote ${CHUNKS_PATH} (${(fs.statSync(CHUNKS_PATH).size / 1024).toFixed(1)} KB)`);
}

// -------------------- vision extraction ---------------------------------

const EXTRACT_PROMPT = `You are a precise text transcription tool. Transcribe ALL text visible on this page of the Alberta Basic Security Training manual.

Critical rules:
- TRANSCRIBE EXACTLY — do not summarize, paraphrase, reword, or omit ANY text.
- Copy every word, sentence, bullet point, and paragraph as it appears.
- Preserve paragraph structure with blank lines between paragraphs.
- For headings/titles, prefix with ## on its own line.
- For bullet lists, use - prefix. For numbered lists, use 1. 2. 3. format.
- For tables, use | column | separators |.
- SKIP ONLY: the repeating header "Alberta Solicitor General and Ministry of Public Security..." and page numbers.
- If the page is only an image/graphic with no text, respond with: [IMAGE PAGE]
- If there is text alongside images, transcribe all the text.

Return ONLY the transcribed text. No commentary, no notes, no "Here is the text:" prefix.`;

async function extractPages(skipPages = 0) {
  console.log(`📖 Converting PDF pages to images and extracting with Haiku…${skipPages > 0 ? ` (resuming from page ${skipPages + 1})` : ""}`);
  const pages = [];
  let pageNum = 0;

  const document = await pdf(PDF_PATH, { scale: 2.0 });

  for await (const imageBuffer of document) {
    pageNum++;
    if (pageNum <= skipPages) continue;

    let text;
    try {
      const cmd = new ConverseCommand({
        modelId: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                image: {
                  format: "png",
                  source: { bytes: imageBuffer },
                },
              },
              { text: EXTRACT_PROMPT },
            ],
          },
        ],
        inferenceConfig: { maxTokens: 4096, temperature: 0 },
      });

      const res = await client.send(cmd);
      text = res.output?.message?.content?.[0]?.text ?? "[EXTRACTION FAILED]";
    } catch (err) {
      console.error(`   ⚠️ Page ${pageNum} failed: ${err.message}`);
      text = "[EXTRACTION FAILED]";
    }

    pages.push({ page: pageNum, text });

    // Print preview so you can verify quality as it runs
    const preview = text.replace(/\n/g, " ").substring(0, 120);
    const wordCount = text.split(/\s+/).length;
    console.log(`   p.${String(pageNum).padStart(3)} (${String(wordCount).padStart(4)}w): ${preview}…`);

    // Save incrementally every 10 pages
    if (pages.length % 10 === 0) {
      const existing = fs.existsSync(PAGES_PATH)
        ? JSON.parse(fs.readFileSync(PAGES_PATH, "utf-8"))
        : [];
      fs.writeFileSync(PAGES_PATH, JSON.stringify(existing.concat(pages), null, 2));
      console.log(`   💾 Checkpoint saved (${existing.length + pages.length} total pages)`);
      pages.length = 0; // clear buffer since we wrote them
    }
  }

  // Flush any remaining pages
  if (pages.length > 0) {
    const existing = fs.existsSync(PAGES_PATH)
      ? JSON.parse(fs.readFileSync(PAGES_PATH, "utf-8"))
      : [];
    fs.writeFileSync(PAGES_PATH, JSON.stringify(existing.concat(pages), null, 2));
  }

  console.log(`   Done. ${pageNum} pages processed.`);
  // Return the full set from disk
  return fs.existsSync(PAGES_PATH)
    ? JSON.parse(fs.readFileSync(PAGES_PATH, "utf-8"))
    : [];
}

// -------------------- chunking ------------------------------------------

function chunkPages(pages) {
  const chunks = [];
  let currentSection = "Introduction";
  let buffer = [];
  let bufferWords = 0;
  let bufferPage = 1;
  let lastLineBlank = false;

  for (const { page, text } of pages) {
    if (!text || text === "[IMAGE PAGE]" || text === "[EXTRACTION FAILED]") continue;

    const lines = text.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();

      // Preserve blank lines as paragraph breaks in the output
      if (!trimmed) {
        lastLineBlank = true;
        continue;
      }

      // Detect headings — use as section label AND keep in chunk text
      if (trimmed.startsWith("## ") || trimmed.startsWith("##")) {
        const heading = trimmed.replace(/^#+\s*/, "").trim();
        if (heading.length > 0 && heading.length < 120) {
          if (buffer.length > 0) {
            chunks.push(makeChunk(buffer, currentSection, bufferPage));
            buffer = [];
            bufferWords = 0;
          }
          currentSection = heading;
          bufferPage = page;
          lastLineBlank = false;
        }
        // Keep the heading in the buffer so it renders in the text
        if (buffer.length === 0) bufferPage = page;
        buffer.push(trimmed);
        bufferWords += trimmed.split(/\s+/).length;
        lastLineBlank = false;
        continue;
      }

      const wordCount = trimmed.split(/\s+/).length;

      if (bufferWords > 0 && bufferWords + wordCount > MAX_WORDS) {
        chunks.push(makeChunk(buffer, currentSection, bufferPage));
        buffer = [];
        bufferWords = 0;
        bufferPage = page;
        lastLineBlank = false;
      }

      if (buffer.length === 0) bufferPage = page;

      // Insert a blank line before this line if there was a paragraph break
      if (lastLineBlank && buffer.length > 0) {
        buffer.push("");
      }

      buffer.push(trimmed);
      bufferWords += wordCount;
      lastLineBlank = false;

      if (bufferWords >= TARGET_WORDS) {
        chunks.push(makeChunk(buffer, currentSection, bufferPage));
        buffer = [];
        bufferWords = 0;
      }
    }
  }

  if (buffer.length > 0) {
    chunks.push(makeChunk(buffer, currentSection, bufferPage));
  }

  return chunks;
}

function makeChunk(lines, section, page) {
  return { text: lines.join("\n"), section, page };
}

// -------------------- embeddings ----------------------------------------

async function embed(text) {
  const cmd = new InvokeModelCommand({
    modelId: EMBED_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({ inputText: text.substring(0, 8000) }),
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
