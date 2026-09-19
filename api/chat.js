import { GoogleGenAI } from "@google/genai";

const CANDIDATE_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-flash-latest"
];

const systemInstruction = `You are a Coding Instructor, who answer only to coding related problem. If user ask you anything that is not related to coding, reply him rudely like you are dumb person. But if he/she ask problem related to coding response in a detail manner.`;

async function getRequestBody(req) {
  if (req.body) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }

  return new Promise((resolve) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function sendJson(res, statusCode, data) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(statusCode).json(data);
  }
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") {
      return res.status(204).end();
    }
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const parsedBody = await getRequestBody(req);
    const message = parsedBody?.message;

    if (!message || !message.trim()) {
      return sendJson(res, 400, { error: "Please enter a coding question first!" });
    }

    const apiKeys = (process.env.GEMINI_API_KEY || "")
      .split(",")
      .map(k => k.trim())
      .filter(Boolean);

    if (apiKeys.length === 0) {
      return sendJson(res, 500, { error: "GEMINI_API_KEY is not configured in environment variables!" });
    }

    let response = null;
    let lastError = null;
    let usedModel = null;

    outerLoop:
    for (const key of apiKeys) {
      const ai = new GoogleGenAI({ apiKey: key });

      for (const model of CANDIDATE_MODELS) {
        try {
          console.log(`[AI] Requesting answer using model: ${model}...`);
          response = await ai.models.generateContent({
            model,
            contents: message.trim(),
            config: {
              systemInstruction
            }
          });

          if (response && response.text) {
            usedModel = model;
            console.log(`[AI] Successfully answered using model: ${model}`);
            break outerLoop;
          }
        } catch (err) {
          lastError = err;
          const errStr = (err.message || "").toLowerCase();
          const isQuotaOrRateLimit = err.status === 429 || errStr.includes("429") || errStr.includes("quota") || errStr.includes("resource_exhausted");
          const isUnavailable = err.status === 503 || errStr.includes("503") || errStr.includes("high demand") || errStr.includes("unavailable");
          const isNotFound = err.status === 404 || errStr.includes("404") || errStr.includes("not found");

          if (isQuotaOrRateLimit || isUnavailable || isNotFound) {
            console.warn(`[AI] ${model} unavailable (Code: ${err.status || 'Quota/Limit'}). Trying fallback model...`);
            continue;
          } else {
            console.error(`[AI] Error with ${model}:`, err.message);
            break outerLoop;
          }
        }
      }
    }

    if (!response || !response.text) {
      if (lastError) throw lastError;
      throw new Error("Unable to generate response from any available model.");
    }

    return sendJson(res, 200, { answer: response.text, model: usedModel });
  } catch (err) {
    console.error("AI Generation Error:", err);
    let userMessage = "Failed to generate answer. Please try again.";
    const raw = err.message || "";
    if (raw.includes("429") || raw.includes("quota") || raw.includes("RESOURCE_EXHAUSTED")) {
      userMessage = "⚠️ All free-tier model quotas reached for today. Please wait for the daily quota to reset or generate a fresh free key on Google AI Studio.";
    } else if (raw.includes("503") || raw.includes("high demand") || raw.includes("UNAVAILABLE")) {
      userMessage = "⚠️ Google AI servers are experiencing temporary high demand. Please try again in a few moments.";
    } else if (err.status) {
      userMessage = `API Error (${err.status}): Please try again shortly.`;
    }

    return sendJson(res, 500, { error: userMessage });
  }
}
