import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

type Question = {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

type Module = {
  name: string;
  sourceUrl: string;
  questions: Question[];
};

type QuestionData = {
  title: string;
  source: string;
  scrapedDate: string;
  totalQuestions: number;
  totalModules: number;
  modules: Module[];
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit'); // '50' or 'all'

    const filePath = path.join(process.cwd(), "data", "abst_questions.json");
    const fileContents = fs.readFileSync(filePath, "utf8");
    const data: QuestionData = JSON.parse(fileContents);

    let allQuestions: Question[] = [];
    for (const mod of data.modules) {
      if (mod.questions && Array.isArray(mod.questions)) {
        allQuestions = allQuestions.concat(mod.questions);
      }
    }

    // Shuffle the array
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }

    // Take specified limit, or all if limit is 'all'
    const selectedQuestions = limit === '50' ? allQuestions.slice(0, 50) : allQuestions;

    // Shuffle the options for each selected question
    const randomizedQuestions = selectedQuestions.map(q => {
      const shuffledOptions = [...q.options];
      for (let k = shuffledOptions.length - 1; k > 0; k--) {
        const l = Math.floor(Math.random() * (k + 1));
        [shuffledOptions[k], shuffledOptions[l]] = [shuffledOptions[l], shuffledOptions[k]];
      }
      return {
        ...q,
        options: shuffledOptions
      };
    });

    return NextResponse.json({
      success: true,
      questions: randomizedQuestions,
    });
  } catch (error) {
    console.error("Error reading practice test data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load practice questions." },
      { status: 500 }
    );
  }
}
