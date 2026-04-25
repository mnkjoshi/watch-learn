// app/api/transcribe/route.ts
//
// Speech-to-text via Amazon Transcribe (batch path).
//
// Per plan Section 6: streaming Transcribe over WebSockets in Next.js is
// finicky. This batch path is the rock-solid fallback — slower (3-5s per turn)
// but reliable. Build streaming on top of this only if Role A has time.
//
// Flow:
//   1. Client records audio with MediaRecorder, sends base64 webm.
//   2. We upload to S3 (skipped in DEMO_MODE).
//   3. Start a transcription job, poll until complete.
//   4. Return the transcript.
//
// For the hackathon MVP we ship DEMO_MODE-only here — real Transcribe
// requires S3 setup. The canned response keeps the scenario flow demoable.
//
// TODO (Role A, time permitting):
//   - Wire S3 upload + StartTranscriptionJob + polling.
//   - Optionally swap for Bedrock multimodal audio input if available in
//     your region (single API call, no S3 required).
//
// Owner: Role A.

import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/aws";

// Canned guard responses cycled through in demo mode so the scenario feels
// alive even without a working mic. Roughly maps to the patron escalation arc.
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

  // -------------------------------------------------------------------
  // Real Transcribe path — implementation TODO.
  //
  // Sketch:
  //   const buf = Buffer.from(audioBase64, "base64");
  //   const key = `transcribe-input/${randomUUID()}.webm`;
  //   await s3().send(new PutObjectCommand({ Bucket, Key: key, Body: buf, ContentType: contentType }));
  //   const jobName = `abst-${Date.now()}`;
  //   await transcribe().send(new StartTranscriptionJobCommand({
  //     TranscriptionJobName: jobName,
  //     LanguageCode: "en-US",
  //     MediaFormat: "webm",
  //     Media: { MediaFileUri: `s3://${Bucket}/${key}` },
  //   }));
  //   // Poll every 1s up to ~10s, fetch the result JSON from the returned URI.
  // -------------------------------------------------------------------

  return NextResponse.json(
    { error: "Real Transcribe not yet wired up — set DEMO_MODE=true." },
    { status: 501 }
  );
}
