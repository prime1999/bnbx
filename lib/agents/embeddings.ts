import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client with API key from environment variables
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// In-memory cache store mapping text strings to pre-computed vector arrays
const embeddingCache = new Map<string, number[]>();

// Generates vector embeddings for a given string input using Gemini
export async function generateEmbedding(text: string): Promise<number[]> {
  // Normalize text input by trimming whitespace and converting to lowercase for cache lookup
  const normalizedText = text.trim().toLowerCase();

  // Return cached embedding vector if it already exists in memory to save API costs
  if (embeddingCache.has(normalizedText)) {
    return embeddingCache.get(normalizedText)!;
  }

  try {
    // Call Gemini API to generate vector content embeddings using text-embedding-004
    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
    });

    // Extract raw vector float numbers from response object
    const vector = response.embeddings?.[0]?.values ?? [];

    // Store vector in memory cache if valid vector was produced
    if (vector.length > 0) {
      embeddingCache.set(normalizedText, vector);
    }

    // Return numerical vector array
    return vector;
  } catch (error) {
    // Log embedding generation error for diagnostics
    console.error("[Embedding Error] Failed to generate vector:", error);

    // Return empty array on failure
    return [];
  }
}
