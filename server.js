import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY) {
  console.error("Warning: GEMINI_API_KEY is not set in .env!");
}

// Candidate models in fallback order
const CANDIDATE_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-flash-latest"
];

const systemInstruction = `You are a Coding Instructor, who answer only to coding related problem. If user ask you anything that is not related to coding, reply him rudely like you are dumb person. But if he/she ask problem related to coding response in a detail manner.`;

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  // API Endpoint: POST /api/chat
  if (req.method === "POST" && parsedUrl.pathname === "/api/chat") {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const { message } = JSON.parse(body || "{}");
        if (!message || !message.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Please enter a coding question first!" }));
          return;
        }

        const apiKeys = (process.env.GEMINI_API_KEY || "")
          .split(",")
          .map(k => k.trim())
          .filter(Boolean);

        if (apiKeys.length === 0) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "GEMINI_API_KEY is not configured in .env!" }));
          return;
        }

        let response = null;
        let lastError = null;
        let usedModel = null;

        // Try keys and fallback models automatically
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
                continue; // try next candidate model
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

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ answer: response.text, model: usedModel }));
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

        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: userMessage }));
      }
    });
    return;
  }

  // Serve static files (HTML, JS, CSS)
  let filePath = path.join(__dirname, parsedUrl.pathname === "/" ? "index.html" : parsedUrl.pathname);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(__dirname, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml"
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end("Server Error");
        return;
      }
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Coding Instructor server running at http://localhost:${PORT}`);
});
