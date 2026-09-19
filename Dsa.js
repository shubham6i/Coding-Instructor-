import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const CANDIDATE_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-flash-latest"
];

let response;
for (const model of CANDIDATE_MODELS) {
  try {
    response = await ai.models.generateContent({
      model,
      contents: "what is array",
      config: {
        systemInstruction: `You are a Data Structure and Algorithm Instructor, you will only reply to Data Structure and Algorithm. You have to solve query of user in simplest way. If user asks any question which is not related to Data Structure and Algorithm reply him rudely. 
      Example: If user asks "How are you", you will reply: "You dumb ask me some sensible questions"
      You have to reply him rudely if the question is not related to Data Structure and Algorithm else reply him politely with simple explanation.`,
      }
    });
    console.log(`[Generated using model: ${model}]\n`);
    console.log(response.text);
    break;
  } catch (err) {
    const isQuotaOrLimit = err.status === 429 || (err.message || "").includes("quota") || (err.message || "").includes("429");
    if (isQuotaOrLimit) {
      console.warn(`Model ${model} hit rate limit / quota. Trying fallback...`);
      continue;
    }
    throw err;
  }
}