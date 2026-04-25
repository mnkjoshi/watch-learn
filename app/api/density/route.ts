// app/api/density/route.ts
//
// Rewrites a manual excerpt at a CLB level (5-12).
// CLB 12 returns unchanged text; lower levels simplify progressively.
//
// Used by the bilingual reader to make ESL-friendly versions on demand.

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/bedrock";
import { CLB_REWRITE } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  const { text, clb } = (await req.json()) as { text: string; clb: number };

  if (clb >= 12) {
    return NextResponse.json({ text });
  }

  const userMessage = `Excerpt:\n${text}\n\nclb=${clb}`;

  const out = await generateText(
    [{ role: "user", content: userMessage }],
    CLB_REWRITE,
    { maxTokens: 600, temperature: 0.4 }
  );

  return NextResponse.json({ text: out });
}
