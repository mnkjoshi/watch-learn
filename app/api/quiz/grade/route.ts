// app/api/quiz/grade/route.ts
//
// Grades a single answer AND diagnoses the failure mode.
// This is the differentiator — every other team will mark right/wrong;
// we tell the student WHY they got it wrong (concept gap vs. vocab gap).
//
// Owner: Role B.

import { NextRequest, NextResponse } from "next/server";
import { generateJson } from "@/lib/bedrock";
import { QUIZ_GRADE } from "@/lib/prompts";

type Question = {
  id: string;
  type: "multiple_choice" | "short_answer";
  stem: string;
  options?: string[];
  correctIndex?: number;
  modelAnswer?: string;
  manualSection: string;
};

export async function POST(req: NextRequest) {
  const { question, userAnswer } = (await req.json()) as {
    question: Question;
    userAnswer: string;
  };

  // For multiple choice, we can fast-path the correct/incorrect check
  // without a model call — but we still call Bedrock for the diagnosis,
  // which is the value-add.
  const correctText =
    question.type === "multiple_choice" && question.correctIndex !== undefined
      ? question.options?.[question.correctIndex] ?? ""
      : question.modelAnswer ?? "";

  const userMessage = [
    `Question: ${question.stem}`,
    `Manual section: ${question.manualSection}`,
    `Correct answer: ${correctText}`,
    `Student's answer: ${userAnswer}`,
    ``,
    `Grade the answer and diagnose the failure mode if wrong. Return JSON only.`,
  ].join("\n");

  const result = await generateJson<{
    correct: boolean;
    diagnosis: string;
    explanation: string;
    vocabularyTerm: string | null;
    manualSection: string;
  }>([{ role: "user", content: userMessage }], QUIZ_GRADE, {
    maxTokens: 400,
    temperature: 0.2,
  });

  return NextResponse.json({
    correct: !!result.correct,
    diagnosis: result.diagnosis ?? "concept_gap",
    explanation: result.explanation ?? "",
    vocabularyTerm: result.vocabularyTerm ?? null,
    manualSection: result.manualSection ?? question.manualSection,
  });
}
