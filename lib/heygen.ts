// lib/heygen.ts
//
// HeyGen Streaming Avatar helpers.
// Provides a server-side function to fetch one-time access tokens
// and configuration constants for the two disputant avatars.

import { isDemoMode } from "./aws";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY ?? "";

/**
 * Fetch a one-time-use access token from HeyGen's API.
 * Each streaming avatar session requires its own token.
 */
export async function createAccessToken(): Promise<string> {
  if (isDemoMode()) {
    return "demo-heygen-token-" + Date.now();
  }

  const res = await fetch("https://api.heygen.com/v1/streaming.create_token", {
    method: "POST",
    headers: { "x-api-key": HEYGEN_API_KEY },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HeyGen token error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.data?.token ?? data.token;
}

/**
 * Avatar presets for the two disputants.
 * These use HeyGen's public interactive avatar IDs.
 * Override via env vars if you have custom avatars.
 */
export const DISPUTANT_AVATARS = {
  disputantA: {
    avatarName: process.env.HEYGEN_AVATAR_A ?? "Wayne_20240711",
    voiceId: process.env.HEYGEN_VOICE_A ?? "2ca925d56afd4e11b3b5e2b82a382be1",
    label: "Marcus",
    description: "Angry bar patron who feels disrespected",
  },
  disputantB: {
    avatarName: process.env.HEYGEN_AVATAR_B ?? "josh_lite3_20230714",
    voiceId: process.env.HEYGEN_VOICE_B ?? "077ab11b14f04ce0b49b5f6e5cc20979",
    label: "Tyler",
    description: "Confrontational friend who is escalating the situation",
  },
} as const;
