# ABST Coach

**Hackathon MVP — Scenario-based exam coach for ESL students preparing for the Alberta Basic Security Training provincial exam.**

This is the first-push scaffold. Every page renders, every API route returns sensible data, and every AWS call has a `DEMO_MODE` fallback so the app works end-to-end before any AWS credentials are wired up. Teammates can develop in parallel without blocking each other.

## Quickstart

```bash
# 1. Install
npm install

# 2. Copy env template, fill in AWS creds (or leave DEMO_MODE=true to skip)
cp .env.example .env.local

# 3. (Optional, do this BEFORE the hackathon) Pre-chunk the ABST manual
#    Drop the PDF into data/abst_manual.pdf first.
node scripts/prepare_abst.mjs

# 4. Run
npm run dev
```

Open http://localhost:3000 — all four pillars are navigable from the home page.

## Pillars (per `hackathon_winning_plan.md`)

| Pillar | Owner | Route | API |
| --- | --- | --- | --- |
| Scenario Simulator (hero) | A | `/scenario` | `/api/scenario/*` |
| Adaptive Quiz | B | `/quiz` | `/api/quiz/*` |
| Manual at Your Level | C | `/reader` | `/api/manual`, `/api/density`, `/api/tts` |
| Polish + Progress + Demo | D | `/`, `/progress` | — |

> **Note on translation:** Alberta requires that ABST training materials be delivered in English. ABST Coach therefore presents the manual exclusively in English, but offers reading-level adaptation (original / simple B1 English / "explain like I'm 12") and sentence-level read-aloud to support comprehension without translating away the legal terminology students will be tested on.

## DEMO_MODE

Set `DEMO_MODE=true` in `.env.local` and the app runs entirely on canned data. **Use this for the backup video at 2 PM.** Every API route checks this flag first.

## What's stubbed vs. real

Everything works end-to-end with placeholder content. The real work is replacing the stubs in:

- `lib/bedrock.ts` — currently returns canned strings; swap for real Bedrock invokes
- `lib/abst.ts` — RAG retrieval over `data/abst_chunks.json`; the prep script populates this
- `app/api/transcribe/route.ts` — currently returns a mock transcript; wire to Transcribe batch (or streaming if time)
- `app/api/scenario/turn/route.ts` — orchestrates Transcribe → Bedrock → Polly; stubbed today

See each file's header comment for a TODO list.
