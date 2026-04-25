"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { recordQuizAttempt } from "@/lib/session";

type Question = {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

type APIResponse = {
  success: boolean;
  questions?: Question[];
  error?: string;
};

export default function StudyModePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "active" | "results">("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({}); 
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [streak, setStreak] = useState({ correct: 0, total: 0 });

  async function fetchQuestions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/practice-test?limit=all`);
      const data: APIResponse = await res.json();
      if (data.success && data.questions) {
        setQuestions(data.questions);
      } else {
        alert("Failed to load questions. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred while fetching questions.");
    } finally {
      setLoading(false);
    }
  }

  function startTest() {
    fetchQuestions();
    setStatus("active");
    setCurrentIndex(0);
    setUserAnswers({});
    setIsAnswerChecked(false);
    setStreak({ correct: 0, total: 0 });
  }

  function handleOptionSelect(option: string) {
    if (isAnswerChecked) return;
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: option }));
  }

  function handleActionClick() {
    const currentQ = questions[currentIndex];
    const selectedOption = userAnswers[currentIndex];
    
    // Check Answer
    if (!isAnswerChecked) {
      setIsAnswerChecked(true);
      
      const isCorrect = selectedOption === currentQ.correctAnswer;
      // Update streak
      setStreak(s => ({
        correct: s.correct + (isCorrect ? 1 : 0),
        total: s.total + 1
      }));
      
      // We can also optionally record it to the session file
      recordQuizAttempt({
        questionId: currentQ.id.toString(),
        section: "Full Bank Study",
        correct: isCorrect,
        diagnosis: isCorrect ? "correct" : "concept_gap",
        timestamp: Date.now(),
      });
      return;
    }

    // Move to next
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsAnswerChecked(false);
    } else {
      setStatus("results");
    }
  }

  // Render the start screen (idle)
  if (status === "idle") {
    return (
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-20 text-center">
        <div className="eyebrow mb-2">Pillar II · Adaptive Quiz / Study Mode</div>
        <h1 className="font-display text-4xl md:text-5xl leading-tight mb-8">
          Full Bank Study Mode
        </h1>
        <p className="text-lg text-ink/80 mb-10 max-w-xl mx-auto">
          Go through the entire bank of questions at your own pace. You will receive immediate feedback and explanations for each question as you go.
        </p>
        <button
          onClick={startTest}
          disabled={loading}
          className="bg-ink text-paper px-8 py-4 disabled:opacity-30 hover:bg-accent transition text-lg"
        >
          {loading ? "Loading Questions..." : "Start Study Session"}
        </button>
      </div>
    );
  }

  // Render the active test
  if (status === "active") {
    if (loading || questions.length === 0) {
      return (
        <div className="max-w-3xl mx-auto px-6 pt-20 text-center text-slate">
          Preparing your study session...
        </div>
      );
    }

    const currentQ = questions[currentIndex];
    const selectedOption = userAnswers[currentIndex];
    const progress = Math.round(((currentIndex) / questions.length) * 100);

    let buttonText = "Next Question";
    if (!isAnswerChecked) {
      buttonText = "Check Answer";
    } else if (currentIndex === questions.length - 1) {
      buttonText = "Finish Session";
    }

    return (
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-20">
        <div className="flex items-start justify-end mb-8">
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

        <div className="border border-hair p-6 md:p-8 bg-paper">
          <h2 className="font-display text-2xl leading-snug mb-8">
            {currentQ.question}
          </h2>

          <div className="space-y-3 mb-8">
            {currentQ.options.map((opt, i) => {
              let btnClass = "border-hair hover:border-ink";
              
              if (isAnswerChecked) {
                if (opt === currentQ.correctAnswer) {
                  // Correct answer is green
                  btnClass = "border-green-600 bg-green-50 text-green-900 font-medium";
                } else if (opt === selectedOption && opt !== currentQ.correctAnswer) {
                  // Incorrect user choice is red
                  btnClass = "border-red-500 bg-red-50 text-red-900";
                } else {
                  // Unselected options are muted
                  btnClass = "border-hair opacity-50";
                }
              } else if (selectedOption === opt) {
                btnClass = "border-ink bg-ink text-paper";
              }

              return (
                <button
                  key={i}
                  disabled={isAnswerChecked}
                  onClick={() => handleOptionSelect(opt)}
                  className={`w-full text-left p-4 border transition ${btnClass}`}
                >
                  <span className={`font-mono text-xs mr-4 ${selectedOption === opt && !isAnswerChecked ? "opacity-60" : "opacity-50"}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          {isAnswerChecked && (
            <div className="mb-8 p-5 bg-ink/5 border border-hair rounded animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="eyebrow mb-2">Explanation</div>
              <p className="text-sm text-ink/90 leading-relaxed">
                {currentQ.explanation}
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleActionClick}
              disabled={!selectedOption}
              className="bg-ink text-paper px-6 py-3 disabled:opacity-30 hover:bg-accent transition"
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render results
  if (status === "results") {
    return (
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
        <div className="text-center mb-12">
          <div className="eyebrow mb-2">Study Session Complete</div>
          <h1 className="font-display text-5xl md:text-7xl leading-tight mb-4 text-ink">
            Great Job!
          </h1>
          <div className="font-display text-3xl text-ink">
            Final Score: {streak.correct} / {streak.total}
          </div>
          <div className="mt-8">
            <button
              onClick={() => {
                setStatus("idle");
                setQuestions([]);
                setIsAnswerChecked(false);
              }}
              className="bg-ink text-paper px-6 py-3 hover:bg-accent transition mr-4"
            >
              Start Again
            </button>
            <Link
              href="/"
              className="border border-ink px-6 py-3 inline-block hover:bg-ink hover:text-paper transition"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
