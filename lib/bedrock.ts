// lib/bedrock.ts
//
// Thin wrappers around Bedrock's Converse and InvokeModel APIs.
// Every function has a DEMO_MODE branch that returns plausible canned data,
// so the app is testable end-to-end before AWS access is wired up.

import { ConverseCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrock, isDemoMode } from "./aws";

const TEXT_MODEL = process.env.BEDROCK_TEXT_MODEL ?? "anthropic.claude-sonnet-4-20250514-v1:0";
const EMBED_MODEL = process.env.BEDROCK_EMBED_MODEL ?? "amazon.titan-embed-text-v2:0";
const IMAGE_MODEL = process.env.BEDROCK_IMAGE_MODEL ?? "stability.stable-image-ultra-v1:1";

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

  const modelId = opts.model ?? TEXT_MODEL;

  const cmd = new ConverseCommand({
    modelId,
    system: systemMessages.length > 0 ? systemMessages.map((m) => ({ text: m.content })) : undefined,
    messages: conversationMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: [{ text: m.content }],
    })),
    inferenceConfig: {
      maxTokens: opts.maxTokens ?? 1024,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
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

/**
 * Generate an image using Stability AI.
 * Returns a base64 encoded image string (data:image/png;base64,...)
 */
export async function generateImage(
  prompt: string,
  opts: { aspect_ratio?: string } = {}
): Promise<string> {
  if (isDemoMode()) {
    return demoImage(prompt);
  }

  const cmd = new InvokeModelCommand({
    modelId: IMAGE_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      prompt,
      aspect_ratio: opts.aspect_ratio ?? "1:1",
      mode: "text-to-image",
    }),
  });

  const res = await bedrock().send(cmd);
  const body = JSON.parse(new TextDecoder().decode(res.body));
  const base64 = body.images?.[0];
  if (!base64) throw new Error("Stability AI returned no image");

  return `data:image/png;base64,${base64}`;
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
  if (sys.includes("DISPUTE_DIRECTOR")) {
    const demoLines = [
      "You know what? This is exactly what you always do. You start something and then act like it's my fault.",
      "Oh please. You've been running your mouth all night. Everyone here is tired of it.",
      "Whatever man. I just want to settle this and go home.",
      "Yeah? Then pay what you owe and we're done.",
      "Look, maybe the security guy is right. Let's just figure this out.",
    ];
    const turnCount = (last.match(/SECURITY GUARD:|Marcus:|Tyler:/g) || []).length;
    return demoLines[turnCount % demoLines.length];
  }
  if (sys.includes("DISPUTE_GUARD_EVAL")) {
    return JSON.stringify({
      effectiveness: "good",
      escalationDelta: -1,
      reason: "The guard identified themselves and used a calm tone to address both parties.",
      tip: "Always position yourself at a safe distance and address both parties equally to avoid appearing biased.",
    });
  }
  if (sys.includes("DISPUTE_DEBRIEF")) {
    return JSON.stringify({
      score: 72,
      strengths: [
        "Identified yourself as security immediately",
        "Addressed both parties rather than just one",
        "Used calm and professional language throughout",
      ],
      improvements: [
        "Could have physically separated the parties sooner by directing one to a different area",
        "Did not mention the option of calling police as a next step if compliance wasn't achieved",
        "Missed opportunity to acknowledge each person's frustration before giving directions",
      ],
      manualCitations: [
        { section: "Communication & De-escalation", quote: "A security professional should use verbal skills to manage conflict before considering physical intervention..." },
        { section: "Use of Force", quote: "Force is always a last resort. The security guard must exhaust all verbal de-escalation options first..." },
      ],
      modelAnswer: "A strong de-escalation response would be: 'Gentlemen, I'm security here. I can see you're both frustrated. Marcus, I hear you — let's sort out the bill fairly. Tyler, I understand your side too. But I need you both to take a step back right now. Let's move to separate areas and we'll work this out calmly. If we can't resolve it here, I'll need to involve the manager or call the police.'",
      breakdown: {
        communication: 80,
        impartiality: 70,
        separation: 55,
        authority: 75,
        escalationJudgment: 65,
      },
    });
  }
  if (sys.includes("DENSITY")) {
    const clbMatch = last.match(/clb=(\d+)/);
    const clb = clbMatch ? Number(clbMatch[1]) : 12;
    if (clb <= 2) {
      return "- Guard = person who watches.\n- Guard looks. Guard writes. Guard tells.\n- Guard is not police.";
    }
    if (clb <= 4) {
      return "A security guard watches a place. The guard writes what happens. The guard tells other people. A guard is not a police officer.";
    }
    if (clb <= 6) {
      return "Security guards watch. They write things down. They tell other people. They are not police.";
    }
    if (clb <= 9) {
      return "Security guards watch, write things down, and tell others. They do not have police powers.";
    }
    return "A security guard's primary role is to observe, deter, and report. Guards have no special legal powers beyond those of any private citizen.";
  }
  if (sys.includes("VIDEO_REPORT_GRADE")) {
    return JSON.stringify({
      overallScore: 68,
      grammarScore: 72,
      contentScore: 65,
      grammarCorrections: [
        {
          original: "I seen two officer",
          corrected: "I saw two officers",
          explanation: "'Seen' needs a helper word like 'have' — use 'saw' for past tense. 'Officer' needs an 's' because there are two.",
        },
        {
          original: "they was looking at the ground",
          corrected: "they were looking at the ground",
          explanation: "With 'they', always use 'were' (not 'was').",
        },
      ],
      detailsIdentified: [
        "Two officers present at the scene",
        "Officers examining something on the ground",
        "Nighttime or dark conditions",
      ],
      detailsMissed: [
        "Use of flashlights or portable lighting",
        "Outdoor location — street or alley",
        "No civilians nearby",
      ],
      structureFeedback: "Your report covers the basic facts but could benefit from a clearer chronological order. Start with when and where, then describe what you observed.",
      languageFeedback: "Good use of 'officer' and 'scene'. Try to include more professional terms like 'observed', 'approximately', and 'incident'.",
      correctedReport: "At approximately [time], I observed two officers at the scene. They were looking at the ground and appeared to be examining evidence. The area was dark with nighttime conditions.",
      modelReport: "At approximately [time], I arrived at the scene of an incident in a dark outdoor area. Two police officers were already present and actively investigating. Officers appeared to be looking at something on the ground. No civilians were observed in the immediate vicinity.",
      encouragement: "You did a good job noticing the key people and their actions. Your observation skills are strong — keep working on the report writing format and you will improve quickly!",
    });
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

function demoImage(prompt: string): string {
  // Returns a base64 string of a 1x1 gray pixel as a placeholder.
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
}
