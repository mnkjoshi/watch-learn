// app/api/report/grade/route.ts
//
// POST — grades a student's written incident report against the ideal report
// for a given video scenario. Uses Bedrock to evaluate grammar + content.

import { NextRequest, NextResponse } from "next/server";
import { generateJson } from "@/lib/bedrock";
import { VIDEO_REPORT_GRADE } from "@/lib/prompts";
import { VIDEO_SCENARIOS } from "@/data/videos";

export interface ReportGradeResult {
  overallScore: number;
  grammarScore: number;
  contentScore: number;
  grammarCorrections: {
    original: string;
    corrected: string;
    explanation: string;
  }[];
  detailsIdentified: string[];
  detailsMissed: string[];
  structureFeedback: string;
  languageFeedback: string;
  correctedReport: string;
  modelReport: string;
  encouragement: string;
}

export async function POST(req: NextRequest) {
  try {
    const { videoId, studentReport } = await req.json();

    if (!videoId || !studentReport) {
      return NextResponse.json(
        { error: "Missing videoId or studentReport" },
        { status: 400 }
      );
    }

    const video = VIDEO_SCENARIOS.find((v) => v.id === videoId);
    if (!video) {
      return NextResponse.json(
        { error: "Unknown video scenario" },
        { status: 400 }
      );
    }

    const userMessage = `
VIDEO SCENARIO: "${video.title}"
BRIEFING: ${video.briefing}

IDEAL REPORT (what a trained security guard would write):
${video.idealReport}

KEY DETAILS THE STUDENT SHOULD IDENTIFY:
${video.keyDetails.map((d, i) => `${i + 1}. ${d}`).join("\n")}

STUDENT'S WRITTEN REPORT:
"""
${studentReport}
"""

Grade this report for grammar/language quality AND content accuracy. Return the JSON result.
`.trim();

    const result = await generateJson<ReportGradeResult>(
      [{ role: "user", content: userMessage }],
      VIDEO_REPORT_GRADE,
      { maxTokens: 2000, temperature: 0.2 }
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[report/grade] error:", err);
    return NextResponse.json(
      { error: "Failed to grade report" },
      { status: 500 }
    );
  }
}
