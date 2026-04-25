// app/api/density/route.ts
//
// Rewrites a manual excerpt at one of three reading levels:
//   original | simple (B1 English) | eli12 (explain-like-I'm-12)
//
// Used by the bilingual reader to make ESL-friendly versions on demand.
// Owner: Role C.

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/bedrock";
import { DENSITY_REWRITE } from "@/lib/prompts";

type Level = "original" | "simple" | "eli12";

export async function POST(req: NextRequest) {
  const { text, level } = (await req.json()) as { text: string; level: Level };

  if (level === "original") {
    return NextResponse.json({ text });
  }

  const userMessage = `Excerpt:\n${text}\n\nlevel=${level}`;

  const out = await generateText(
    [{ role: "user", content: userMessage }],
    DENSITY_REWRITE,
    { maxTokens: 600, temperature: 0.4 }
  );

  return NextResponse.json({ text: out });
}
