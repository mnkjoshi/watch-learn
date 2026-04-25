// app/api/chat/route.ts
//
// Tutor chat. Used in-context inside the reader when a student wants to ask
// "what does this section mean?" or "what's the difference between detain and arrest?".
// RAG-grounded so answers always trace back to the manual.
//
// Owner: Role C (reader chat sidebar — stretch goal if there's time).

import { NextRequest, NextResponse } from "next/server";
import { generateText, ChatMessage } from "@/lib/bedrock";
import { retrieve, formatContext } from "@/lib/abst";
import { TUTOR_CHAT } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  // Retrieve manual context based on the latest user message.
  const last = messages[messages.length - 1]?.content ?? "";
  const chunks = await retrieve(last);

  // Inject context as a system-augmenting preface to the latest user message.
  const augmented: ChatMessage[] = [
    ...messages.slice(0, -1),
    {
      role: "user",
      content: `Relevant manual excerpts:\n${formatContext(chunks)}\n\nStudent question: ${last}`,
    },
  ];

  const reply = await generateText(augmented, TUTOR_CHAT, {
    maxTokens: 600,
    temperature: 0.4,
  });

  return NextResponse.json({ reply, citations: chunks.map((c) => c.section) });
}
