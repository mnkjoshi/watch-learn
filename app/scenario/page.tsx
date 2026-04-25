"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { recordScenarioRun } from "@/lib/session";

type Turn = { role: "patron" | "guard"; text: string };

type Scenario = {
  id: string;
  title: string;
  blurb: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  manualSection: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: "trespass",
    title: "Refusing to leave",
    blurb: "A patron has been asked to leave three times. They're still at the bar.",
    difficulty: "Beginner",
    manualSection: "Trespass to Premises Act",
  },
  {
    id: "intoxicated",
    title: "Heading to the parking lot",
    blurb: "An intoxicated patron is walking toward their car with keys in hand.",
    difficulty: "Beginner",
    manualSection: "Liquor Control",
  },
  {
    id: "use_of_force",
    title: "Pushing match on the dance floor",
    blurb: "You witness a shove. The aggressor turns toward you.",
    difficulty: "Intermediate",
    manualSection: "Use of Force",
  },
  {
    id: "fire_alarm",
    title: "Fire alarm, busy Saturday",
    blurb: "Patrons are confused, some are ignoring it. You're closest to the exit.",
    difficulty: "Intermediate",
    manualSection: "Emergency Response",
  },
  {
    id: "evidence",
    title: "Reported wallet theft",
    blurb: "A patron points out the suspect at the back booth.",
    difficulty: "Advanced",
    manualSection: "Evidence Handling",
  },
  {
    id: "medical",
    title: "Patron collapses on the floor",
    blurb: "Bystanders crowding around. You arrive first.",
    difficulty: "Advanced",
    manualSection: "First Aid & Medical Response",
  },
];

type Phase = "picker" | "running" | "debriefing" | "debrief";

export default function ScenarioPage() {
  const [phase, setPhase] = useState<Phase>("picker");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [recording, setRecording] = useState(false);
  const [textInput, setTextInput] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  async function startScenario(s: Scenario) {
    setScenario(s);
    setPhase("running");
    setTranscript([]);
    setDebrief(null);
    setPending(true);
    try {
      const res = await fetch("/api/scenario/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: s.id }),
      });
      const data = await res.json();
      setTranscript([{ role: "patron", text: data.patronLine }]);
      playAudio(data.audioBase64);
    } finally {
      setPending(false);
    }
  }

  async function submitGuardResponse(guardText: string) {
    if (!scenario || pending) return;
    setTextInput("");
    const newTranscript = [...transcript, { role: "guard" as const, text: guardText }];
    setTranscript(newTranscript);
    setPending(true);

    try {
      const res = await fetch("/api/scenario/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenario.id,
          transcript: newTranscript,
        }),
      });
      const data = await res.json();
      const updated = [...newTranscript, { role: "patron" as const, text: data.patronLine }];
      setTranscript(updated);
      playAudio(data.audioBase64);
      if (data.shouldEnd || updated.length >= 12) {
        // Auto-trigger debrief after enough turns
        setTimeout(() => endScenario(updated), 800);
      }
    } finally {
      setPending(false);
    }
  }

  async function endScenario(finalTranscript: Turn[] = transcript) {
    if (!scenario) return;
    setPhase("debriefing");
    const res = await fetch("/api/scenario/debrief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId: scenario.id,
        transcript: finalTranscript,
      }),
    });
    const data: Debrief = await res.json();
    setDebrief(data);
    recordScenarioRun({
      scenarioType: scenario.id,
      score: data.score,
      timestamp: Date.now(),
    });
    setPhase("debrief");
  }

  function playAudio(base64?: string) {
    if (!base64) return;
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
    audioRef.current?.pause();
    audioRef.current = audio;
    audio.play().catch(() => {/* autoplay blocked, fine */});
  }

  // --- Voice input via MediaRecorder → batch Transcribe ----------------
  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const arrayBuf = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64: base64, contentType: "audio/webm" }),
        });
        const { transcript: text } = await res.json();
        if (text) submitGuardResponse(text);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (err) {
      alert("Microphone access denied. Use the text input instead.");
    }
  }

  // ---------------------- Render ---------------------------------------

  if (phase === "picker") {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-20">
        <div className="eyebrow mb-3">Pillar I · The Hero Feature</div>
        <h1 className="font-display text-5xl md:text-6xl leading-[0.95] mb-3">
          Scenario Simulator
        </h1>
        <p className="text-lg text-ink/75 max-w-2xl mb-12">
          Pick a scenario. Roleplay it out loud — the patron will respond.
          When you're done, you'll get a graded debrief that quotes the manual
          chapter and verse.
        </p>

        <div className="grid md:grid-cols-3 gap-px bg-ink/10 border border-hair">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => startScenario(s)}
              className={`rise rise-${(i % 5) + 1} text-left bg-paper p-6 hover:bg-ink hover:text-paper transition-colors duration-300 group`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="eyebrow group-hover:text-gold">{s.difficulty}</span>
                <span className="text-xs font-mono text-slate group-hover:text-paper/60">
                  {s.manualSection}
                </span>
              </div>
              <h3 className="font-display text-2xl leading-tight mb-2">{s.title}</h3>
              <p className="text-sm text-ink/70 group-hover:text-paper/75">{s.blurb}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "debriefing") {
    return (
      <div className="max-w-3xl mx-auto px-6 pt-32 text-center">
        <div className="eyebrow mb-3">Debriefing</div>
        <h2 className="font-display text-4xl mb-4">Reviewing your responses…</h2>
        <p className="text-slate">Comparing against the ABST Participant Manual.</p>
        <div className="mt-8 inline-block w-12 h-12 border-2 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (phase === "debrief" && debrief && scenario) {
    return <DebriefView scenario={scenario} debrief={debrief} onRestart={() => setPhase("picker")} />;
  }

  // running
  return (
    <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="eyebrow mb-2">Scenario in progress</div>
          <h1 className="font-display text-3xl md:text-4xl leading-tight">
            {scenario?.title}
          </h1>
          <p className="text-sm text-slate mt-1">{scenario?.manualSection}</p>
        </div>
        <button
          onClick={() => endScenario()}
          className="text-sm border border-ink px-4 py-2 hover:bg-ink hover:text-paper transition"
        >
          End & debrief →
        </button>
      </div>

      {/* Transcript */}
      <div className="border border-hair bg-paper/60 p-6 min-h-[420px] mb-6 space-y-4">
        {transcript.length === 0 && (
          <p className="text-slate italic">Loading the scene…</p>
        )}
        {transcript.map((t, i) => (
          <div key={i} className={`flex ${t.role === "guard" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-3 ${
                t.role === "patron"
                  ? "bg-ink text-paper rounded-r-2xl rounded-bl-2xl"
                  : "bg-gold/20 border border-gold/40 rounded-l-2xl rounded-br-2xl"
              }`}
            >
              <div className="eyebrow mb-1 opacity-70">
                {t.role === "patron" ? "Patron" : "You (Guard)"}
              </div>
              <div>{t.text}</div>
            </div>
          </div>
        ))}
        {pending && (
          <div className="text-sm text-slate italic">…</div>
        )}
      </div>

      {/* Input */}
      <div className="border border-hair bg-paper p-4 flex items-center gap-3">
        <button
          onClick={toggleRecording}
          disabled={pending}
          className={`w-12 h-12 rounded-full border-2 border-accent flex items-center justify-center shrink-0 ${
            recording ? "bg-accent text-paper mic-rec" : "bg-paper text-accent"
          }`}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21h-2a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.08A7 7 0 0 0 19 11z" />
          </svg>
        </button>
        <input
          type="text"
          placeholder={recording ? "Listening…" : "Or type your response…"}
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && textInput.trim()) {
              submitGuardResponse(textInput.trim());
            }
          }}
          disabled={recording || pending}
          className="flex-1 bg-transparent text-base outline-none placeholder:text-slate"
        />
        <button
          onClick={() => textInput.trim() && submitGuardResponse(textInput.trim())}
          disabled={!textInput.trim() || pending}
          className="text-sm font-medium px-4 py-2 bg-ink text-paper disabled:opacity-30"
        >
          Send
        </button>
      </div>
      <p className="text-xs text-slate mt-3">
        Tip: stay calm, identify yourself, give clear lawful directions, and document mentally as you go.
      </p>
    </div>
  );
}

// -------------- Debrief sub-view --------------------------------------

type Debrief = {
  score: number;
  strengths: string[];
  improvements: string[];
  manualCitations: { section: string; quote: string }[];
  modelAnswer: string;
};

function DebriefView({
  scenario,
  debrief,
  onRestart,
}: {
  scenario: Scenario;
  debrief: Debrief;
  onRestart: () => void;
}) {
  const passed = debrief.score >= 80;
  return (
    <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
      <div className="eyebrow mb-3">Examiner's debrief</div>
      <h1 className="font-display text-4xl md:text-5xl leading-tight mb-2">
        {scenario.title}
      </h1>
      <p className="text-sm text-slate mb-10">{scenario.manualSection}</p>

      {/* Score banner */}
      <div className={`border ${passed ? "border-gold" : "border-accent"} p-8 mb-10 flex items-center justify-between`}>
        <div>
          <div className="eyebrow mb-1">Your score</div>
          <div className="font-display text-7xl leading-none">
            {debrief.score}
            <span className="text-3xl text-slate">/100</span>
          </div>
        </div>
        <div className={`text-right ${passed ? "text-gold" : "text-accent"}`}>
          <div className="font-display text-2xl">
            {passed ? "Exam-ready" : "Below the 80% bar"}
          </div>
          <div className="text-sm text-ink/70 mt-1 max-w-xs">
            {passed
              ? "If you performed like this on the provincial exam, you'd pass."
              : "The provincial exam requires 80%. Keep practicing."}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-10">
        <div>
          <div className="eyebrow mb-3 text-gold">What you did well</div>
          <ul className="space-y-3">
            {debrief.strengths.map((s, i) => (
              <li key={i} className="border-l-2 border-gold pl-4 text-ink/90">
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3 text-accent">Where you lost marks</div>
          <ul className="space-y-3">
            {debrief.improvements.map((s, i) => (
              <li key={i} className="border-l-2 border-accent pl-4 text-ink/90">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Model answer */}
      <div className="border border-hair p-6 mb-10 bg-paper">
        <div className="eyebrow mb-3">A model exam-passing response</div>
        <p className="font-display text-xl italic leading-snug">
          "{debrief.modelAnswer}"
        </p>
      </div>

      {/* Manual citations */}
      {debrief.manualCitations.length > 0 && (
        <div className="mb-10">
          <div className="eyebrow mb-3">From the ABST Participant Manual</div>
          <div className="space-y-3">
            {debrief.manualCitations.map((c, i) => (
              <div key={i} className="border border-hair p-4 bg-paper">
                <div className="text-xs font-mono text-slate mb-1">
                  § {c.section}
                </div>
                <div className="text-sm">{c.quote}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onRestart}
          className="bg-ink text-paper px-6 py-3 hover:bg-accent transition"
        >
          Try another scenario →
        </button>
        <Link
          href="/quiz"
          className="border border-ink px-6 py-3 hover:bg-ink hover:text-paper transition"
        >
          Practice the related questions →
        </Link>
      </div>
    </div>
  );
}
