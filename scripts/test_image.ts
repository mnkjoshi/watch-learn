import dotenv from "dotenv";
dotenv.config();

import { generateImage } from "../lib/bedrock";
import fs from "fs";

async function testImage() {
  console.log("Testing Bedrock Image Generation...");
  console.log(`Model: ${process.env.BEDROCK_IMAGE_MODEL}`);
  console.log(`DEMO_MODE: ${process.env.DEMO_MODE}`);

  const prompt = "A photorealistic security guard standing at a mall entrance, high-visibility vest, cinematic lighting";
  
  try {
    console.log(`\nGenerating image for prompt: "${prompt}"...`);
    const base64Data = await generateImage(prompt, { aspect_ratio: "16:9" });
    
    // Strip the data:image/png;base64, prefix
    const base64 = base64Data.split(",")[1];
    const buffer = Buffer.from(base64, "base64");
    
    const filename = "test_image.png";
    fs.writeFileSync(filename, buffer);
    
    console.log(`\nSUCCESS: Image saved to ${filename}`);
    console.log("(Note: In DEMO_MODE, this will be a 1x1 gray pixel.)");
  } catch (err) {
    console.error("\nFAILURE:", err);
    process.exit(1);
  }
}

testImage();
