// lib/translate.ts
//
// Amazon Translate wrapper. Supports the demo languages we'll likely show
// in the pitch (Spanish, Tagalog, Punjabi, Mandarin, Arabic, French).

import { TranslateTextCommand } from "@aws-sdk/client-translate";
import { translateClient, isDemoMode } from "./aws";

export type LanguageCode =
  | "es"   // Spanish
  | "tl"   // Tagalog (Filipino)
  | "pa"   // Punjabi
  | "zh"   // Mandarin Chinese
  | "ar"   // Arabic
  | "fr"   // French
  | "en";

export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "tl", label: "Tagalog", native: "Tagalog" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "zh", label: "Mandarin", native: "中文" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "fr", label: "French", native: "Français" },
];

export async function translateText(
  text: string,
  targetLanguage: LanguageCode,
  sourceLanguage: LanguageCode = "en"
): Promise<string> {
  if (targetLanguage === sourceLanguage) return text;
  if (isDemoMode()) return demoTranslate(text, targetLanguage);

  const cmd = new TranslateTextCommand({
    Text: text,
    SourceLanguageCode: sourceLanguage,
    TargetLanguageCode: targetLanguage,
  });
  const res = await translateClient().send(cmd);
  return res.TranslatedText ?? text;
}

function demoTranslate(text: string, lang: LanguageCode): string {
  // Hand-written canned snippets for the 5 fallback chunks so the demo looks
  // real even without AWS access. For everything else we prefix the text so
  // it's obvious this is a stub.
  const stubs: Record<LanguageCode, string> = {
    en: text,
    es: `[ES] ${text}`,
    tl: `[TL] ${text}`,
    pa: `[PA] ${text}`,
    zh: `[ZH] ${text}`,
    ar: `[AR] ${text}`,
    fr: `[FR] ${text}`,
  };

  // Curated translations for common demo phrases.
  if (text.startsWith("A security guard's primary role")) {
    const map: Partial<Record<LanguageCode, string>> = {
      es: "La función principal de un guardia de seguridad es observar, disuadir, documentar e informar. Los guardias de seguridad no tienen poderes policiales y actúan como ciudadanos privados con los mismos derechos y responsabilidades bajo la ley.",
      fr: "Le rôle principal d'un agent de sécurité est d'observer, dissuader, documenter et signaler. Les agents de sécurité n'ont pas de pouvoirs de police et agissent en tant que citoyens privés avec les mêmes droits et responsabilités en vertu de la loi.",
    };
    if (map[lang]) return map[lang]!;
  }

  return stubs[lang];
}
