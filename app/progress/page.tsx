"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadSession,
  computeWeakAreas,
  computeConfidence,
  SessionState,
  WeakArea,
} from "@/lib/session";

export default function ProgressPage() {
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  if (!session) {
    return <div className="max-w-4xl mx-auto px-6 pt-20 text-slate">Loading…</div>;
  }

  const confidence = computeConfidence(session);
  const weakAreas = computeWeakAreas(session);
  const ready = confidence >= 80;
  const totalQuestions = session.quizAttempts.length;
  const correctQuestions = session.quizAttempts.filter((a) => a.correct).length;
  const totalScenarios = session.scenarioRuns.length;
  const avgScenario = totalScenarios > 0
    ? Math.round(session.scenarioRuns.reduce((s, r) => s + r.score, 0) / totalScenarios)
    : 0;
  const passingScenarios = session.scenarioRuns.filter((r) => r.score >= 80).length;

  return (
    <div className="max-w-5xl mx-auto px-6 pt-10 pb-20">
      <div className="eyebrow mb-3">Pillar IV · Progress</div>
      <h1 className="font-display text-4xl md:text-5xl leading-tight mb-10">
        Are you ready for the exam?
      </h1>

      {/* Confidence ring ----------------------------------------------- */}
      <section className="border border-hair p-8 md:p-12 mb-12 bg-paper">
        <div className="grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-5">
            <ConfidenceRing value={confidence} />
          </div>
          <div className="md:col-span-7">
            <div className="eyebrow mb-2">Confidence score</div>
            <div className={`font-display text-3xl md:text-4xl leading-tight mb-3 ${
              ready ? "text-gold" : "text-accent"
            }`}>
              {ready
                ? "You're tracking above the 80% bar."
                : confidence === 0
                  ? "Take a quiz or run a scenario to begin."
                  : `Below the 80% bar. ${80 - confidence} points to go.`}
            </div>
            <p className="text-ink/80 leading-relaxed">
              {ready
                ? "If you performed like this on the provincial exam, you'd pass. Keep practicing scenarios — exam-day pressure adds friction we can't fully simulate."
                : "Confidence blends quiz accuracy and scenario performance. Both count on the real exam."}
            </p>
          </div>
        </div>
      </section>

      {/* Stats ---------------------------------------------------------- */}
      <section className="grid md:grid-cols-3 gap-px bg-ink/10 border border-hair mb-12">
        <Stat
          label="Quiz accuracy"
          value={totalQuestions > 0 ? `${Math.round((correctQuestions / totalQuestions) * 100)}%` : "—"}
          sub={totalQuestions > 0 ? `${correctQuestions} of ${totalQuestions} questions` : "No attempts yet"}
        />
        <Stat
          label="Scenario average"
          value={totalScenarios > 0 ? `${avgScenario}` : "—"}
          sub={totalScenarios > 0 ? `Across ${totalScenarios} scenario${totalScenarios === 1 ? "" : "s"}` : "No runs yet"}
        />
        <Stat
          label="Scenarios passed"
          value={totalScenarios > 0 ? `${passingScenarios}/${totalScenarios}` : "—"}
          sub={totalScenarios > 0 ? "At or above the 80% bar" : "No runs yet"}
        />
      </section>

      {/* Weak areas ----------------------------------------------------- */}
      <section className="mb-12">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-2xl md:text-3xl">Weak areas</h2>
          <span className="eyebrow">Where the next quiz pulls from</span>
        </div>
        {weakAreas.length === 0 && (
          <p className="text-slate italic border border-hair p-6 bg-paper">
            No quiz history yet. Start a quiz and we'll surface your weak areas here.
          </p>
        )}
        {weakAreas.length > 0 && (
          <div className="space-y-2">
            {weakAreas.map((w) => (
              <WeakAreaRow key={w.section} area={w} />
            ))}
          </div>
        )}
      </section>

      {/* Recent scenarios ---------------------------------------------- */}
      {session.scenarioRuns.length > 0 && (
        <section className="mb-12">
          <h2 className="font-display text-2xl md:text-3xl mb-5">Recent scenarios</h2>
          <div className="border border-hair">
            {[...session.scenarioRuns].reverse().slice(0, 8).map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-4 ${
                  i > 0 ? "border-t border-hair" : ""
                }`}
              >
                <div>
                  <div className="font-display text-lg capitalize">
                    {r.scenarioType.replace(/_/g, " ")}
                  </div>
                  <div className="text-xs text-slate">
                    {new Date(r.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className={`font-display text-2xl ${r.score >= 80 ? "text-gold" : "text-accent"}`}>
                  {r.score}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA ------------------------------------------------------------ */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/scenario"
          className="bg-ink text-paper px-6 py-3 hover:bg-accent transition"
        >
          Run another scenario →
        </Link>
        <Link
          href="/quiz"
          className="border border-ink px-6 py-3 hover:bg-ink hover:text-paper transition"
        >
          Practice your weak areas →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-paper p-6">
      <div className="eyebrow mb-2">{label}</div>
      <div className="font-display text-4xl leading-none mb-2">{value}</div>
      <div className="text-xs text-slate">{sub}</div>
    </div>
  );
}

function WeakAreaRow({ area }: { area: WeakArea }) {
  const wrongPct = (area.wrongCount / area.totalCount) * 100;
  return (
    <div className="border border-hair p-4 bg-paper">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">{area.section}</div>
        <div className="text-xs font-mono text-slate">
          {area.totalCount - area.wrongCount}/{area.totalCount} correct
        </div>
      </div>
      <div className="h-1.5 bg-ink/10 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-accent"
          style={{ width: `${wrongPct}%` }}
        />
      </div>
    </div>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const size = 220;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;
  const passed = value >= 80;

  return (
    <div className="relative w-fit mx-auto">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(14,17,22,0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={passed ? "var(--color-gold)" : "var(--color-accent)"}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 800ms ease" }}
        />
        {/* 80% threshold tick */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(14,17,22,0.6)"
          strokeWidth={2}
          strokeDasharray={`2 ${circumference - 2}`}
          strokeDashoffset={-circumference * 0.8}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-6xl leading-none">{value}</div>
        <div className="eyebrow mt-2">/ 100</div>
      </div>
    </div>
  );
}