// app/api/translate/route.ts
//
// Thin wrapper around Amazon Translate. See lib/translate.ts for the
// supported language list.
//
// Owner: Role C.

import { NextRequest, NextResponse } from "next/server";
import { translateText, LanguageCode } from "@/lib/translate";

export async function POST(req: NextRequest) {
  const { text, targetLanguage, sourceLanguage } = (await req.json()) as {
    text: string;
    targetLanguage: LanguageCode;
    sourceLanguage?: LanguageCode;
  };
  const out = await translateText(text, targetLanguage, sourceLanguage ?? "en");
  return NextResponse.json({ text: out });
}
