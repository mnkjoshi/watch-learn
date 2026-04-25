// app/api/dispute/evaluate/route.ts
//
// Real-time evaluation of a guard's de-escalation attempt.
// Called each time the trainee speaks/types during the dispute.
// Returns effectiveness rating + tip so the UI can show live feedback.

import { NextRequest, NextResponse } from "next/server";
import { generateJson, ChatMessage } from "@/lib/bedrock";
import { DISPUTE_GUARD_EVALUATOR, DISPUTE_OPENERS, DISPUTE_SCENARIOS } from "@/lib/prompts";

type DisputeTurn = {
  speaker: "A" | "B" | "guard";
  name: string;
  text: string;
};

type EvalResult = {
  effectiveness: "good" | "neutral" | "poor";
  escalationDelta: number;
  reason: string;
  tip: string;
};

export async function POST(req: NextRequest) {
  const { scenarioId, transcript, guardStatement } = (await req.json()) as {
    scenarioId: string;
    transcript: DisputeTurn[];
    guardStatement: string;
  };

  const scenario = DISPUTE_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: "Unknown dispute scenario" }, { status: 400 });
  }

  const sceneSetup = DISPUTE_OPENERS[scenarioId] ?? "";

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
        `Conversation so far:`,
        transcriptText,
        ``,
        `The security guard trainee just said: "${guardStatement}"`,
        ``,
        `Evaluate this de-escalation attempt. Return JSON only.`,
      ].join("\n"),
    },
  ];

  const result = await generateJson<EvalResult>(messages, DISPUTE_GUARD_EVALUATOR, {
    maxTokens: 300,
    temperature: 0.3,
  });

  return NextResponse.json({
    effectiveness: result.effectiveness ?? "neutral",
    escalationDelta: typeof result.escalationDelta === "number" ? result.escalationDelta : 0,
    reason: result.reason ?? "",
    tip: result.tip ?? "",
  });
}
