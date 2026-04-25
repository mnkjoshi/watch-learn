"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

export default function PracticeTestPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "active" | "results">("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({}); 

  async function fetchQuestions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/practice-test?limit=50`);
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
  }

  function handleOptionSelect(option: string) {
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: option }));
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setStatus("results");
    }
  }

  // Render the start screen (idle)
  if (status === "idle") {
    return (
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-20 text-center">
        <div className="eyebrow mb-2">Pillar V · Full Practice Exam</div>
        <h1 className="font-display text-4xl md:text-5xl leading-tight mb-8">
          50-Question Mock Exam
        </h1>
        <p className="text-lg text-ink/80 mb-10 max-w-xl mx-auto">
          Test your knowledge with 50 randomized questions from across all modules. 
          You need an 80% (40 out of 50) to pass.
        </p>
        <button
          onClick={startTest}
          disabled={loading}
          className="bg-ink text-paper px-8 py-4 disabled:opacity-30 hover:bg-accent transition text-lg w-full md:w-auto"
        >
          {loading ? "Loading Questions..." : "Start 50-Question Exam"}
        </button>
      </div>
    );
  }

  // Render the active test
  if (status === "active") {
    if (loading || questions.length === 0) {
      return (
        <div className="max-w-3xl mx-auto px-6 pt-20 text-center text-slate">
          Preparing your practice exam...
        </div>
      );
    }

    const currentQ = questions[currentIndex];
    const selectedOption = userAnswers[currentIndex];
    const progress = Math.round(((currentIndex) / questions.length) * 100);

    return (
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-20">
        <div className="flex items-center justify-between font-mono text-sm mb-4">
          <div className="text-slate">Question {currentIndex + 1} of {questions.length}</div>
          <div className="text-slate">{progress}% Completed</div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-hair h-2 mb-8">
          <div 
            className="bg-ink h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="border border-hair p-6 md:p-8 bg-paper">
          <h2 className="font-display text-2xl leading-snug mb-8">
            {currentQ.question}
          </h2>

          <div className="space-y-3 mb-8">
            {currentQ.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleOptionSelect(opt)}
                className={`w-full text-left p-4 border transition ${
                  selectedOption === opt
                    ? "border-ink bg-ink text-paper"
                    : "border-hair hover:border-ink"
                }`}
              >
                <span className={`font-mono text-xs mr-4 ${selectedOption === opt ? "opacity-60" : "opacity-50"}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleNext}
              disabled={!selectedOption}
              className="bg-ink text-paper px-6 py-3 disabled:opacity-30 hover:bg-accent transition"
            >
              {currentIndex === questions.length - 1 ? "Submit Exam" : "Next Question"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render results
  if (status === "results") {
    const totalQuestions = questions.length;
    const passingScore = Math.ceil(totalQuestions * 0.8);
    const score = questions.reduce((acc, q, idx) => {
      if (userAnswers[idx] === q.correctAnswer) {
        return acc + 1;
      }
      return acc;
    }, 0);

    const isPass = score >= passingScore;

    // Identify incorrect questions
    const incorrectIndices = questions
      .map((q, idx) => (userAnswers[idx] !== q.correctAnswer ? idx : -1))
      .filter((idx) => idx !== -1);

    return (
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
        <div className="text-center mb-12">
          <div className="eyebrow mb-2">Exam Results</div>
          <h1 className={`font-display text-5xl md:text-7xl leading-tight mb-4 ${isPass ? 'text-gold' : 'text-accent'}`}>
            {isPass ? "You Passed!" : "Not quite there"}
          </h1>
          <div className="font-display text-3xl text-ink">
            Your Score: {score} / {totalQuestions}
          </div>
          <div className="text-slate mt-2">
            (Required to pass: {passingScore} / {totalQuestions})
          </div>
          <div className="mt-8">
            <button
              onClick={() => {
                setStatus("idle");
                setQuestions([]);
              }}
              className="bg-ink text-paper px-6 py-3 hover:bg-accent transition mr-4"
            >
              Take Another Practice Test
            </button>
            <Link
              href="/"
              className="border border-ink px-6 py-3 inline-block hover:bg-ink hover:text-paper transition"
            >
              Return Home
            </Link>
          </div>
        </div>

        {incorrectIndices.length > 0 && (
          <div className="border border-hair p-6 md:p-8 bg-paper">
            <h2 className="font-display text-2xl mb-8 border-b border-hair pb-4">
              Review Incorrect Answers ({incorrectIndices.length})
            </h2>

            <div className="space-y-8">
              {incorrectIndices.map((idx) => {
                const q = questions[idx];
                const userAnswer = userAnswers[idx];

                return (
                  <div key={idx} className="border border-hair p-6 bg-ink/5">
                    <div className="text-sm font-mono text-slate mb-2">Question {idx + 1}</div>
                    <div className="font-display text-xl mb-4">{q.question}</div>
                    
                    <div className="space-y-2 mb-6">
                      <div className="flex items-start">
                        <span className="font-mono text-xs w-24 shrink-0 text-accent pt-1">Your Answer:</span>
                        <span className="text-accent">{userAnswer}</span>
                      </div>
                      <div className="flex items-start">
                        <span className="font-mono text-xs w-24 shrink-0 text-gold pt-1">Correct Answer:</span>
                        <span className="text-gold">{q.correctAnswer}</span>
                      </div>
                    </div>

                    <div className="bg-paper p-4 border border-hair">
                      <div className="eyebrow mb-2">Explanation</div>
                      <p className="text-ink/80 text-sm leading-relaxed">{q.explanation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
