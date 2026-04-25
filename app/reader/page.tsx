"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

type Chunk = {
  id: string;
  text: string;
  section: string;
  page?: number;
};

type TocSection = {
  title: string;
  page: number;
};

type TocModule = {
  module: number | null;
  title: string;
  page: number;
  children: TocSection[];
};

type SpeechMark = {
  time: number;
  type: string;
  start: number;
  end: number;
  value: string;
};

const CLB_MIN = 1;
const CLB_MAX = 12;

const CLB_DESCRIPTIONS: Record<number, string> = {
  1: "Initial Basic — isolated words, heavy visual support needed.",
  2: "Developing Basic — short phrases, basic words, very slow pace.",
  3: "Adequate Basic — simple sentences, visual clues helpful.",
  4: "Fluent Basic — short sentences about everyday topics, basic grammar.",
  5: "Initial Intermediate — simple words, short sentences, analogies.",
  6: "Developing Intermediate — everyday words, all terms defined.",
  7: "Adequate Intermediate — short sentences, legal terms glossed.",
  8: "Fluent Intermediate — clear language, technical terms defined inline.",
  9: "Initial Advanced — shorter sentences, low-frequency idioms replaced.",
  10: "Developing Advanced — light simplification, all terminology kept.",
  11: "Adequate Advanced — minimal simplification, dense sentences reduced.",
  12: "Fluent Advanced — original manual text, no changes.",
};

export default function ReaderPage() {
  const [toc, setToc] = useState<TocModule[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [activePage, setActivePage] = useState<number | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>("");
  const [sectionChunks, setSectionChunks] = useState<Chunk[]>([]);

  const [useOriginal, setUseOriginal] = useState(true);
  const [clbLevel, setClbLevel] = useState<number>(8);
  const [densityTexts, setDensityTexts] = useState<Record<string, string>>({});
  const [rewriting, setRewriting] = useState(false);

  const [activeSentence, setActiveSentence] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const marksRef = useRef<SpeechMark[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/manual/toc").then((r) => r.json()),
      fetch("/api/manual").then((r) => r.json()),
    ]).then(([tocData, manualData]) => {
      setToc(tocData);
      setChunks(manualData.chunks ?? []);
      if (tocData.length > 0) {
        setActivePage(tocData[0].page);
        setActiveTitle(tocData[0].title);
        setExpandedModules(new Set([0]));
      }
    });
  }, []);

  // Build a flat list of all section pages for range calculation
  const allSectionPages = toc.flatMap((m) => [
    { title: m.title, page: m.page },
    ...m.children.map((c) => ({ title: c.title, page: c.page })),
  ]);

  // When activePage changes, find chunks in that page range
  useEffect(() => {
    if (activePage === null || chunks.length === 0) return;

    const idx = allSectionPages.findIndex(
      (s) => s.page === activePage && s.title === activeTitle
    );
    const nextPage =
      idx >= 0 && idx < allSectionPages.length - 1
        ? allSectionPages[idx + 1].page
        : 999;

    const matched = chunks.filter(
      (c) => c.page !== undefined && c.page >= activePage && c.page < nextPage
    );
    setSectionChunks(matched.length > 0 ? matched : chunks.filter((c) => c.page === activePage));
    setDensityTexts({});
    if (!useOriginal) setRewriting(true);
    contentRef.current?.scrollTo(0, 0);
  }, [activePage, activeTitle, chunks]);

  // Rewrite all section chunks at the selected CLB level (debounced)
  useEffect(() => {
    if (sectionChunks.length === 0) return;
    if (useOriginal) {
      const map: Record<string, string> = {};
      sectionChunks.forEach((c) => (map[c.id] = c.text));
      setDensityTexts(map);
      setRewriting(false);
      return;
    }
    setRewriting(true);
    setDensityTexts({});
    const timer = setTimeout(() => {
      Promise.all(
        sectionChunks.map((c) =>
          fetch("/api/density", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: c.text, clb: clbLevel }),
          })
            .then((r) => r.json())
            .then((d) => ({ id: c.id, text: d.text ?? c.text }))
            .catch(() => ({ id: c.id, text: c.text }))
        )
      ).then((results) => {
        const map: Record<string, string> = {};
        results.forEach((r) => (map[r.id] = r.text));
        setDensityTexts(map);
        setRewriting(false);
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [sectionChunks, useOriginal, clbLevel]);

  function toggleModule(idx: number) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectSection(title: string, page: number, moduleIdx: number) {
    setActivePage(page);
    setActiveTitle(title);
    setActiveSentence(null);
    audioRef.current?.pause();
    setExpandedModules((prev) => new Set(prev).add(moduleIdx));
  }

  // Find the current module for the active section
  const currentModule = toc.find(
    (m) =>
      m.title === activeTitle ||
      m.children.some((c) => c.title === activeTitle && c.page === activePage)
  );

  // Prev / Next section navigation
  const currentFlatIdx = allSectionPages.findIndex(
    (s) => s.page === activePage && s.title === activeTitle
  );
  const prevSection = currentFlatIdx > 0 ? allSectionPages[currentFlatIdx - 1] : null;
  const nextSection =
    currentFlatIdx >= 0 && currentFlatIdx < allSectionPages.length - 1
      ? allSectionPages[currentFlatIdx + 1]
      : null;

  function goToFlatSection(s: { title: string; page: number }) {
    const modIdx = toc.findIndex(
      (m) => m.title === s.title || m.children.some((c) => c.title === s.title)
    );
    selectSection(s.title, s.page, modIdx >= 0 ? modIdx : 0);
  }

  async function readAloud(text: string) {
    if (!text) return;
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, withMarks: true }),
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

  const isModuleTitle = toc.some((m) => m.title === activeTitle);

  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-20">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div>
          <div className="eyebrow mb-2">Manual Reference</div>
          <h1 className="font-display text-4xl md:text-5xl leading-tight">
            ABST Participant Manual
          </h1>
          <p className="mt-3 text-sm text-ink/70 max-w-lg">
            The full Alberta Basic Security Training manual — all 7 modules.
            Navigate by section, read at your CLB level, and listen aloud.
          </p>
        </div>
        <ClbSlider
          value={clbLevel}
          onChange={setClbLevel}
          useOriginal={useOriginal}
          onToggleOriginal={setUseOriginal}
        />
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Sidebar: TOC */}
        <aside className="lg:col-span-3 lg:sticky lg:top-6 self-start max-h-[80vh] overflow-y-auto border border-hair">
          <div className="eyebrow p-4 pb-2">Table of Contents</div>
          <nav>
            {toc.map((mod, mi) => (
              <div key={mi}>
                <button
                  onClick={() => {
                    toggleModule(mi);
                    selectSection(mod.title, mod.page, mi);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center justify-between gap-2 transition border-b border-hair/50 ${
                    activeTitle === mod.title
                      ? "bg-ink text-paper"
                      : "hover:bg-ink/5"
                  }`}
                >
                  <span className="leading-snug">
                    {mod.module !== null && (
                      <span className="font-mono text-[10px] opacity-60 mr-1.5">
                        M{mod.module}
                      </span>
                    )}
                    {mod.module !== null
                      ? mod.title.replace(/Module \w+:\s*/, "")
                      : mod.title}
                  </span>
                  {mod.children.length > 0 && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      className={`shrink-0 transition-transform ${
                        expandedModules.has(mi) ? "rotate-90" : ""
                      }`}
                      fill="currentColor"
                    >
                      <path d="M4 2l4 4-4 4" />
                    </svg>
                  )}
                </button>
                {expandedModules.has(mi) && mod.children.length > 0 && (
                  <ul className="bg-ink/[0.02]">
                    {mod.children.map((child, ci) => (
                      <li key={ci}>
                        <button
                          onClick={() => selectSection(child.title, child.page, mi)}
                          className={`w-full text-left text-sm py-2 pl-8 pr-4 transition flex items-baseline gap-2 ${
                            activeTitle === child.title && activePage === child.page
                              ? "bg-ink text-paper"
                              : "hover:bg-ink/5"
                          }`}
                        >
                          <span className="font-mono text-[10px] opacity-50 shrink-0">
                            p.{child.page}
                          </span>
                          <span className="leading-snug">{child.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Reading pane */}
        <article
          ref={contentRef}
          className="lg:col-span-9 border border-hair bg-paper overflow-y-auto"
        >
          {/* Section header */}
          <div className="sticky top-0 bg-paper/95 backdrop-blur-sm border-b border-hair px-8 md:px-10 py-4 z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                {currentModule && currentModule.title !== activeTitle && (
                  <div className="eyebrow mb-1">{currentModule.title}</div>
                )}
                <h2 className="font-display text-2xl md:text-3xl leading-tight">
                  {activeTitle || "—"}
                </h2>
                <div className="text-[10px] font-mono text-slate uppercase tracking-wider mt-1">
                  {activePage && `p.${activePage} · `}
                  {useOriginal
                    ? "Original manual text"
                    : `CLB ${clbLevel} · ${CLB_DESCRIPTIONS[clbLevel]}`}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 md:px-10 py-8">
            {rewriting ? (
              <div className="py-16 flex flex-col items-center gap-4">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 bg-ink/30 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2.5 h-2.5 bg-ink/30 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2.5 h-2.5 bg-ink/30 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                <div className="text-sm text-slate font-mono">
                  Rewriting {sectionChunks.length} chunk{sectionChunks.length !== 1 ? "s" : ""} at CLB {clbLevel}
                </div>
              </div>
            ) : sectionChunks.length === 0 ? (
              <div className="text-slate italic py-12 text-center">
                No content found for this section.
              </div>
            ) : (
              <div className="space-y-8">
                {sectionChunks.map((chunk) => {
                  const text = densityTexts[chunk.id];
                  if (!text) {
                    return (
                      <div key={chunk.id} className="space-y-3 animate-pulse">
                        <div className="h-4 bg-ink/10 rounded w-full" />
                        <div className="h-4 bg-ink/10 rounded w-5/6" />
                        <div className="h-4 bg-ink/10 rounded w-4/6" />
                        <div className="h-4 bg-ink/10 rounded w-full" />
                        <div className="h-4 bg-ink/10 rounded w-3/6" />
                      </div>
                    );
                  }
                  return (
                    <div key={chunk.id} className="group">
                      <div className="prose prose-sm md:prose-base max-w-none text-base md:text-lg leading-relaxed">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Prev / Next navigation */}
            <div className="flex items-center justify-between mt-12 pt-6 border-t border-hair">
              {prevSection ? (
                <button
                  onClick={() => goToFlatSection(prevSection)}
                  className="text-sm font-mono px-4 py-2 border border-hair hover:bg-ink hover:text-paper transition flex items-center gap-2"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M8 2L4 6l4 4" />
                  </svg>
                  {prevSection.title.length > 35
                    ? prevSection.title.substring(0, 32) + "…"
                    : prevSection.title}
                </button>
              ) : (
                <div />
              )}
              {nextSection ? (
                <button
                  onClick={() => goToFlatSection(nextSection)}
                  className="text-sm font-mono px-4 py-2 border border-hair hover:bg-ink hover:text-paper transition flex items-center gap-2"
                >
                  {nextSection.title.length > 35
                    ? nextSection.title.substring(0, 32) + "…"
                    : nextSection.title}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4 2l4 4-4 4" />
                  </svg>
                </button>
              ) : (
                <div />
              )}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function ClbSlider({
  value,
  onChange,
  useOriginal,
  onToggleOriginal,
}: {
  value: number;
  onChange: (level: number) => void;
  useOriginal: boolean;
  onToggleOriginal: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2 min-w-[220px]">
      <button
        onClick={() => onToggleOriginal(!useOriginal)}
        className={`px-3 py-2 text-sm font-mono border transition ${
          useOriginal
            ? "bg-ink text-paper border-ink"
            : "border-hair hover:bg-ink/5"
        }`}
      >
        Original (Manual)
      </button>
      <div className={useOriginal ? "opacity-30 pointer-events-none" : ""}>
        <div className="flex items-baseline justify-between mb-1">
          <span className="eyebrow text-[10px]">CLB Level</span>
          <span className="font-mono text-sm font-medium">{value}</span>
        </div>
        <input
          type="range"
          min={CLB_MIN}
          max={CLB_MAX}
          step={1}
          value={value}
          onChange={(e) => {
            onToggleOriginal(false);
            onChange(Number(e.target.value));
          }}
          className="w-full accent-ink cursor-pointer"
        />
        <div className="flex justify-between text-[10px] font-mono text-slate">
          <span>CLB {CLB_MIN}</span>
          <span>CLB {CLB_MAX}</span>
        </div>
      </div>
    </div>
  );
}
