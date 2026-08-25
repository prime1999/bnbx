import { GoogleGenAI } from "@google/genai";
import { StructuredIntent } from "../agents/types";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Parses natural language queries into structured search targets using Gemini
export async function extractUserIntent(
  userQuery: string,
): Promise<StructuredIntent> {
  const prompt = `
Analyze this user query for an AI Agent Marketplace on BNB Chain: "${userQuery}"

Extract structured search criteria into JSON matching this exact structure:
{
  "goal": "A short summary of what the user wants to accomplish",
  "assets": ["Array of crypto assets mentioned like USDT, ETH, BNB, or empty if none"],
  "riskTolerance": "low" | "medium" | "high",
  "targetCategory": "yield_optimization" | "grid_trading" | "rebalancing" | "health_factor_monitoring" | "general"
}

Return ONLY raw JSON. No markdown backticks.
  `.trim();

  try {
    // Call Gemini to parse query intent
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
    });

    const responseText = response.text || "{}";

    // Clean JSON response string from potential formatting markups
    const cleanedJson = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanedJson);

    return {
      goal: parsed.goal || userQuery,
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      riskTolerance: parsed.riskTolerance || "medium",
      targetCategory: parsed.targetCategory || "general",
    };
  } catch (error) {
    console.error(
      "[Intent Parser Error] Failed to parse intent, falling back:",
      error,
    );

    // Default fallback intent if parsing fails
    return {
      goal: userQuery,
      assets: [],
      riskTolerance: "medium",
      targetCategory: "general",
    };
  }
}
