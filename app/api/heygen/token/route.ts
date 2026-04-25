// app/api/heygen/token/route.ts
//
// Returns a one-time HeyGen access token for the client to initialize
// a StreamingAvatar session. Each avatar needs its own token.

import { NextRequest, NextResponse } from "next/server";
import { createAccessToken, DISPUTANT_AVATARS } from "@/lib/heygen";

export async function POST(req: NextRequest) {
  try {
    // Generate two tokens — one per avatar session
    const [tokenA, tokenB] = await Promise.all([
      createAccessToken(),
      createAccessToken(),
    ]);

    return NextResponse.json({
      tokenA,
      tokenB,
      avatars: DISPUTANT_AVATARS,
    });
  } catch (err: any) {
    console.error("[heygen/token]", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to create HeyGen tokens" },
      { status: 500 }
    );
  }
}
