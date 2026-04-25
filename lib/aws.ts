// lib/aws.ts
//
// Singleton AWS clients. Imported by every API route so we don't re-instantiate
// on each request. All clients lazy-initialize so DEMO_MODE works without
// any AWS env vars set.

import dotenv from "dotenv";
dotenv.config();

import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { PollyClient } from "@aws-sdk/client-polly";
import { TranslateClient } from "@aws-sdk/client-translate";
import { TranscribeClient } from "@aws-sdk/client-transcribe";

const region = process.env.AWS_REGION ?? "us-east-1";

const credentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      }
    : undefined;

let _bedrock: BedrockRuntimeClient | null = null;
let _polly: PollyClient | null = null;
let _translate: TranslateClient | null = null;
let _transcribe: TranscribeClient | null = null;

export function bedrock() {
  if (!_bedrock) _bedrock = new BedrockRuntimeClient({ region, credentials });
  return _bedrock;
}

export function polly() {
  if (!_polly) _polly = new PollyClient({ region, credentials });
  return _polly;
}

export function translateClient() {
  if (!_translate) _translate = new TranslateClient({ region, credentials });
  return _translate;
}

export function transcribe() {
  if (!_transcribe) _transcribe = new TranscribeClient({ region, credentials });
  return _transcribe;
}

export const isDemoMode = () =>
  (process.env.DEMO_MODE ?? "true").toLowerCase() === "true";
