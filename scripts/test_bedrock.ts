import dotenv from "dotenv";
dotenv.config();

import { chatCompletion, generateText } from "../lib/bedrock";

async function test() {
  console.log("Testing Bedrock Foundation...");
  console.log(`DEMO_MODE is: ${process.env.DEMO_MODE}`);

  try {
    const messages = [
      { role: "system", content: "You are a helpful assistant. [TUTOR_CHAT]" },
      { role: "user", content: "What is the primary role of a security guard?" }
    ];

    console.log("\n1. Testing chatCompletion...");
    const res1 = await chatCompletion(messages);
    console.log("Response:", res1);

    console.log("\n2. Testing generateText (convenience wrapper)...");
    const res2 = await generateText(
      [{ role: "user", content: "Tell me about trespass." }],
      "You are roleplaying a patron. [PATRON_ROLEPLAY]"
    );
    console.log("Response:", res2);

    console.log("\nSUCCESS: Bedrock foundation is working as expected in DEMO_MODE.");
  } catch (err) {
    console.error("\nFAILURE:", err);
    process.exit(1);
  }
}

test();
