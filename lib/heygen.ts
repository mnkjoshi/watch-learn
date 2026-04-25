// lib/heygen.ts
//
// LiveAvatar helpers.
// Provides server-side functions to create session tokens via the
// LiveAvatar API and configuration for the two disputant avatars.

import { isDemoMode } from "./aws";

const HEYGEN_API_KEY = process.env.HEYGEN_LIVE_AVATAR ?? process.env.HEYGEN_API_KEY ?? "";
const LIVEAVATAR_API = "https://api.liveavatar.com";

export const DISPUTANT_AVATARS = {
  disputantA: {
    avatarId: process.env.HEYGEN_AVATAR_A ?? "",
    label: "Marcus",
    description: "Angry bar patron who feels disrespected",
  },
  disputantB: {
    avatarId: process.env.HEYGEN_AVATAR_B ?? "",
    label: "Tyler",
    description: "Confrontational friend who is escalating the situation",
  },
} as const;

/**
 * Create a LiveAvatar session token in FULL mode.
 * FULL mode: avatar agent joins LiveKit room, repeat() works for TTS,
 * voiceChat provides STT via USER_TRANSCRIPTION events.
 */
export async function createSessionToken(avatarId: string): Promise<{ sessionToken: string; sessionId: string }> {
  console.log(`[heygen] createSessionToken called | avatarId=${avatarId} demoMode=${isDemoMode()} apiKey=${HEYGEN_API_KEY ? HEYGEN_API_KEY.slice(0, 8) + "..." : "EMPTY"}`);

  if (isDemoMode()) {
    console.log("[heygen] Demo mode, returning mock token");
    return {
      sessionToken: "demo-liveavatar-token-" + Date.now(),
      sessionId: "demo-session-" + Date.now(),
    };
  }

  if (!avatarId) {
    throw new Error("Missing avatar_id — set HEYGEN_AVATAR_A / HEYGEN_AVATAR_B env vars with LiveAvatar avatar UUIDs");
  }

  const requestBody = {
    mode: "FULL",
    avatar_id: avatarId,
    is_sandbox: false,
  };
  console.log("[heygen] Requesting token:", JSON.stringify(requestBody));

  const res = await fetch(`${LIVEAVATAR_API}/v1/sessions/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": HEYGEN_API_KEY,
    },
    body: JSON.stringify(requestBody),
  });

  console.log(`[heygen] Token response: status=${res.status} ok=${res.ok}`);

  if (!res.ok) {
    const body = await res.text();
    console.error(`[heygen] Token error body:`, body);
    throw new Error(`LiveAvatar token error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const sessionToken = data.data?.session_token ?? data.session_token;
  const sessionId = data.data?.session_id ?? data.session_id;
  console.log(`[heygen] Token success: sessionId=${sessionId} tokenLength=${sessionToken?.length ?? 0}`);

  return { sessionToken, sessionId };
}

export async function listPublicAvatars(): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${LIVEAVATAR_API}/v1/avatars/public?page=1&page_size=20`, {
    headers: { "X-API-KEY": HEYGEN_API_KEY },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data?.items ?? []).map((a: any) => ({ id: a.id, name: a.name }));
}
