// app/api/transcribe/route.ts
//
// Speech-to-text via Bedrock Claude (audio content block).
// Client records audio with MediaRecorder, sends base64 webm.
// We pass it to Claude via the Converse API and ask for a transcription.

import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/aws";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrock } from "@/lib/aws";

const TEXT_MODEL = process.env.BEDROCK_TEXT_MODEL ?? "anthropic.claude-sonnet-4-20250514-v1:0";

const DEMO_GUARD_RESPONSES = [
  "Sir, I'm Sam, security on duty here. Staff have asked you to leave three times. I need to ask you to leave the premises now.",
  "I understand you've paid, but management has the right to refuse service. If you don't leave I'll have to call the police.",
  "I'm giving you a final warning. Under the Trespass to Premises Act, refusing to leave is an offence. Please head to the exit.",
  "Thank you for cooperating. I'll walk you to the door and document the incident in my notebook.",
];

let demoTurnCounter = 0;

export async function POST(req: NextRequest) {
  const { audioBase64, contentType } = (await req.json()) as {
    audioBase64: string;
    contentType: string;
  };

  if (isDemoMode()) {
    const transcript = DEMO_GUARD_RESPONSES[demoTurnCounter % DEMO_GUARD_RESPONSES.length];
    demoTurnCounter += 1;
    return NextResponse.json({ transcript });
  }

  try {
    const audioBytes = Buffer.from(audioBase64, "base64");

    const cmd = new ConverseCommand({
      modelId: TEXT_MODEL,
      system: [{ text: "You are a speech transcription tool. Output ONLY the exact words spoken in the audio. No commentary, no quotes, no prefixes. If the audio is silent or unintelligible, respond with an empty string." }],
      messages: [
        {
          role: "user",
          content: [
            {
              audio: {
                format: "webm",
                source: { bytes: audioBytes },
              },
            },
            { text: "Transcribe the audio above. Output only the spoken words, nothing else." },
          ],
        },
      ],
      inferenceConfig: {
        maxTokens: 256,
        temperature: 0,
      },
    });

    const res = await bedrock().send(cmd);
    const transcript = res.output?.message?.content?.[0]?.text?.trim() ?? "";

    return NextResponse.json({ transcript });
  } catch (err: any) {
    console.error("[transcribe]", err);
    return NextResponse.json(
      { error: err.message ?? "Transcription failed" },
      { status: 500 }
    );
  }
}
