import { GoogleGenAI } from "@google/genai";

/**
 * Create the Gemini client once.
 *
 * The API key stays on the server.
 */
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

/**
 * Generate an embedding for a piece of text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",

    contents: text,

    config: {
      /**
       * 768 is more than enough for our current
       * semantic classification use case.
       */
      outputDimensionality: 768,
    },
  });

  const values = response.embeddings?.[0]?.values;

  if (!values || values.length === 0) {
    throw new Error("Gemini returned an empty embedding");
  }

  return values;
}
