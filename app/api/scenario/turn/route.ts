// app/api/scenario/turn/route.ts
//
// Single turn of the scenario roleplay.
// Receives the current transcript, asks Bedrock for the patron's next line,
// synthesizes audio, returns both.
//
// Owner: Role A.

import { NextRequest, NextResponse } from "next/server";
import { generateText, ChatMessage } from "@/lib/bedrock";
import { synthesize } from "@/lib/polly";
import { PATRON_ROLEPLAY, SCENARIO_OPENERS } from "@/lib/prompts";

const PATRON_VOICE = process.env.POLLY_PATRON_VOICE_ID ?? "Matthew";

type Turn = { role: "patron" | "guard"; text: string };

export async function POST(req: NextRequest) {
  const { scenarioId, transcript } = (await req.json()) as {
    scenarioId: string;
    transcript: Turn[];
  };

  const sceneSetup = SCENARIO_OPENERS[scenarioId] ?? "";

  // Map transcript → Bedrock messages. Patron lines become "assistant"
  // (since the model is playing the patron). Guard lines become "user".
  const messages: ChatMessage[] = [
    { role: "user", content: `Scenario setup: ${sceneSetup}` },
    ...transcript.map<ChatMessage>((t) => ({
      role: t.role === "patron" ? "assistant" : "user",
      content: t.text,
    })),
  ];

  const patronLine = await generateText(messages, PATRON_ROLEPLAY, {
    maxTokens: 120,
    temperature: 0.8,
  });

  // Heuristic for ending: if the patron uses cooperative language or the
  // transcript has gone on too long, signal the front-end to wrap up.
  const lowerLine = patronLine.toLowerCase();
  const cooperative = ["okay, i'll leave", "i'll go", "fine", "alright, alright"].some((p) =>
    lowerLine.includes(p)
  );
  const shouldEnd = cooperative || transcript.length >= 10;

  const audio = await synthesize(patronLine, PATRON_VOICE);

  return NextResponse.json({
    patronLine,
    audioBase64: audio.audioBase64,
    shouldEnd,
  });
}
