// app/api/dispute/debrief/route.ts
//
// Grades the full dispute de-escalation transcript.
// Returns detailed breakdown of the guard's performance.

import { NextRequest, NextResponse } from "next/server";
import { generateJson } from "@/lib/bedrock";
import { retrieve, formatContext } from "@/lib/abst";
import { DISPUTE_DEBRIEF, DISPUTE_OPENERS, DISPUTE_SCENARIOS } from "@/lib/prompts";

type DisputeTurn = {
  speaker: "A" | "B" | "guard";
  name: string;
  text: string;
};

type DisputeDebriefResponse = {
  score: number;
  strengths: string[];
  improvements: string[];
  manualCitations: { section: string; quote: string }[];
  modelAnswer: string;
  breakdown: {
    communication: number;
    impartiality: number;
    separation: number;
    authority: number;
    escalationJudgment: number;
  };
};

export async function POST(req: NextRequest) {
  const { scenarioId, transcript } = (await req.json()) as {
    scenarioId: string;
    transcript: DisputeTurn[];
  };

  const scenario = DISPUTE_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: "Unknown dispute scenario" }, { status: 400 });
  }

  const sceneSetup = DISPUTE_OPENERS[scenarioId] ?? "";

  // Pull manual chunks relevant to de-escalation for grounded grading
  const guardLines = transcript
    .filter((t) => t.speaker === "guard")
    .map((t) => t.text)
    .join(" ");
  const retrievalQuery = `de-escalation communication conflict resolution ${scenario.manualSection} ${guardLines}`.slice(0, 500);
  const chunks = await retrieve(retrievalQuery, 5);

  const transcriptText = transcript
    .map((t) => {
      if (t.speaker === "guard") return `SECURITY GUARD: ${t.text}`;
      return `${t.name.toUpperCase()}: ${t.text}`;
    })
    .join("\n");

  const userMessage = [
    `Dispute scenario: ${scenario.title}`,
    `Setting: ${sceneSetup}`,
    ``,
    `Full transcript:`,
    transcriptText,
    ``,
    `Relevant manual excerpts:`,
    formatContext(chunks),
    ``,
    `The guard made ${transcript.filter((t) => t.speaker === "guard").length} intervention(s) during this dispute.`,
    `Grade the guard's de-escalation performance. Return JSON only.`,
  ].join("\n");

  const result = await generateJson<DisputeDebriefResponse>(
    [{ role: "user", content: userMessage }],
    DISPUTE_DEBRIEF,
    { maxTokens: 1500, temperature: 0.3 }
  );

  // Defensive defaults
  const defaultBreakdown = {
    communication: 50,
    impartiality: 50,
    separation: 50,
    authority: 50,
    escalationJudgment: 50,
  };

  return NextResponse.json({
    score: typeof result.score === "number" ? result.score : 50,
    strengths: result.strengths ?? [],
    improvements: result.improvements ?? [],
    manualCitations: result.manualCitations ?? [],
    modelAnswer: result.modelAnswer ?? "",
    breakdown: result.breakdown ?? defaultBreakdown,
  });
}
