import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock";
import dotenv from "dotenv";

dotenv.config();

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

async function listModels() {
  console.log(`Listing Bedrock foundation models in ${region}...`);
  
  const client = new BedrockClient({ 
    region,
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    } : undefined
  });

  try {
    const command = new ListFoundationModelsCommand({});
    const response = await client.send(command);
    
    console.log("\nAll Available Foundation Models:");
    console.table(response.modelSummaries?.map(m => ({
      ModelName: m.modelName,
      ModelId: m.modelId,
      Input: m.inputModalities?.join(", "),
      Output: m.outputModalities?.join(", ")
    })));
  } catch (error) {
    console.error("Error listing models:", error);
    console.log("\nNote: Make sure your AWS credentials are set in .env or your environment.");
  }
}

listModels();
