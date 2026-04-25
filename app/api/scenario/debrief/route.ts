// app/api/scenario/debrief/route.ts
//
// Grades the full scenario transcript against retrieved ABST manual chunks.
// Returns score, strengths, improvements, manual citations, and a model
// answer. This is the "wow moment" of the demo.
//
// Owner: Role A.

import { NextRequest, NextResponse } from "next/server";
import { generateJson } from "@/lib/bedrock";
import { retrieve, formatContext } from "@/lib/abst";
import { SCENARIO_DEBRIEF, SCENARIO_OPENERS } from "@/lib/prompts";

type Turn = { role: "patron" | "guard"; text: string };

type DebriefResponse = {
  score: number;
  strengths: string[];
  improvements: string[];
  manualCitations: { section: string; quote: string }[];
  modelAnswer: string;
};

export async function POST(req: NextRequest) {
  const { scenarioId, transcript } = (await req.json()) as {
    scenarioId: string;
    transcript: Turn[];
  };

  const sceneSetup = SCENARIO_OPENERS[scenarioId] ?? "";

  // Pull manual chunks relevant to this scenario type for grounded grading.
  const guardLines = transcript
    .filter((t) => t.role === "guard")
    .map((t) => t.text)
    .join(" ");
  const retrievalQuery = `${scenarioId} ${guardLines}`.slice(0, 500);
  const chunks = await retrieve(retrievalQuery);

  const transcriptText = transcript
    .map((t) => `${t.role === "patron" ? "PATRON" : "GUARD"}: ${t.text}`)
    .join("\n");

  const userMessage = [
    `Scenario setup:`,
    sceneSetup,
    ``,
    `Transcript:`,
    transcriptText,
    ``,
    `Relevant manual excerpts:`,
    formatContext(chunks),
    ``,
    `Grade the guard's performance. Return JSON only.`,
  ].join("\n");

  const result = await generateJson<DebriefResponse>(
    [{ role: "user", content: userMessage }],
    SCENARIO_DEBRIEF,
    { maxTokens: 1200, temperature: 0.3 }
  );

  // Defensive: ensure shape
  return NextResponse.json({
    score: typeof result.score === "number" ? result.score : 70,
    strengths: result.strengths ?? [],
    improvements: result.improvements ?? [],
    manualCitations: result.manualCitations ?? [],
    modelAnswer: result.modelAnswer ?? "",
  });
}
