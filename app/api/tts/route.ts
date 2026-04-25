// app/api/tts/route.ts
//
// Polly text-to-speech. Pass withMarks=true to get sentence-level speech
// marks back for read-aloud-with-highlight in the reader.
//
// Owner: Role C.

import { NextRequest, NextResponse } from "next/server";
import { synthesize, synthesizeWithMarks } from "@/lib/polly";

export async function POST(req: NextRequest) {
  const { text, voiceId, withMarks } = (await req.json()) as {
    text: string;
    voiceId?: string;
    withMarks?: boolean;
  };

  const result = withMarks
    ? await synthesizeWithMarks(text, voiceId)
    : await synthesize(text, voiceId);

  return NextResponse.json(result);
}
