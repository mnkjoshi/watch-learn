import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { generateText, ChatMessage } from "../lib/bedrock";
import { TUTOR_CHAT, PATRON_ROLEPLAY } from "../lib/prompts";

async function test() {
  console.log("Testing Bedrock Foundation...");
  console.log(`DEMO_MODE is: ${process.env.DEMO_MODE}`);

  try {
    const messages: ChatMessage[] = [
      { role: "user", content: "What is the primary role of a security guard?" },
    ];

    console.log("\n1. Testing generateText with TUTOR_CHAT system prompt...");
    const res1 = await generateText(messages, TUTOR_CHAT);
    console.log("Response:", res1);

    console.log("\n2. Testing generateText with PATRON_ROLEPLAY system prompt...");
    const res2 = await generateText(
      [{ role: "user", content: "Tell me about trespass." }],
      PATRON_ROLEPLAY
    );
    console.log("Response:", res2);

    console.log("\nSUCCESS: Bedrock foundation is working as expected.");
  } catch (err) {
    console.error("\nFAILURE:", err);
    process.exit(1);
  }
}

test();