// app/api/manual/route.ts
//
// Returns the chunked ABST manual for the reader sidebar.
// Strips embeddings from the response (client doesn't need them).
//
// Owner: Role C.

import { NextResponse } from "next/server";
import { loadChunks } from "@/lib/abst";

export async function GET() {
  const chunks = loadChunks().map(({ embedding, ...rest }) => rest);
  return NextResponse.json({ chunks });
}
