"use client";

import { useState, useEffect, useRef } from "react";

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

const DENSITY_DESCRIPTIONS: Record<Density, string> = {
  original: "Manual text as written.",
  simple: "Same content, B1 English. Short sentences, common words. Legal terms preserved.",
  eli12: "Plain explanation with analogies. Use this to build intuition, then come back to the manual.",
};

export default function ReaderPage() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [density, setDensity] = useState<Density>("original");
  const [densityText, setDensityText] = useState<string>("");
  const [rewriting, setRewriting] = useState(false);
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

  // Re-render at the requested density whenever the active chunk or density changes.
  useEffect(() => {
    if (!active) return;
    if (density === "original") {
      setDensityText(active.text);
      return;
    }
    setRewriting(true);
    fetch("/api/density", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: active.text, level: density }),
    })
      .then((r) => r.json())
      .then((d) => setDensityText(d.text ?? active.text))
      .finally(() => setRewriting(false));
  }, [active, density]);

  async function readAloud() {
    if (!active || !densityText) return;
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

  // Split densityText into sentences for the highlight overlay.
  const sentences = splitSentences(densityText);

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-20">
      {/* Header controls */}
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div>
          <div className="eyebrow mb-2">Pillar III · Manual Reader</div>
          <h1 className="font-display text-4xl md:text-5xl leading-tight">
            The same content,
            <br />
            <span className="text-slate text-3xl md:text-4xl italic">
              at the level you need.
            </span>
          </h1>
          <p className="mt-3 text-sm text-ink/70 max-w-md">
            The provincial exam is in English, so the manual is in English. But
            you can read it at three different reading levels — and have it
            read aloud while sentences highlight.
          </p>
        </div>

        <DensitySlider value={density} onChange={setDensity} />
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
                    i === activeIdx ? "bg-ink text-paper" : "hover:bg-ink/5"
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

        {/* Reading pane */}
        <article className="lg:col-span-9 border border-hair p-8 md:p-10 bg-paper">
          <div className="flex items-start justify-between mb-4 gap-4">
            <div>
              <h2 className="font-display text-3xl leading-tight mb-1">
                {active?.section ?? "—"}
              </h2>
              <div className="text-[10px] font-mono text-slate uppercase tracking-wider">
                Reading level: {density} · {DENSITY_DESCRIPTIONS[density]}
              </div>
            </div>
            <button
              onClick={readAloud}
              disabled={rewriting || !densityText}
              className="text-xs font-mono px-3 py-2 border border-ink hover:bg-ink hover:text-paper transition flex items-center gap-1.5 shrink-0 disabled:opacity-40"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
              </svg>
              Read aloud
            </button>
          </div>

          <div className="text-base md:text-lg leading-relaxed mt-6 max-w-3xl">
            {rewriting ? (
              <span className="text-slate italic">Rewriting at {density} level…</span>
            ) : (
              sentences.map((s, i) => (
                <span
                  key={i}
                  className={i === activeSentence ? "tts-active" : ""}
                >
                  {s}{" "}
                </span>
              ))
            )}
          </div>
        </article>
      </div>
    </div>
  );
}

function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+|\S+$/g) ?? [text];
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
