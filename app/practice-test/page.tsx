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
  const [mode, setMode] = useState<"50" | "all">("50");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({}); 
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);

  async function fetchQuestions(limit: '50' | 'all') {
    setLoading(true);
    try {
      const res = await fetch(`/api/practice-test?limit=${limit}`);
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

  function startTest(limit: '50' | 'all') {
    setMode(limit);
    fetchQuestions(limit);
    setStatus("active");
    setCurrentIndex(0);
    setUserAnswers({});
    setIsAnswerChecked(false);
  }

  function handleOptionSelect(option: string) {
    if (isAnswerChecked) return;
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: option }));
  }

  function handleActionClick() {
    // In "all" mode, first click checks the answer
    if (mode === "all" && !isAnswerChecked) {
      setIsAnswerChecked(true);
      return;
    }

    // Move to next or results
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
        <div className="eyebrow mb-2">Pillar V · Practice Exam</div>
        <h1 className="font-display text-4xl md:text-5xl leading-tight mb-8">
          Practice Test
        </h1>
        <p className="text-lg text-ink/80 mb-10 max-w-xl mx-auto">
          Test your knowledge with randomized questions from across all modules. 
          You need an 80% to pass.
        </p>
        <div className="flex flex-col md:flex-row justify-center gap-4">
          <button
            onClick={() => startTest('50')}
            disabled={loading}
            className="bg-ink text-paper px-8 py-4 disabled:opacity-30 hover:bg-accent transition text-lg"
          >
            {loading ? "Loading..." : "50-Question Exam"}
          </button>
          <button
            onClick={() => startTest('all')}
            disabled={loading}
            className="border border-ink bg-paper text-ink px-8 py-4 disabled:opacity-30 hover:bg-ink/5 transition text-lg"
          >
            {loading ? "Loading..." : "Full Bank (Study Mode)"}
          </button>
        </div>
      </div>
    );
  }

  // Render the active test
  if (status === "active") {
    if (loading || questions.length === 0) {
      return (
        <div className="max-w-3xl mx-auto px-6 pt-20 text-center text-slate">
          Preparing your practice test...
        </div>
      );
    }

    const currentQ = questions[currentIndex];
    const selectedOption = userAnswers[currentIndex];
    const progress = Math.round(((currentIndex) / questions.length) * 100);

    let buttonText = "Next Question";
    if (mode === "all" && !isAnswerChecked) {
      buttonText = "Check Answer";
    } else if (currentIndex === questions.length - 1) {
      buttonText = mode === "50" ? "Submit Exam" : "Finish Review";
    }

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
            <div className="mb-8 p-5 bg-ink/5 border border-hair rounded">
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
          <div className="eyebrow mb-2">{mode === "all" ? "Study Review Complete" : "Exam Results"}</div>
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
                setIsAnswerChecked(false);
              }}
              className="bg-ink text-paper px-6 py-3 hover:bg-accent transition mr-4"
            >
              Back to Start
            </button>
            <Link
              href="/"
              className="border border-ink px-6 py-3 inline-block hover:bg-ink hover:text-paper transition"
            >
              Return Home
            </Link>
          </div>
        </div>

        {incorrectIndices.length > 0 && mode === "50" && (
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
