"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { VIDEO_SCENARIOS, type VideoScenario } from "@/data/videos";
import { recordReportAttempt } from "@/lib/session";

// ---------- Types for the grading API response ----------

type GrammarCorrection = {
  original: string;
  corrected: string;
  explanation: string;
};

type GradeResult = {
  overallScore: number;
  grammarScore: number;
  contentScore: number;
  grammarCorrections: GrammarCorrection[];
  detailsIdentified: string[];
  detailsMissed: string[];
  structureFeedback: string;
  languageFeedback: string;
  correctedReport: string;
  modelReport: string;
  encouragement: string;
};

type Phase = "picker" | "watching" | "writing" | "grading" | "results";

export default function ReportPage() {
  const [phase, setPhase] = useState<Phase>("picker");
  const [video, setVideo] = useState<VideoScenario | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [report, setReport] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [writingStartTime, setWritingStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Phase transitions ---

  function pickVideo(v: VideoScenario) {
    setVideo(v);
    setVideoEnded(false);
    setReport("");
    setResult(null);
    setPhase("watching");
  }

  function startWriting() {
    setPhase("writing");
    const now = Date.now();
    setWritingStartTime(now);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - now) / 1000));
    }, 1000);
  }

  async function submitReport() {
    if (!video || !report.trim()) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("grading");

    try {
      const res = await fetch("/api/report/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.id,
          studentReport: report.trim(),
        }),
      });
      const data: GradeResult = await res.json();
      setResult(data);
      recordReportAttempt({
        videoId: video.id,
        overallScore: data.overallScore,
        grammarScore: data.grammarScore,
        contentScore: data.contentScore,
        timestamp: Date.now(),
      });
      setPhase("results");
    } catch {
      setPhase("writing");
    }
  }

  function reset() {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("picker");
    setVideo(null);
    setVideoEnded(false);
    setReport("");
    setResult(null);
    setWritingStartTime(null);
    setElapsed(0);
  }

  // --- Helpers ---

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function difficultyColor(d: VideoScenario["difficulty"]) {
    switch (d) {
      case "beginner":
        return "bg-gold/20 text-gold";
      case "intermediate":
        return "bg-slate/20 text-slate";
      case "advanced":
        return "bg-accent/20 text-accent";
    }
  }

  // ====================== RENDER ======================

  // ---- PICKER ----
  if (phase === "picker") {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-20">
        <div className="eyebrow mb-3">Pillar V · Incident Report Writing</div>
        <h1 className="font-display text-5xl md:text-6xl leading-[0.95] mb-3">
          Watch &amp; Report
        </h1>
        <p className="text-lg text-ink/75 max-w-2xl mb-12">
          Watch a video once, then write an incident report from memory.
          You'll be graded on grammar, detail accuracy, and professional
          language — just like a real security shift.
        </p>

        <div className="grid md:grid-cols-3 gap-px bg-ink/10 border border-hair">
          {VIDEO_SCENARIOS.map((v, i) => (
            <button
              key={v.id}
              onClick={() => pickVideo(v)}
              className={`rise rise-${(i % 5) + 1} text-left bg-paper p-6 hover:bg-ink hover:text-paper transition-colors duration-300 group`}
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${difficultyColor(v.difficulty)}`}
                >
                  {v.difficulty}
                </span>
                <span className="text-xs font-mono text-slate group-hover:text-paper/60">
                  {v.durationSec}s
                </span>
              </div>
              <h3 className="font-display text-2xl leading-tight mb-2">
                {v.title}
              </h3>
              <p className="text-sm text-ink/70 group-hover:text-paper/75 line-clamp-2">
                {v.briefing}
              </p>
              <div className="mt-3 text-xs font-mono text-slate group-hover:text-paper/50">
                § {v.manualSection}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- WATCHING ----
  if (phase === "watching" && video) {
    return (
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="eyebrow mb-2">Step 1 · Watch the Video</div>
            <h1 className="font-display text-3xl md:text-4xl leading-tight">
              {video.title}
            </h1>
            <p className="text-sm text-slate mt-1">§ {video.manualSection}</p>
          </div>
          <button
            onClick={reset}
            className="text-sm border border-ink px-4 py-2 hover:bg-ink hover:text-paper transition"
          >
            ← Back
          </button>
        </div>

        {/* Briefing */}
        <div className="border border-hair bg-paper p-6 mb-6">
          <div className="eyebrow mb-2">Briefing</div>
          <p className="text-base leading-relaxed">{video.briefing}</p>
        </div>

        {/* Video player */}
        <div className="border border-hair bg-ink overflow-hidden mb-6">
          <video
            key={video.videoUrl}
            ref={videoRef}
            className="w-full aspect-video"
            controls
            controlsList="nodownload"
            playsInline
            onEnded={() => setVideoEnded(true)}
          >
            <source src={video.videoUrl} type="video/webm" />
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Instruction / proceed button */}
        {!videoEnded ? (
          <div className="border border-gold/40 bg-gold/10 p-5 flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-gold animate-pulse shrink-0" />
            <div>
              <div className="text-sm font-medium">
                Watch the entire video carefully
              </div>
              <div className="text-xs text-slate mt-0.5">
                Pay attention to people, actions, locations, lighting, and
                anything unusual. You will need to write a report from memory.
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={startWriting}
            className="w-full bg-ink text-paper px-6 py-4 text-lg font-display hover:bg-accent transition"
          >
            Write your incident report →
          </button>
        )}
      </div>
    );
  }

  // ---- WRITING ----
  if (phase === "writing" && video) {
    return (
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="eyebrow mb-2">Step 2 · Write Your Report</div>
            <h1 className="font-display text-3xl md:text-4xl leading-tight">
              {video.title}
            </h1>
          </div>
          <div className="text-right">
            <div className="eyebrow">Time</div>
            <div className="font-display text-2xl tabular-nums">
              {formatTime(elapsed)}
            </div>
          </div>
        </div>

        <div className="border border-hair bg-paper p-6 mb-6">
          <div className="eyebrow mb-2 text-gold">Instructions</div>
          <p className="text-sm leading-relaxed text-ink/80">
            Write an incident report describing what you observed in the video.
            Include: <strong>when</strong> (time of day / lighting),{" "}
            <strong>where</strong> (location / setting),{" "}
            <strong>who</strong> (people, descriptions),{" "}
            <strong>what</strong> (actions, events), and any{" "}
            <strong>notable details</strong>. Use professional, clear language.
          </p>
        </div>

        <textarea
          value={report}
          onChange={(e) => setReport(e.target.value)}
          rows={12}
          placeholder="At approximately [time], I observed..."
          className="w-full border border-hair p-6 mb-4 outline-none focus:border-ink bg-paper text-base leading-relaxed resize-y"
          autoFocus
        />

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate">
            {report.trim().split(/\s+/).filter(Boolean).length} words
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="border border-ink px-4 py-2 text-sm hover:bg-ink hover:text-paper transition"
            >
              Cancel
            </button>
            <button
              onClick={submitReport}
              disabled={report.trim().length < 20}
              className="bg-ink text-paper px-6 py-3 disabled:opacity-30 hover:bg-accent transition"
            >
              Submit report →
            </button>
          </div>
        </div>

        <p className="text-xs text-slate mt-3">
          Tip: a professional incident report states facts clearly and
          chronologically. Avoid opinions — write what you <em>saw</em>, not
          what you <em>think</em> happened.
        </p>
      </div>
    );
  }

  // ---- GRADING (loading) ----
  if (phase === "grading") {
    return (
      <div className="max-w-3xl mx-auto px-6 pt-32 text-center">
        <div className="eyebrow mb-3">Grading</div>
        <h2 className="font-display text-4xl mb-4">
          Reviewing your report…
        </h2>
        <p className="text-slate">
          Checking grammar, identifying details, and comparing against the
          ideal incident report.
        </p>
        <div className="mt-8 inline-block w-12 h-12 border-2 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ---- RESULTS ----
  if (phase === "results" && result && video) {
    return <ResultsView video={video} result={result} onReset={reset} />;
  }

  return null;
}

// ====================== RESULTS SUB-VIEW ======================

function ResultsView({
  video,
  result,
  onReset,
}: {
  video: VideoScenario;
  result: GradeResult;
  onReset: () => void;
}) {
  const passed = result.overallScore >= 80;

  return (
    <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
      <div className="eyebrow mb-3">
        Report Grading — {video.title}
      </div>
      <h1 className="font-display text-4xl md:text-5xl leading-tight mb-2">
        Your incident report results
      </h1>
      <p className="text-sm text-slate mb-10">§ {video.manualSection}</p>

      {/* ---- Score banner ---- */}
      <div
        className={`border ${passed ? "border-gold" : "border-accent"} p-8 mb-10`}
      >
        <div className="grid md:grid-cols-3 gap-6 items-center">
          {/* Overall */}
          <div>
            <div className="eyebrow mb-1">Overall score</div>
            <div className="font-display text-7xl leading-none">
              {result.overallScore}
              <span className="text-3xl text-slate">/100</span>
            </div>
            <div
              className={`mt-2 text-sm font-medium ${passed ? "text-gold" : "text-accent"}`}
            >
              {passed ? "Exam-ready" : "Below the 80% bar"}
            </div>
          </div>
          {/* Grammar */}
          <div className="border-l border-hair pl-6">
            <div className="eyebrow mb-1">Grammar &amp; Language</div>
            <div className="font-display text-4xl leading-none">
              {result.grammarScore}
              <span className="text-xl text-slate">/100</span>
            </div>
            <div className="text-xs text-slate mt-1">40% of total</div>
          </div>
          {/* Content */}
          <div className="border-l border-hair pl-6">
            <div className="eyebrow mb-1">Content &amp; Detail</div>
            <div className="font-display text-4xl leading-none">
              {result.contentScore}
              <span className="text-xl text-slate">/100</span>
            </div>
            <div className="text-xs text-slate mt-1">60% of total</div>
          </div>
        </div>
      </div>

      {/* ---- Encouragement ---- */}
      <div className="border border-gold/40 bg-gold/10 p-6 mb-10">
        <p className="font-display text-xl italic leading-snug">
          &ldquo;{result.encouragement}&rdquo;
        </p>
      </div>

      {/* ---- Grammar Corrections ---- */}
      {result.grammarCorrections.length > 0 && (
        <div className="mb-10">
          <div className="eyebrow mb-4 text-accent">
            Grammar corrections ({result.grammarCorrections.length})
          </div>
          <div className="space-y-3">
            {result.grammarCorrections.map((gc, i) => (
              <div key={i} className="border border-hair bg-paper p-5">
                <div className="grid md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-accent mb-1">
                      Your text
                    </div>
                    <div className="text-base line-through text-ink/60">
                      {gc.original}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-gold mb-1">
                      Corrected
                    </div>
                    <div className="text-base font-medium">{gc.corrected}</div>
                  </div>
                </div>
                <div className="text-sm text-ink/75 border-t border-hair pt-3">
                  💡 {gc.explanation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Details Identified vs Missed ---- */}
      <div className="grid md:grid-cols-2 gap-8 mb-10">
        <div>
          <div className="eyebrow mb-3 text-gold">
            Details you identified ({result.detailsIdentified.length})
          </div>
          {result.detailsIdentified.length > 0 ? (
            <ul className="space-y-2">
              {result.detailsIdentified.map((d, i) => (
                <li
                  key={i}
                  className="border-l-2 border-gold pl-4 text-sm text-ink/90"
                >
                  {d}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate italic">None identified</p>
          )}
        </div>
        <div>
          <div className="eyebrow mb-3 text-accent">
            Details you missed ({result.detailsMissed.length})
          </div>
          {result.detailsMissed.length > 0 ? (
            <ul className="space-y-2">
              {result.detailsMissed.map((d, i) => (
                <li
                  key={i}
                  className="border-l-2 border-accent pl-4 text-sm text-ink/90"
                >
                  {d}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate italic">
              You caught everything!
            </p>
          )}
        </div>
      </div>

      {/* ---- Structure & Language Feedback ---- */}
      <div className="grid md:grid-cols-2 gap-8 mb-10">
        <div className="border border-hair p-5 bg-paper">
          <div className="eyebrow mb-2">Report Structure</div>
          <p className="text-sm leading-relaxed">{result.structureFeedback}</p>
        </div>
        <div className="border border-hair p-5 bg-paper">
          <div className="eyebrow mb-2">Professional Language</div>
          <p className="text-sm leading-relaxed">{result.languageFeedback}</p>
        </div>
      </div>

      {/* ---- Corrected Report ---- */}
      <div className="border border-hair p-6 mb-6 bg-paper">
        <div className="eyebrow mb-3">
          Your report — corrected
        </div>
        <p className="text-base leading-relaxed whitespace-pre-wrap">
          {result.correctedReport}
        </p>
      </div>

      {/* ---- Model Report ---- */}
      <div className="border border-gold/40 bg-gold/5 p-6 mb-10">
        <div className="eyebrow mb-3">
          Ideal incident report (for comparison)
        </div>
        <p className="text-base leading-relaxed italic whitespace-pre-wrap">
          {result.modelReport}
        </p>
      </div>

      {/* ---- Actions ---- */}
      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="bg-ink text-paper px-6 py-3 hover:bg-accent transition"
        >
          Try another video →
        </button>
        <Link
          href="/scenario"
          className="border border-ink px-6 py-3 hover:bg-ink hover:text-paper transition"
        >
          Practice a scenario instead →
        </Link>
      </div>
    </div>
  );
}
