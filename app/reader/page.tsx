"use client";

import { useState, useEffect, useRef } from "react";
import { SUPPORTED_LANGUAGES, LanguageCode } from "@/lib/translate";

type Chunk = {
  id: string;
  text: string;
  section: string;
  page?: number;
};

type SpeechMark = {
  time: number;
  type: string;
  start: number;
  end: number;
  value: string;
};

type Density = "original" | "simple" | "eli12";

export default function ReaderPage() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [language, setLanguage] = useState<LanguageCode>("es");
  const [density, setDensity] = useState<Density>("original");
  const [translated, setTranslated] = useState<string>("");
  const [densityText, setDensityText] = useState<string>("");
  const [translating, setTranslating] = useState(false);
  const [activeSentence, setActiveSentence] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const marksRef = useRef<SpeechMark[]>([]);

  // Load the chunked manual on mount.
  useEffect(() => {
    fetch("/api/manual")
      .then((r) => r.json())
      .then((d) => setChunks(d.chunks ?? []));
  }, []);

  const active = chunks[activeIdx];

  // Re-translate / re-densify whenever the active chunk, language, or density changes.
  useEffect(() => {
    if (!active) return;
    setTranslating(true);
    Promise.all([
      fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: active.text, targetLanguage: language }),
      }).then((r) => r.json()),
      density === "original"
        ? Promise.resolve({ text: active.text })
        : fetch("/api/density", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: active.text, level: density }),
          }).then((r) => r.json()),
    ])
      .then(([tr, dn]) => {
        setTranslated(tr.text ?? "");
        setDensityText(dn.text ?? active.text);
      })
      .finally(() => setTranslating(false));
  }, [active, language, density]);

  async function readAloud() {
    if (!active) return;
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: densityText, withMarks: true }),
    });
    const data = await res.json();
    marksRef.current = data.marks ?? [];

    const audio = new Audio(`data:${data.contentType};base64,${data.audioBase64}`);
    audioRef.current?.pause();
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      const t = audio.currentTime * 1000;
      const idx = marksRef.current.findIndex(
        (m, i) => m.time <= t && (marksRef.current[i + 1]?.time ?? Infinity) > t
      );
      setActiveSentence(idx >= 0 ? idx : null);
    };
    audio.onended = () => setActiveSentence(null);
    await audio.play().catch(() => {});
  }

  // Split the densityText into sentences for highlight overlay.
  const sentences = splitSentences(densityText);

  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-20">
      {/* Header controls */}
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div>
          <div className="eyebrow mb-2">Pillar III · Bilingual Manual</div>
          <h1 className="font-display text-4xl md:text-5xl leading-tight">
            Read in two languages.
            <br />
            <span className="text-slate text-2xl md:text-3xl italic">
              Tested in one.
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Select
            label="Language"
            value={language}
            onChange={(v) => setLanguage(v as LanguageCode)}
            options={SUPPORTED_LANGUAGES.filter((l) => l.code !== "en").map((l) => ({
              value: l.code,
              label: `${l.label} · ${l.native}`,
            }))}
          />
          <DensitySlider value={density} onChange={setDensity} />
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Sidebar: section navigator */}
        <aside className="lg:col-span-3 lg:sticky lg:top-6 self-start max-h-[80vh] overflow-y-auto border border-hair p-4">
          <div className="eyebrow mb-3">Sections</div>
          <ul className="space-y-1">
            {chunks.map((c, i) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setActiveIdx(i);
                    setActiveSentence(null);
                  }}
                  className={`w-full text-left text-sm py-2 px-2 transition ${
                    i === activeIdx
                      ? "bg-ink text-paper"
                      : "hover:bg-ink/5"
                  }`}
                >
                  <div className="font-medium truncate">{c.section}</div>
                  {c.page && (
                    <div className="text-[10px] font-mono opacity-60">
                      p.{c.page}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Side-by-side reading panes */}
        <div className="lg:col-span-9 grid md:grid-cols-2 gap-6">
          {/* English (always left — they have to learn the English terms) */}
          <article className="border border-hair p-6 bg-paper">
            <div className="flex items-center justify-between mb-3">
              <div className="eyebrow">English</div>
              <button
                onClick={readAloud}
                className="text-xs font-mono px-3 py-1.5 border border-ink hover:bg-ink hover:text-paper transition flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
                </svg>
                Read aloud
              </button>
            </div>
            <h2 className="font-display text-xl mb-3">
              {active?.section ?? "—"}
            </h2>
            <div className="text-base leading-relaxed">
              {sentences.map((s, i) => (
                <span
                  key={i}
                  className={i === activeSentence ? "tts-active" : ""}
                >
                  {s}{" "}
                </span>
              ))}
            </div>
            <div className="mt-4 text-[10px] font-mono text-slate uppercase tracking-wider">
              Reading level: {density}
            </div>
          </article>

          {/* Translated */}
          <article className="border border-hair p-6 bg-paper">
            <div className="eyebrow mb-3">
              {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.native ?? language}
            </div>
            <h2 className="font-display text-xl mb-3">
              {active?.section ?? "—"}
            </h2>
            <div
              className={`text-base leading-relaxed ${
                language === "ar" ? "text-right" : ""
              }`}
              dir={language === "ar" ? "rtl" : "ltr"}
            >
              {translating ? (
                <span className="text-slate italic">Translating…</span>
              ) : (
                translated
              )}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+|\S+$/g) ?? [text];
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow text-[10px]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-hair bg-paper px-3 py-2 text-sm font-mono outline-none focus:border-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DensitySlider({
  value,
  onChange,
}: {
  value: Density;
  onChange: (d: Density) => void;
}) {
  const levels: { id: Density; label: string }[] = [
    { id: "original", label: "Manual" },
    { id: "simple", label: "Simple" },
    { id: "eli12", label: "Like I'm 12" },
  ];
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow text-[10px]">Reading level</span>
      <div className="inline-flex border border-hair">
        {levels.map((l) => (
          <button
            key={l.id}
            onClick={() => onChange(l.id)}
            className={`px-3 py-2 text-sm font-mono transition ${
              value === l.id ? "bg-ink text-paper" : "hover:bg-ink/5"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
