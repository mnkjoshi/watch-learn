"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  loadSession,
  computeWeakAreas,
  recordQuizAttempt,
} from "@/lib/session";

type Question = {
  id: string;
  type: "multiple_choice" | "short_answer";
  stem: string;
  options?: string[];
  correctIndex?: number;
  modelAnswer?: string;
  manualSection: string;
};

type GradeResult = {
  correct: boolean;
  diagnosis: "concept_gap" | "vocabulary_gap" | "exam_technique" | "correct";
  explanation: string;
  vocabularyTerm: string | null;
  manualSection: string;
};

export default function QuizPage() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [shortAnswer, setShortAnswer] = useState("");
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [streak, setStreak] = useState({ correct: 0, total: 0 });

  async function nextQuestion() {
    setLoading(true);
    setGrade(null);
    setSelected(null);
    setShortAnswer("");

    const weakAreas = computeWeakAreas(loadSession())
      .slice(0, 3)
      .map((w) => w.section);

    const res = await fetch("/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weakAreas }),
    });
    const data = await res.json();
    const q = data.questions?.[0];
    setQuestion(q);
    setLoading(false);
  }

  useEffect(() => {
    nextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (!question) return;
    let userAnswer: string;
    if (question.type === "multiple_choice") {
      if (selected === null) return;
      userAnswer = question.options?.[selected] ?? "";
    } else {
      if (!shortAnswer.trim()) return;
      userAnswer = shortAnswer.trim();
    }

    const res = await fetch("/api/quiz/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, userAnswer }),
    });
    const result: GradeResult = await res.json();
    setGrade(result);
    setStreak((s) => ({
      correct: s.correct + (result.correct ? 1 : 0),
      total: s.total + 1,
    }));
    recordQuizAttempt({
      questionId: question.id,
      section: question.manualSection,
      correct: result.correct,
      diagnosis: result.diagnosis,
      timestamp: Date.now(),
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-6 pt-10 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <div className="eyebrow mb-2">Pillar II · Adaptive Quiz</div>
          <h1 className="font-display text-4xl md:text-5xl leading-tight">
            Practice the exam.
          </h1>
        </div>
        <div className="text-right">
          <div className="eyebrow">Session</div>
          <div className="font-display text-2xl">
            {streak.correct}/{streak.total}
          </div>
          {streak.total > 0 && (
            <div className="text-xs text-slate">
              {Math.round((streak.correct / streak.total) * 100)}% so far
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center text-slate py-20">
          Pulling a question from your weak areas…
        </div>
      )}

      {!loading && question && !grade && (
        <div className="border border-hair p-6 md:p-8 bg-paper">
          <div className="text-xs font-mono text-slate mb-3">
            § {question.manualSection}
          </div>
          <h2 className="font-display text-2xl leading-snug mb-6">
            {question.stem}
          </h2>

          {question.type === "multiple_choice" && question.options && (
            <div className="space-y-2 mb-6">
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`w-full text-left p-4 border transition ${
                    selected === i
                      ? "border-ink bg-ink text-paper"
                      : "border-hair hover:border-ink"
                  }`}
                >
                  <span className="font-mono text-xs mr-3 opacity-60">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {question.type === "short_answer" && (
            <textarea
              value={shortAnswer}
              onChange={(e) => setShortAnswer(e.target.value)}
              rows={5}
              placeholder="Write your response…"
              className="w-full border border-hair p-4 mb-6 outline-none focus:border-ink bg-paper"
            />
          )}

          <button
            onClick={submit}
            disabled={
              question.type === "multiple_choice"
                ? selected === null
                : !shortAnswer.trim()
            }
            className="bg-ink text-paper px-6 py-3 disabled:opacity-30 hover:bg-accent transition"
          >
            Submit
          </button>
        </div>
      )}

      {grade && question && (
        <div className="space-y-6">
          {/* Verdict */}
          <div
            className={`border p-6 ${
              grade.correct ? "border-gold" : "border-accent"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  grade.correct ? "bg-gold" : "bg-accent"
                }`}
              />
              <div className="eyebrow">
                {grade.correct ? "Correct" : "Not quite — and here's why"}
              </div>
            </div>
            <DiagnosisBadge diagnosis={grade.diagnosis} />
            <p className="mt-3 text-base leading-relaxed">{grade.explanation}</p>
          </div>

          {grade.vocabularyTerm && (
            <div className="border border-hair p-5 bg-gold/10">
              <div className="eyebrow mb-2">Term to remember</div>
              <div className="font-display text-3xl mb-1">
                {grade.vocabularyTerm}
              </div>
              <Link
                href={`/reader?term=${encodeURIComponent(grade.vocabularyTerm)}`}
                className="text-sm underline underline-offset-4 hover:text-accent"
              >
                Look it up in the bilingual manual →
              </Link>
            </div>
          )}

          {!grade.correct && question.modelAnswer && (
            <div className="border border-hair p-6 bg-paper">
              <div className="eyebrow mb-2">A model answer</div>
              <p className="font-display text-lg italic leading-snug">
                "{question.modelAnswer}"
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={nextQuestion}
              className="bg-ink text-paper px-6 py-3 hover:bg-accent transition"
            >
              Next question →
            </button>
            <Link
              href="/scenario"
              className="border border-ink px-6 py-3 hover:bg-ink hover:text-paper transition"
            >
              Try a scenario instead →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosisBadge({ diagnosis }: { diagnosis: GradeResult["diagnosis"] }) {
  const labels: Record<GradeResult["diagnosis"], { label: string; cls: string }> = {
    correct: { label: "Mastered", cls: "bg-gold/20 text-gold" },
    concept_gap: { label: "Concept gap", cls: "bg-accent/20 text-accent" },
    vocabulary_gap: { label: "Vocabulary gap", cls: "bg-slate/20 text-slate" },
    exam_technique: { label: "Exam technique", cls: "bg-ink/10 text-ink" },
  };
  const { label, cls } = labels[diagnosis] ?? labels.correct;
  return (
    <span className={`inline-block px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}
