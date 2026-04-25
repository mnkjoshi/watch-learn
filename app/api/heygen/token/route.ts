// app/api/heygen/token/route.ts
//
// Returns LiveAvatar session tokens for the client to initialize
// avatar sessions. Each avatar gets its own session token.

import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, DISPUTANT_AVATARS, listPublicAvatars } from "@/lib/heygen";

export async function POST(req: NextRequest) {
  try {
    console.log("[heygen/token] POST called");
    let avatarA = DISPUTANT_AVATARS.disputantA.avatarId;
    let avatarB = DISPUTANT_AVATARS.disputantB.avatarId;
    console.log(`[heygen/token] avatarA=${avatarA || "EMPTY"} avatarB=${avatarB || "EMPTY"}`);

    // If avatar IDs aren't configured, pick two from public avatars
    if (!avatarA || !avatarB) {
      const publicAvatars = await listPublicAvatars();
      if (publicAvatars.length >= 2) {
        avatarA = avatarA || publicAvatars[0].id;
        avatarB = avatarB || publicAvatars[1].id;
      } else if (publicAvatars.length === 1) {
        avatarA = avatarA || publicAvatars[0].id;
        avatarB = avatarB || publicAvatars[0].id;
      } else {
        return NextResponse.json(
          { error: "No avatars available. Set HEYGEN_AVATAR_A and HEYGEN_AVATAR_B env vars with LiveAvatar avatar UUIDs." },
          { status: 500 }
        );
      }
    }

    console.log(`[heygen/token] Creating tokens for A=${avatarA} B=${avatarB}`);
    const [tokenA, tokenB] = await Promise.all([
      createSessionToken(avatarA),
      createSessionToken(avatarB),
    ]);
    console.log(`[heygen/token] Tokens created: tokenA=${tokenA.sessionToken?.slice(0, 20)}... tokenB=${tokenB.sessionToken?.slice(0, 20)}...`);

    return NextResponse.json({
      tokenA: tokenA.sessionToken,
      tokenB: tokenB.sessionToken,
      sessionIdA: tokenA.sessionId,
      sessionIdB: tokenB.sessionId,
      avatars: {
        disputantA: { ...DISPUTANT_AVATARS.disputantA, avatarId: avatarA },
        disputantB: { ...DISPUTANT_AVATARS.disputantB, avatarId: avatarB },
      },
    });
  } catch (err: any) {
    console.error("[heygen/token]", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to create LiveAvatar session tokens" },
      { status: 500 }
    );
  }
}
