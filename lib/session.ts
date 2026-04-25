// lib/session.ts
//
// Lightweight session state — tracks quiz performance and scenario history.
// Persisted to localStorage on the client (no backend DB).
// Server routes don't read this; the client passes the relevant slice up.

export type WeakArea = {
  section: string;
  wrongCount: number;
  totalCount: number;
};

export type QuizAttempt = {
  questionId: string;
  section: string;
  correct: boolean;
  diagnosis: string;
  timestamp: number;
};

export type ScenarioRun = {
  scenarioType: string;
  score: number;
  timestamp: number;
};

export type ReportAttempt = {
  videoId: string;
  overallScore: number;
  grammarScore: number;
  contentScore: number;
  timestamp: number;
};

export type SessionState = {
  quizAttempts: QuizAttempt[];
  scenarioRuns: ScenarioRun[];
  reportAttempts: ReportAttempt[];
};

export const EMPTY_SESSION: SessionState = {
  quizAttempts: [],
  scenarioRuns: [],
  reportAttempts: [],
};

const KEY = "abst-coach-session-v1";

export function loadSession(): SessionState {
  if (typeof window === "undefined") return EMPTY_SESSION;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_SESSION;
    return { ...EMPTY_SESSION, ...JSON.parse(raw) };
  } catch {
    return EMPTY_SESSION;
  }
}

export function saveSession(state: SessionState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded — silently drop */
  }
}

export function recordQuizAttempt(attempt: QuizAttempt): SessionState {
  const s = loadSession();
  s.quizAttempts = [...s.quizAttempts, attempt].slice(-100);
  saveSession(s);
  return s;
}

export function recordScenarioRun(run: ScenarioRun): SessionState {
  const s = loadSession();
  s.scenarioRuns = [...s.scenarioRuns, run].slice(-50);
  saveSession(s);
  return s;
}

export function recordReportAttempt(attempt: ReportAttempt): SessionState {
  const s = loadSession();
  s.reportAttempts = [...(s.reportAttempts ?? []), attempt].slice(-50);
  saveSession(s);
  return s;
}

export function computeWeakAreas(state: SessionState): WeakArea[] {
  const map = new Map<string, WeakArea>();
  for (const a of state.quizAttempts) {
    const cur = map.get(a.section) ?? { section: a.section, wrongCount: 0, totalCount: 0 };
    cur.totalCount += 1;
    if (!a.correct) cur.wrongCount += 1;
    map.set(a.section, cur);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.wrongCount / b.totalCount - a.wrongCount / a.totalCount
  );
}

export function computeConfidence(state: SessionState): number {
  // Crude blended score: 60% quiz accuracy + 40% scenario average.
  const quizCorrect = state.quizAttempts.filter((a) => a.correct).length;
  const quizPct = state.quizAttempts.length > 0
    ? (quizCorrect / state.quizAttempts.length) * 100
    : 0;
  const scenarioAvg = state.scenarioRuns.length > 0
    ? state.scenarioRuns.reduce((s, r) => s + r.score, 0) / state.scenarioRuns.length
    : 0;

  if (state.quizAttempts.length === 0 && state.scenarioRuns.length === 0) return 0;
  if (state.scenarioRuns.length === 0) return Math.round(quizPct);
  if (state.quizAttempts.length === 0) return Math.round(scenarioAvg);
  return Math.round(quizPct * 0.6 + scenarioAvg * 0.4);
}