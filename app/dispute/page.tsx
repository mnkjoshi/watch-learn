"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { recordScenarioRun } from "@/lib/session";

// --------------- types ------------------------------------------------

type DisputeScenario = {
  id: string;
  title: string;
  blurb: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  manualSection: string;
  personA: { name: string };
  personB: { name: string };
  openingExchanges: { speaker: "A" | "B"; line: string }[];
};

type DisputeTurn = {
  speaker: "A" | "B" | "guard";
  name: string;
  text: string;
};

type EvalBadge = {
  effectiveness: "good" | "neutral" | "poor";
  escalationDelta: number;
  reason: string;
  tip: string;
};

type Debrief = {
  score: number;
  strengths: string[];
  improvements: string[];
  manualCitations: { section: string; quote: string }[];
  modelAnswer: string;
  breakdown: {
    communication: number;
    impartiality: number;
    separation: number;
    authority: number;
    escalationJudgment: number;
  };
};

type AvatarConfig = {
  disputantA: { avatarId: string; label: string; description: string };
  disputantB: { avatarId: string; label: string; description: string };
};

type Phase = "picker" | "running" | "debriefing" | "debrief";

// --------------- scenarios (client-side mirror) -----------------------

const SCENARIOS: DisputeScenario[] = [
  {
    id: "bar_tab",
    title: "The Disputed Bar Tab",
    blurb: "Two patrons are arguing loudly over a shared bar tab. One accuses the other of skipping out on their share.",
    difficulty: "Beginner",
    manualSection: "Communication & De-escalation",
    personA: { name: "Marcus" },
    personB: { name: "Tyler" },
    openingExchanges: [
      { speaker: "A", line: "You ordered three rounds of shots for the whole table and now you want ME to pay half? That's a hundred and eighty bucks!" },
      { speaker: "B", line: "Dude, you invited those people over! I'm not paying for YOUR friends' drinks. That's on you." },
      { speaker: "A", line: "Don't give me that. You were the one waving the waitress over every five minutes. Everyone saw it." },
    ],
  },
  {
    id: "line_cutting",
    title: "Line Cutting at the Club",
    blurb: "A patron accuses another of cutting the line. The accused patron's friend jumps in. Voices are rising near the entrance.",
    difficulty: "Intermediate",
    manualSection: "Use of Force & De-escalation",
    personA: { name: "Marcus" },
    personB: { name: "Tyler" },
    openingExchanges: [
      { speaker: "A", line: "Hey! We've been standing here for forty-five minutes. You can't just walk up and cut everyone." },
      { speaker: "B", line: "I'm not cutting, bro. My buddy's inside. He told me to come to the front. Mind your own business." },
      { speaker: "A", line: "That's bull. Everyone here saw you just walk past the whole line. Back of the line, buddy." },
      { speaker: "B", line: "Or what? You gonna make me? Get out of my face." },
    ],
  },
  {
    id: "spilled_drink",
    title: "Spilled Drink Confrontation",
    blurb: "One patron accidentally spills a drink on another. The victim's date is demanding an apology and compensation. It's getting physical.",
    difficulty: "Advanced",
    manualSection: "Use of Force & Trespass to Premises Act",
    personA: { name: "Marcus" },
    personB: { name: "Tyler" },
    openingExchanges: [
      { speaker: "A", line: "You think that's funny? You just dumped your drink all over her! That shirt cost more than your whole outfit." },
      { speaker: "B", line: "It was an accident, man! The floor is packed. People bump into each other. Chill out." },
      { speaker: "A", line: "Chill out? You didn't even say sorry. You laughed! You're buying her a new drink AND paying for the dry cleaning." },
      { speaker: "B", line: "I'm not paying for anything. It was an accident. Back up out of my face before this gets ugly." },
    ],
  },
];

// --------------- component --------------------------------------------

export default function DisputePage() {
  const [phase, setPhase] = useState<Phase>("picker");
  const [scenario, setScenario] = useState<DisputeScenario | null>(null);
  const [transcript, setTranscript] = useState<DisputeTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [listening, setListening] = useState(false);
  const [evalBadges, setEvalBadges] = useState<EvalBadge[]>([]);
  const [latestEval, setLatestEval] = useState<EvalBadge | null>(null);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [escalation, setEscalation] = useState(5);

  // Avatar state (FULL mode — HeyGen TTS + STT)
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig | null>(null);
  const [avatarsReady, setAvatarsReady] = useState({ a: false, b: false });
  const [activeSpeaker, setActiveSpeaker] = useState<"A" | "B" | null>(null);
  const avatarARef = useRef<any>(null);
  const avatarBRef = useRef<any>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const openingQueueRef = useRef<{ speaker: "A" | "B"; line: string }[]>([]);
  const openingPlayedRef = useRef(false);
  const transcriptBoxRef = useRef<HTMLDivElement>(null);

  // STT via MediaRecorder + /api/transcribe
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const submitGuardResponseRef = useRef<(text: string) => void>(() => {});

  // speak() promise tracking
  const speakResolveARef = useRef<(() => void) | null>(null);
  const speakResolveBRef = useRef<(() => void) | null>(null);

  // Keep submitGuardResponse ref current
  useEffect(() => {
    submitGuardResponseRef.current = submitGuardResponse;
  });

  // Auto-scroll transcript container (not the page)
  useEffect(() => {
    const el = transcriptBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  // Play opening lines once both avatars are connected
  useEffect(() => {
    console.log(`[Opening] useEffect: avatarsReady=${JSON.stringify(avatarsReady)} openingPlayed=${openingPlayedRef.current}`);
    if (avatarsReady.a && avatarsReady.b && !openingPlayedRef.current) {
      console.log("[Opening] Both avatars ready, triggering playOpeningLines");
      playOpeningLines();
    }
  }, [avatarsReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      stopAvatarSafe(avatarARef.current);
      stopAvatarSafe(avatarBRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // --------------- TTS: HeyGen repeat() with Polly fallback ----------

  async function pollySpeak(text: string): Promise<void> {
    console.log(`[TTS] Polly fallback: "${text.slice(0, 60)}..."`);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: "Matthew" }),
      });
      const { audioBase64, contentType } = await res.json();
      const audio = new Audio(`data:${contentType};base64,${audioBase64}`);
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
    } catch (e) {
      console.error("[TTS] Polly fallback error:", e);
    }
  }

  function avatarSpeak(speaker: "A" | "B", text: string): Promise<void> {
    const session = speaker === "A" ? avatarARef.current : avatarBRef.current;
    const ready = session?._streamReady;

    if (!session || !ready) {
      console.warn(`[TTS] ${speaker} not stream-ready (state=${session?.state ?? "null"}), using Polly`);
      setActiveSpeaker(speaker);
      return pollySpeak(text).then(() => {
        setActiveSpeaker((prev) => (prev === speaker ? null : prev));
      });
    }

    console.log(`[TTS] ${speaker} repeat(): "${text.slice(0, 60)}..."`);
    setActiveSpeaker(speaker);

    return new Promise<void>((resolve) => {
      if (speaker === "A") {
        speakResolveARef.current = resolve;
      } else {
        speakResolveBRef.current = resolve;
      }

      try {
        session.repeat(text);
      } catch (e) {
        console.error(`[TTS] repeat() threw for ${speaker}, falling back to Polly:`, e);
        const ref = speaker === "A" ? speakResolveARef : speakResolveBRef;
        ref.current = null;
        pollySpeak(text).then(() => {
          setActiveSpeaker((prev) => (prev === speaker ? null : prev));
          resolve();
        });
        return;
      }

      const wordCount = text.split(/\s+/).length;
      const timeoutMs = wordCount * 200 + 3000;
      setTimeout(() => {
        const ref = speaker === "A" ? speakResolveARef : speakResolveBRef;
        if (ref.current === resolve) {
          console.warn(`[TTS] Safety timeout for ${speaker} after ${timeoutMs}ms`);
          ref.current = null;
          setActiveSpeaker((prev) => (prev === speaker ? null : prev));
          resolve();
        }
      }, timeoutMs);
    });
  }

  // --------------- LiveAvatar helpers --------------------------------

  function stopAvatarSafe(session: any) {
    if (!session) return;
    console.log("[Avatar] stopAvatarSafe, state:", session.state);
    try { session.stop(); } catch (e) { console.warn("[Avatar] stop() threw:", e); }
  }

  async function playOpeningLines() {
    if (openingPlayedRef.current) return;
    openingPlayedRef.current = true;
    const lines = openingQueueRef.current;
    console.log(`[Opening] Playing ${lines.length} opening lines via repeat()`);
    for (let i = 0; i < lines.length; i++) {
      const ex = lines[i];
      console.log(`[Opening] Line ${i + 1}/${lines.length}: speaker=${ex.speaker}`);
      await avatarSpeak(ex.speaker, ex.line);
      console.log(`[Opening] Line ${i + 1} done`);
    }
    console.log("[Opening] All opening lines finished");
  }

  // --------------- LiveAvatar setup (FULL mode) ----------------------

  function initAvatars() {
    console.log("[Avatar] initAvatars called, fetching tokens...");
    fetch("/api/heygen/token", { method: "POST" })
      .then((res) => {
        console.log(`[Avatar] Token response: status=${res.status}`);
        if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
        return res.json();
      })
      .then(async ({ tokenA, tokenB, avatars }) => {
        console.log("[Avatar] Tokens received, importing SDK...");
        setAvatarConfig(avatars);

        const { LiveAvatarSession, SessionEvent, AgentEventsEnum } =
          await import("@heygen/liveavatar-web-sdk");
        console.log("[Avatar] SDK imported, starting both sessions in parallel...");

        setupOneSession(tokenA, videoARef, "a", "A", avatarARef, false, LiveAvatarSession, SessionEvent, AgentEventsEnum);
        setupOneSession(tokenB, videoBRef, "b", "B", avatarBRef, false, LiveAvatarSession, SessionEvent, AgentEventsEnum);

        if (keepAliveRef.current) clearInterval(keepAliveRef.current);
        keepAliveRef.current = setInterval(() => {
          const readyA = avatarARef.current?._streamReady;
          const readyB = avatarBRef.current?._streamReady;
          console.log(`[Avatar] keepAlive | A=${readyA ? "ready" : "no"} B=${readyB ? "ready" : "no"}`);
          if (readyA) {
            try { avatarARef.current?.keepAlive(); } catch {}
          }
          if (readyB) {
            try { avatarBRef.current?.keepAlive(); } catch {}
          }
        }, 15_000);
      })
      .catch((err) => {
        console.error("[Avatar] initAvatars FAILED:", err);
      });
  }

  function setupOneSession(
    token: string,
    videoRef: React.RefObject<HTMLVideoElement | null>,
    readyKey: "a" | "b",
    speakerKey: "A" | "B",
    ref: React.MutableRefObject<any>,
    _enableVoiceChat: boolean,
    LiveAvatarSession: any,
    SessionEvent: any,
    AgentEventsEnum: any,
  ) {
    console.log(`[Avatar] setupOneSession ${speakerKey}`);

    const session = new LiveAvatarSession(token);
    ref.current = session;
    session._streamReady = false;

    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      console.log(`[Avatar] ${speakerKey} STREAM_READY | videoRef=${!!videoRef.current}`);
      session._streamReady = true;
      try {
        if (videoRef.current) session.attach(videoRef.current);
      } catch (e) {
        console.error(`[Avatar] ${speakerKey} attach error:`, e);
      }
      setAvatarsReady((prev) => ({ ...prev, [readyKey]: true }));
    });

    session.on(SessionEvent.SESSION_DISCONNECTED, (reason: any) => {
      console.warn(`[Avatar] ${speakerKey} DISCONNECTED | reason:`, reason);
      session._streamReady = false;
      setAvatarsReady((prev) => ({ ...prev, [readyKey]: false }));
    });

    session.on(SessionEvent.SESSION_STATE_CHANGED, (state: any) => {
      console.log(`[Avatar] ${speakerKey} STATE → ${state}`);
    });

    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
      console.log(`[TTS] ${speakerKey} SPEAK_STARTED`);
      setActiveSpeaker(speakerKey);
    });
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
      console.log(`[TTS] ${speakerKey} SPEAK_ENDED`);
      setActiveSpeaker((prev) => (prev === speakerKey ? null : prev));
      const resolveRef = speakerKey === "A" ? speakResolveARef : speakResolveBRef;
      if (resolveRef.current) {
        resolveRef.current();
        resolveRef.current = null;
      }
    });

    session.start().then(() => {
      console.log(`[Avatar] ${speakerKey} start() resolved, state=${session.state}`);
    }).catch((e: any) => {
      // Don't null the ref — the LiveKit room may still be connected
      // even if start() times out on waitForRequiredParticipants.
      console.warn(`[Avatar] ${speakerKey} start() failed (session kept):`, e?.message);
    });
  }

  // --------------- scenario flow -------------------------------------

  function startScenario(s: DisputeScenario) {
    console.log(`[Scenario] startScenario: ${s.id}`);
    setScenario(s);
    setTranscript([]);
    setDebrief(null);
    setEvalBadges([]);
    setLatestEval(null);
    setEscalation(5);

    const openingTurns: DisputeTurn[] = s.openingExchanges.map((ex) => ({
      speaker: ex.speaker,
      name: ex.speaker === "A" ? s.personA.name : s.personB.name,
      text: ex.line,
    }));
    setTranscript(openingTurns);
    setPhase("running");
    console.log(`[Scenario] Phase=running, ${openingTurns.length} opening turns`);

    openingQueueRef.current = s.openingExchanges.map((ex) => ({
      speaker: ex.speaker,
      line: ex.line,
    }));
    openingPlayedRef.current = false;
    setAvatarsReady({ a: false, b: false });

    initAvatars();
  }

  // --------------- guard input ---------------------------------------

  async function submitGuardResponse(guardText: string) {
    console.log(`[Guard] submitGuardResponse | pending=${pending} text="${guardText.slice(0, 60)}"`);
    if (!scenario || pending) {
      console.log("[Guard] Blocked");
      return;
    }
    setTextInput("");
    const guardTurn: DisputeTurn = {
      speaker: "guard",
      name: "You (Guard)",
      text: guardText,
    };
    const updated = [...transcript, guardTurn];
    setTranscript(updated);
    setPending(true);

    evaluateGuard(updated, guardText);

    try {
      // --- Turn A ---
      console.log("[Turn] Fetching speaker A...");
      const resA = await fetch("/api/dispute/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenario.id,
          transcript: updated,
          nextSpeaker: "A",
        }),
      });
      console.log(`[Turn] A status=${resA.status}`);
      const dataA = await resA.json();
      console.log(`[Turn] A:`, { line: dataA.line?.slice(0, 60), shouldEnd: dataA.shouldEnd });
      const turnA: DisputeTurn = { speaker: "A", name: dataA.name, text: dataA.line };
      const withA = [...updated, turnA];
      setTranscript(withA);
      await avatarSpeak("A", dataA.line);

      if (dataA.shouldEnd) {
        setTimeout(() => endScenario(withA), 500);
        return;
      }

      // --- Turn B ---
      console.log("[Turn] Fetching speaker B...");
      const resB = await fetch("/api/dispute/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenario.id,
          transcript: withA,
          nextSpeaker: "B",
        }),
      });
      console.log(`[Turn] B status=${resB.status}`);
      const dataB = await resB.json();
      console.log(`[Turn] B:`, { line: dataB.line?.slice(0, 60), shouldEnd: dataB.shouldEnd });
      const turnB: DisputeTurn = { speaker: "B", name: dataB.name, text: dataB.line };
      const withB = [...withA, turnB];
      setTranscript(withB);
      await avatarSpeak("B", dataB.line);

      if (dataB.shouldEnd || withB.length >= 20) {
        setTimeout(() => endScenario(withB), 500);
      }
    } catch (e) {
      console.error("[Guard] exception:", e);
    } finally {
      setPending(false);
    }
  }

  async function evaluateGuard(
    currentTranscript: DisputeTurn[],
    guardStatement: string,
  ) {
    if (!scenario) return;
    console.log(`[Eval] Evaluating: "${guardStatement.slice(0, 60)}..."`);
    try {
      const res = await fetch("/api/dispute/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenario.id,
          transcript: currentTranscript,
          guardStatement,
        }),
      });
      const evalResult: EvalBadge = await res.json();
      console.log("[Eval]", evalResult);
      setEvalBadges((prev) => [...prev, evalResult]);
      setLatestEval(evalResult);
      setEscalation((prev) =>
        Math.max(0, Math.min(10, prev + evalResult.escalationDelta)),
      );
      setTimeout(() => setLatestEval(null), 5000);
    } catch (e) {
      console.error("[Eval] exception:", e);
    }
  }

  async function endScenario(finalTranscript: DisputeTurn[] = transcript) {
    if (!scenario) return;
    console.log(`[Debrief] endScenario | turns=${finalTranscript.length}`);
    setPhase("debriefing");

    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    stopAvatarSafe(avatarARef.current);
    stopAvatarSafe(avatarBRef.current);

    const res = await fetch("/api/dispute/debrief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId: scenario.id,
        transcript: finalTranscript,
      }),
    });
    const data: Debrief = await res.json();
    console.log("[Debrief] Score:", data.score);
    setDebrief(data);
    recordScenarioRun({
      scenarioType: `dispute_${scenario.id}`,
      score: data.score,
      timestamp: Date.now(),
    });
    setPhase("debrief");
  }

  // --------------- voice input (MediaRecorder + /api/transcribe) ------

  async function toggleListening() {
    console.log(`[STT] toggleListening | listening=${listening}`);

    if (listening) {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      setListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) {
          console.log("[STT] Recording too short, ignoring");
          return;
        }
        console.log(`[STT] Sending ${blob.size} bytes to /api/transcribe`);
        try {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              resolve(dataUrl.split(",")[1]);
            };
            reader.readAsDataURL(blob);
          });
          const res = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64, contentType: "audio/webm" }),
          });
          const { transcript } = await res.json();
          if (transcript && transcript.trim().length >= 2) {
            console.log(`[STT] Transcription: "${transcript}"`);
            setTextInput(transcript.trim());
          }
        } catch (e) {
          console.error("[STT] Transcribe error:", e);
        }
      };

      recorder.start();
      setListening(true);
      console.log("[STT] Recording started");
    } catch (e) {
      console.error("[STT] getUserMedia error:", e);
    }
  }

  // --------------- renders -------------------------------------------

  if (phase === "picker") {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-20">
        <div className="eyebrow mb-3">Dispute De-escalation</div>
        <h1 className="font-display text-5xl md:text-6xl leading-[0.95] mb-3">
          Live Dispute Simulator
        </h1>
        <p className="text-lg text-ink/75 max-w-2xl mb-12">
          Two AI avatars are about to have a heated argument. Step in as the
          security guard and de-escalate the situation using ABST techniques.
          You'll be graded on communication, impartiality, and judgment.
        </p>

        <div className="grid md:grid-cols-3 gap-px bg-ink/10 border border-hair">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => startScenario(s)}
              className={`rise rise-${(i % 5) + 1} text-left bg-paper p-6 hover:bg-ink hover:text-paper transition-colors duration-300 group`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="eyebrow group-hover:text-gold">
                  {s.difficulty}
                </span>
                <span className="text-xs font-mono text-slate group-hover:text-paper/60">
                  {s.manualSection}
                </span>
              </div>
              <h3 className="font-display text-2xl leading-tight mb-2">
                {s.title}
              </h3>
              <p className="text-sm text-ink/70 group-hover:text-paper/75">
                {s.blurb}
              </p>
              <div className="mt-4 text-xs text-slate group-hover:text-paper/50">
                {s.personA.name} vs. {s.personB.name}
              </div>
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
        <h2 className="font-display text-4xl mb-4">
          Reviewing your de-escalation…
        </h2>
        <p className="text-slate">
          Grading against the ABST rubric for dispute resolution.
        </p>
        <div className="mt-8 inline-block w-12 h-12 border-2 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (phase === "debrief" && debrief && scenario) {
    return (
      <DebriefView
        scenario={scenario}
        debrief={debrief}
        onRestart={() => setPhase("picker")}
      />
    );
  }

  // --------------- running phase -------------------------------------

  return (
    <div className="max-w-6xl mx-auto px-6 pt-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="eyebrow mb-1">Dispute in progress</div>
          <h1 className="font-display text-2xl md:text-3xl leading-tight">
            {scenario?.title}
          </h1>
          <p className="text-xs text-slate mt-1">{scenario?.manualSection}</p>
        </div>
        <button
          onClick={() => endScenario()}
          className="text-sm border border-ink px-4 py-2 hover:bg-ink hover:text-paper transition"
        >
          End &amp; debrief →
        </button>
      </div>

      {/* Escalation meter */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <span className="eyebrow text-[10px]">Escalation</span>
          <div className="flex-1 h-2 bg-ink/10 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-700 rounded-full"
              style={{
                width: `${escalation * 10}%`,
                background:
                  escalation <= 3
                    ? "#C9A14A"
                    : escalation <= 6
                    ? "#E8A735"
                    : "#D64545",
              }}
            />
          </div>
          <span className="text-xs font-mono text-slate w-8 text-right">
            {escalation}/10
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left column — Avatars */}
        <div className="lg:col-span-1 space-y-3">
          <div
            className={`border ${
              activeSpeaker === "A"
                ? "border-accent ring-2 ring-accent/30"
                : "border-hair"
            } bg-ink overflow-hidden transition-all duration-300`}
          >
            <video
              ref={videoARef}
              autoPlay
              playsInline
              muted={false}
              className="w-full aspect-square object-cover bg-ink"
            />
            <div className="px-3 py-2 bg-ink text-paper flex items-center justify-between">
              <div>
                <span className="text-xs font-mono opacity-60">Person A</span>
                <span className="text-sm font-medium ml-2">
                  {avatarConfig?.disputantA.label ?? scenario?.personA.name}
                </span>
              </div>
              {activeSpeaker === "A" && (
                <span className="text-[10px] font-mono text-accent animate-pulse">
                  SPEAKING
                </span>
              )}
            </div>
          </div>

          <div
            className={`border ${
              activeSpeaker === "B"
                ? "border-accent ring-2 ring-accent/30"
                : "border-hair"
            } bg-ink overflow-hidden transition-all duration-300`}
          >
            <video
              ref={videoBRef}
              autoPlay
              playsInline
              muted={false}
              className="w-full aspect-square object-cover bg-ink"
            />
            <div className="px-3 py-2 bg-ink text-paper flex items-center justify-between">
              <div>
                <span className="text-xs font-mono opacity-60">Person B</span>
                <span className="text-sm font-medium ml-2">
                  {avatarConfig?.disputantB.label ?? scenario?.personB.name}
                </span>
              </div>
              {activeSpeaker === "B" && (
                <span className="text-[10px] font-mono text-accent animate-pulse">
                  SPEAKING
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right column — Transcript + Input */}
        <div className="lg:col-span-2 flex flex-col">
          {/* Transcript */}
          <div
            ref={transcriptBoxRef}
            className="border border-hair bg-paper/60 p-4 flex-1 min-h-[400px] max-h-[520px] overflow-y-auto mb-4 space-y-3"
          >
            {transcript.length === 0 && (
              <p className="text-slate italic">Loading the scene…</p>
            )}
            {transcript.map((t, i) => (
              <div
                key={i}
                className={`flex ${
                  t.speaker === "guard" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 ${
                    t.speaker === "guard"
                      ? "bg-gold/20 border border-gold/40 rounded-l-2xl rounded-br-2xl"
                      : t.speaker === "A"
                      ? "bg-ink text-paper rounded-r-2xl rounded-bl-2xl"
                      : "bg-ink/80 text-paper rounded-r-2xl rounded-bl-2xl"
                  }`}
                >
                  <div className="eyebrow mb-1 opacity-70 text-[10px]">
                    {t.speaker === "guard"
                      ? "You (Guard)"
                      : `${t.name} (${
                          t.speaker === "A" ? "Person A" : "Person B"
                        })`}
                  </div>
                  <div className="text-sm">{t.text}</div>
                </div>
              </div>
            ))}
            {pending && <div className="text-sm text-slate italic">…</div>}
          </div>

          {/* Guard input */}
          <div className="border border-hair bg-paper p-4 flex items-center gap-3">
            <button
              onClick={toggleListening}
              disabled={pending}
              className={`w-12 h-12 rounded-full border-2 border-accent flex items-center justify-center shrink-0 ${
                listening
                  ? "bg-accent text-paper mic-rec"
                  : "bg-paper text-accent"
              }`}
              aria-label={listening ? "Stop listening" : "Start listening"}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21h-2a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.08A7 7 0 0 0 19 11z" />
              </svg>
            </button>
            <input
              type="text"
              placeholder={
                listening
                  ? "Listening…"
                  : "Type your de-escalation response…"
              }
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && textInput.trim()) {
                  submitGuardResponse(textInput.trim());
                }
              }}
              disabled={listening || pending}
              className="flex-1 bg-transparent text-base outline-none placeholder:text-slate"
            />
            <button
              onClick={() =>
                textInput.trim() && submitGuardResponse(textInput.trim())
              }
              disabled={!textInput.trim() || pending}
              className="text-sm font-medium px-4 py-2 bg-ink text-paper disabled:opacity-30"
            >
              Intervene
            </button>
          </div>
          <p className="text-xs text-slate mt-2">
            Stay calm, identify yourself as security, acknowledge both sides,
            give clear directions, and separate the parties.
          </p>
        </div>
      </div>

      {/* Evaluation toast — fixed bottom-right, never affects layout */}
      {latestEval && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-80 px-4 py-3 border text-sm shadow-lg ${
            latestEval.effectiveness === "good"
              ? "border-gold bg-gold/10 backdrop-blur-sm"
              : latestEval.effectiveness === "poor"
              ? "border-accent bg-accent/10 backdrop-blur-sm"
              : "border-hair bg-paper/95 backdrop-blur-sm"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                latestEval.effectiveness === "good"
                  ? "bg-gold"
                  : latestEval.effectiveness === "poor"
                  ? "bg-accent"
                  : "bg-slate"
              }`}
            />
            <span className="eyebrow text-[10px]">
              {latestEval.effectiveness === "good"
                ? "Effective"
                : latestEval.effectiveness === "poor"
                ? "Ineffective"
                : "Neutral"}{" "}
              ({latestEval.escalationDelta > 0 ? "+" : ""}
              {latestEval.escalationDelta})
            </span>
          </div>
          <p className="text-ink/80">{latestEval.reason}</p>
          <p className="text-xs text-slate mt-1">Tip: {latestEval.tip}</p>
        </div>
      )}
    </div>
  );
}

// --------------- Debrief sub-view ------------------------------------

function DebriefView({
  scenario,
  debrief,
  onRestart,
}: {
  scenario: DisputeScenario;
  debrief: Debrief;
  onRestart: () => void;
}) {
  const passed = debrief.score >= 80;

  const breakdownItems = [
    { label: "Communication", key: "communication" as const, weight: "30%" },
    { label: "Impartiality", key: "impartiality" as const, weight: "20%" },
    { label: "Separation", key: "separation" as const, weight: "20%" },
    { label: "Authority", key: "authority" as const, weight: "15%" },
    {
      label: "Escalation Judgment",
      key: "escalationJudgment" as const,
      weight: "15%",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
      <div className="eyebrow mb-3">De-escalation debrief</div>
      <h1 className="font-display text-4xl md:text-5xl leading-tight mb-2">
        {scenario.title}
      </h1>
      <p className="text-sm text-slate mb-10">{scenario.manualSection}</p>

      <div
        className={`border ${
          passed ? "border-gold" : "border-accent"
        } p-8 mb-10 flex items-center justify-between`}
      >
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
              ? "Your de-escalation skills meet the provincial exam standard."
              : "The provincial exam requires 80%. Practice your approach."}
          </div>
        </div>
      </div>

      <div className="mb-10">
        <div className="eyebrow mb-4">Rubric breakdown</div>
        <div className="grid gap-3">
          {breakdownItems.map((item) => {
            const val = debrief.breakdown[item.key];
            return (
              <div key={item.key} className="flex items-center gap-4">
                <div className="w-40 text-sm">
                  {item.label}
                  <span className="text-xs text-slate ml-1">
                    ({item.weight})
                  </span>
                </div>
                <div className="flex-1 h-3 bg-ink/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${val}%`,
                      background:
                        val >= 80
                          ? "#C9A14A"
                          : val >= 50
                          ? "#E8A735"
                          : "#D64545",
                    }}
                  />
                </div>
                <div className="w-10 text-right text-sm font-mono">{val}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-10">
        <div>
          <div className="eyebrow mb-3 text-gold">What you did well</div>
          <ul className="space-y-3">
            {debrief.strengths.map((s, i) => (
              <li
                key={i}
                className="border-l-2 border-gold pl-4 text-ink/90 text-sm"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3 text-accent">Where you lost marks</div>
          <ul className="space-y-3">
            {debrief.improvements.map((s, i) => (
              <li
                key={i}
                className="border-l-2 border-accent pl-4 text-ink/90 text-sm"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border border-hair p-6 mb-10 bg-paper">
        <div className="eyebrow mb-3">A model exam-passing de-escalation</div>
        <p className="font-display text-xl italic leading-snug">
          &ldquo;{debrief.modelAnswer}&rdquo;
        </p>
      </div>

      {debrief.manualCitations.length > 0 && (
        <div className="mb-10">
          <div className="eyebrow mb-3">From the ABST Participant Manual</div>
          <div className="space-y-3">
            {debrief.manualCitations.map((c, i) => (
              <div key={i} className="border border-hair p-4 bg-paper">
                <div className="text-xs font-mono text-slate mb-1">
                  &sect; {c.section}
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
          Try another dispute →
        </button>
        <Link
          href="/scenario"
          className="border border-ink px-6 py-3 hover:bg-ink hover:text-paper transition"
        >
          Patron scenarios →
        </Link>
        <Link
          href="/quiz"
          className="border border-ink px-6 py-3 hover:bg-ink hover:text-paper transition"
        >
          Practice quiz →
        </Link>
      </div>
    </div>
  );
}
