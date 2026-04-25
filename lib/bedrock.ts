// lib/bedrock.ts
//
// Thin wrappers around Bedrock's Converse and InvokeModel APIs.
// Every function has a DEMO_MODE branch that returns plausible canned data,
// so the app is testable end-to-end before AWS access is wired up.

import { ConverseCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrock, isDemoMode } from "./aws";

const TEXT_MODEL = process.env.BEDROCK_TEXT_MODEL ?? "anthropic.claude-sonnet-4-20250514-v1:0";
const EMBED_MODEL = process.env.BEDROCK_EMBED_MODEL ?? "amazon.titan-embed-text-v2:0";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Standard chat completion interface, mimicking OpenAI's format.
 * Maps 'system' messages to Bedrock's system prompt field and
 * 'user'/'assistant' messages to the conversation history.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  if (isDemoMode()) {
    return demoText(messages);
  }

  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  const cmd = new ConverseCommand({
    modelId: opts.model ?? TEXT_MODEL,
    system: systemMessages.length > 0 ? systemMessages.map((m) => ({ text: m.content })) : undefined,
    messages: conversationMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: [{ text: m.content }],
    })),
    inferenceConfig: {
      maxTokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.5,
    },
  });

  const res = await bedrock().send(cmd);
  const text = res.output?.message?.content?.[0]?.text;
  if (!text) throw new Error("Bedrock returned no text");
  return text;
}

/**
 * Convenience wrapper for generating text with an optional separate system prompt.
 */
export async function generateText(
  messages: ChatMessage[],
  systemPrompt?: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const allMessages = [...messages];
  if (systemPrompt) {
    allMessages.unshift({ role: "system", content: systemPrompt });
  }
  return chatCompletion(allMessages, opts);
}

/**
 * Generate a JSON-only response. Strips markdown fences if present.
 * Throws if the response can't be parsed.
 */
export async function generateJson<T = unknown>(
  messages: ChatMessage[],
  systemPrompt?: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<T> {
  const raw = await generateText(messages, systemPrompt, {
    ...opts,
    temperature: opts.temperature ?? 0.2,
  });
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.error("[bedrock] failed to parse JSON:", cleaned);
    throw new Error("Model did not return valid JSON");
  }
}

/**
 * Compute a Titan embedding for a string. Returns a 1024-d float vector.
 */
export async function embed(text: string): Promise<number[]> {
  if (isDemoMode()) {
    return fakeEmbedding(text);
  }

  const cmd = new InvokeModelCommand({
    modelId: EMBED_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({ inputText: text }),
  });

  const res = await bedrock().send(cmd);
  const body = JSON.parse(new TextDecoder().decode(res.body));
  return body.embedding as number[];
}

// ---------- demo fallbacks ----------

function demoText(messages: ChatMessage[]): string {
  const last = messages[messages.length - 1]?.content ?? "";
  const sysMessages = messages.filter((m) => m.role === "system");
  const sys = sysMessages.map((m) => m.content).join("\n");

  if (sys.includes("PATRON_ROLEPLAY")) {
    return "I already told you I'm not leaving. I paid for my drink and I'm sitting here. What are you gonna do about it?";
  }
  if (sys.includes("SCENARIO_DEBRIEF")) {
    return JSON.stringify({
      score: 78,
      strengths: [
        "Maintained calm tone throughout the interaction",
        "Identified yourself as security personnel",
      ],
      improvements: [
        "Did not state the trespass warning in clear legal language",
        "Missed an opportunity to offer the patron a graceful exit",
      ],
      manualCitations: [
        { section: "Trespass to Premises Act", quote: "A peace officer or person authorized..." },
      ],
      modelAnswer:
        "A model response would clearly state your authority, give a clear lawful direction to leave, warn that police will be called if non-compliant, and document the incident.",
    });
  }
  if (sys.includes("QUIZ_GENERATE")) {
    return JSON.stringify({
      questions: [
        {
          id: "q1",
          type: "multiple_choice",
          stem: "A security guard's primary role at a licensed premises is to:",
          options: [
            "Arrest patrons who break the law",
            "Observe, deter, and report incidents",
            "Physically remove anyone who looks suspicious",
            "Carry a firearm at all times",
          ],
          correctIndex: 1,
          manualSection: "Role of a Security Guard",
        },
      ],
    });
  }
  if (sys.includes("QUIZ_GRADE")) {
    return JSON.stringify({
      correct: false,
      diagnosis: "vocabulary_gap",
      explanation:
        "Your reasoning was right, but you used the word 'arrest' which has a specific legal meaning. Security guards typically 'detain' rather than 'arrest'.",
      vocabularyTerm: "detain",
    });
  }
  if (sys.includes("DENSITY")) {
    if (last.includes("level=simple")) {
      return "Security guards watch, write things down, and tell others. They do not have police powers.";
    }
    return "A security guard's role is observe, deter, and report. Guards have no special legal powers beyond those of any private citizen.";
  }

  return "(demo mode) " + last.slice(0, 120);
}

function fakeEmbedding(text: string): number[] {
  // Deterministic 64-dim hash so cosine search returns repeatable results in
  // demo mode. Not semantically meaningful — just keeps the pipeline working.
  const dim = 64;
  const out = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    out[i % dim] += text.charCodeAt(i) / 255;
  }
  const norm = Math.sqrt(out.reduce((a, b) => a + b * b, 0)) || 1;
  return out.map((v) => v / norm);
}
