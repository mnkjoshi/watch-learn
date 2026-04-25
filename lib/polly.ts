// lib/polly.ts
//
// Polly text-to-speech helpers.
//
// Two functions:
//   - synthesize(text, voiceId): returns base64 mp3 for client-side <audio>
//   - synthesizeWithMarks(text, voiceId): returns base64 mp3 + sentence-level
//     speech marks for read-aloud-with-highlight in the bilingual reader

import { SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { polly, isDemoMode } from "./aws";

const DEFAULT_VOICE = process.env.POLLY_VOICE_ID ?? "Joanna";

export type SpeechMark = {
  time: number;        // ms from start of audio
  type: "sentence" | "word";
  start: number;       // char offset in input text
  end: number;
  value: string;
};

export type SynthResult = {
  audioBase64: string;
  contentType: string;
  marks?: SpeechMark[];
};

export async function synthesize(text: string, voiceId = DEFAULT_VOICE): Promise<SynthResult> {
  if (isDemoMode()) {
    return demoAudio();
  }

  const cmd = new SynthesizeSpeechCommand({
    Text: text,
    VoiceId: voiceId as any,
    OutputFormat: "mp3",
    Engine: "neural",
  });
  const res = await polly().send(cmd);
  const buf = await streamToBuffer(res.AudioStream as any);
  return {
    audioBase64: buf.toString("base64"),
    contentType: "audio/mpeg",
  };
}

export async function synthesizeWithMarks(
  text: string,
  voiceId = DEFAULT_VOICE
): Promise<SynthResult> {
  if (isDemoMode()) {
    return { ...(await demoAudio()), marks: demoMarks(text) };
  }

  // Two calls: one for audio, one for sentence marks. Polly returns these
  // in separate requests when OutputFormat=json.
  const audio = await synthesize(text, voiceId);

  const marksCmd = new SynthesizeSpeechCommand({
    Text: text,
    VoiceId: voiceId as any,
    OutputFormat: "json",
    Engine: "neural",
    SpeechMarkTypes: ["sentence"],
  });
  const marksRes = await polly().send(marksCmd);
  const marksRaw = (await streamToBuffer(marksRes.AudioStream as any)).toString("utf-8");
  const marks: SpeechMark[] = marksRaw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  return { ...audio, marks };
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// 0.5s of silence so the <audio> tag has something playable in demo mode.
async function demoAudio(): Promise<SynthResult> {
  // Minimal silent MP3 (~0.5s, base64).
  const silent =
    "//uQRAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgL+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+AAAAAExhdmM1OC45MQAAAAAAAAAAAAAAACQAAAAAAAAAAAJxJZBOAQAAAAAAAAAAAAAAAAAAAAA=";
  return { audioBase64: silent, contentType: "audio/mpeg" };
}

function demoMarks(text: string): SpeechMark[] {
  // Approximate sentence-level marks at 400ms per word for demo highlighting.
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let cursor = 0;
  let timeMs = 0;
  return sentences.map((s) => {
    const start = text.indexOf(s, cursor);
    cursor = start + s.length;
    const wordCount = s.split(/\s+/).length;
    const mark: SpeechMark = {
      time: timeMs,
      type: "sentence",
      start,
      end: start + s.length,
      value: s.trim(),
    };
    timeMs += wordCount * 400;
    return mark;
  });
}
