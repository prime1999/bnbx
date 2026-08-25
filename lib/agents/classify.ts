import { GoogleGenAI } from "@google/genai";
import { RawAgent } from "./scoring";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export type AgentCategory =
  | "rebalancing"
  | "grid_trading"
  | "yield_optimization"
  | "health_factor_monitoring"
  | "general";

export interface ClassificationResult {
  category: AgentCategory;
  confidenceScore: number;
  categorySimilarity: number;
}

export async function classifyAgent(
  agent: RawAgent,
): Promise<ClassificationResult> {
  const file = agent.registrationFile;
  const textContext = `
    Name: ${file?.name || "Unknown"}
    Description: ${file?.description || "None"}
    Tools: ${(file?.mcpTools || []).join(", ")}
    Skills: ${(file?.a2aSkills || []).join(", ")}
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
        Classify this Web3 AI agent into exactly ONE of these categories:
        ["rebalancing", "grid_trading", "yield_optimization", "health_factor_monitoring", "general"].

        Return ONLY a JSON object with this shape:
        {
          "category": "category_name",
          "confidenceScore": 85,
          "categorySimilarity": 0.92
        }

        Agent context to analyze:
        ${textContext}
      `,
    });

    const cleanJsonText = (response.text || "")
      .replace(/```json|```/g, "")
      .trim();
    const parsed = JSON.parse(cleanJsonText);

    return {
      category: parsed.category || "general",
      confidenceScore:
        typeof parsed.confidenceScore === "number"
          ? parsed.confidenceScore
          : 70,
      categorySimilarity:
        typeof parsed.categorySimilarity === "number"
          ? parsed.categorySimilarity
          : 0.7,
    };
  } catch (error) {
    // Fallback if AI generation encounters an error or timeout
    return {
      category: "general",
      confidenceScore: 50,
      categorySimilarity: 0.5,
    };
  }
}
