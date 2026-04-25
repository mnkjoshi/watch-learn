import { NextResponse } from "next/server";
import questionsData from "@/data/abst_questions.json";

type RawQuestion = {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

/**
 * GET /api/practice?count=50
 *
 * Returns `count` randomly-selected multiple-choice questions from the
 * ABST practice bank.  Each question includes its module name so the
 * results screen can group performance by topic.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const count = Math.min(
    Number(searchParams.get("count") ?? 50),
    questionsData.totalQuestions
  );

  // Flatten all questions from every module, tagging each with its module name
  const allQuestions: (RawQuestion & { module: string })[] = [];
  for (const mod of questionsData.modules) {
    for (const q of mod.questions) {
      allQuestions.push({ ...(q as RawQuestion), module: mod.name });
    }
  }

  // Fisher-Yates shuffle
  const shuffled = [...allQuestions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const selected = shuffled.slice(0, count).map((q) => {
    // Shuffle the options and track which index is correct
    const optionPairs = q.options.map((text, origIdx) => ({ text, origIdx }));
    for (let i = optionPairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionPairs[i], optionPairs[j]] = [optionPairs[j], optionPairs[i]];
    }

    const correctIndex = optionPairs.findIndex(
      (o) => o.text === q.correctAnswer
    );

    return {
      id: q.id,
      question: q.question,
      options: optionPairs.map((o) => o.text),
      correctIndex,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      module: q.module,
    };
  });

  return NextResponse.json({ questions: selected });
}
