// app/api/quiz/generate/route.ts
//
// Generates a single exam-style question, biased toward the student's weak
// areas. Uses RAG over the ABST manual so questions are always grounded.
//
// Owner: Role B.

import { NextRequest, NextResponse } from "next/server";
import { generateJson } from "@/lib/bedrock";
import { retrieve, formatContext, loadChunks } from "@/lib/abst";
import { QUIZ_GENERATE } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  const { weakAreas } = (await req.json()) as { weakAreas?: string[] };

  // If we have weak areas, retrieve from those. Otherwise, pick random chunks.
  let chunks;
  if (weakAreas && weakAreas.length > 0) {
    chunks = await retrieve(weakAreas.join(" "));
  } else {
    const all = loadChunks();
    chunks = pickRandom(all, 4);
  }

  const userMessage = [
    `Generate ONE practice question (multi-choice OR short-answer, your choice — alternate).`,
    ``,
    `Manual excerpts to draw from:`,
    formatContext(chunks),
    ``,
    `Return JSON with a single-question array.`,
  ].join("\n");

  const result = await generateJson<{ questions: any[] }>(
    [{ role: "user", content: userMessage }],
    QUIZ_GENERATE,
    { maxTokens: 800, temperature: 0.6 }
  );

  // Stamp a unique ID if the model didn't.
  const questions = (result.questions ?? []).map((q) => ({
    ...q,
    id: q.id ?? `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  }));

  return NextResponse.json({ questions });
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && a.length; i++) {
    out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  }
  return out;
}
