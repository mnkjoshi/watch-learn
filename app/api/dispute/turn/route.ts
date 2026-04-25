// app/api/dispute/turn/route.ts
//
// Generates the next disputant line in a live dispute scenario.
// The front-end calls this to get dialogue for Person A or B,
// which is then fed to the HeyGen avatar via speak().

import { NextRequest, NextResponse } from "next/server";
import { generateText, ChatMessage } from "@/lib/bedrock";
import { DISPUTE_DIRECTOR, DISPUTE_OPENERS, DISPUTE_SCENARIOS } from "@/lib/prompts";

type DisputeTurn = {
  speaker: "A" | "B" | "guard";
  name: string;
  text: string;
};

export async function POST(req: NextRequest) {
  const { scenarioId, transcript, nextSpeaker } = (await req.json()) as {
    scenarioId: string;
    transcript: DisputeTurn[];
    nextSpeaker: "A" | "B";
  };

  const scenario = DISPUTE_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: "Unknown dispute scenario" }, { status: 400 });
  }

  const sceneSetup = DISPUTE_OPENERS[scenarioId] ?? "";
  const speakerInfo =
    nextSpeaker === "A"
      ? `You are ${scenario.personA.name}. ${scenario.personA.mood}. ${scenario.personA.grievance}`
      : `You are ${scenario.personB.name}. ${scenario.personB.mood}. ${scenario.personB.grievance}`;

  // Build conversation history for Bedrock
  const transcriptText = transcript
    .map((t) => {
      if (t.speaker === "guard") return `SECURITY GUARD: ${t.text}`;
      return `${t.name}: ${t.text}`;
    })
    .join("\n");

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: [
        `Scenario: ${sceneSetup}`,
        ``,
        `You are playing: ${speakerInfo}`,
        ``,
        `Conversation so far:`,
        transcriptText,
        ``,
        `Generate ${nextSpeaker === "A" ? scenario.personA.name : scenario.personB.name}'s next line. Remember: 1-2 sentences max, stay in character, react to the guard if they've spoken.`,
      ].join("\n"),
    },
  ];

  const line = await generateText(messages, DISPUTE_DIRECTOR, {
    maxTokens: 100,
    temperature: 0.85,
  });

  // Detect if the dispute is winding down
  const lower = line.toLowerCase();
  const deEscalating = [
    "fine", "okay", "alright", "whatever", "let's just", "forget it",
    "i'll go", "i'm leaving", "sorry", "my bad",
  ].some((p) => lower.includes(p));

  // Count guard interventions
  const guardTurns = transcript.filter((t) => t.speaker === "guard").length;
  const totalTurns = transcript.length;

  // End conditions: de-escalated after guard intervention, or too many turns
  const shouldEnd =
    (deEscalating && guardTurns >= 2) || totalTurns >= 20;

  return NextResponse.json({
    line,
    speaker: nextSpeaker,
    name: nextSpeaker === "A" ? scenario.personA.name : scenario.personB.name,
    shouldEnd,
  });
}
