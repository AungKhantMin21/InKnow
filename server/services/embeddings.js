import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

/** Returns a float array of 768 dimensions for pgvector storage */
export const generateEmbedding = async (text) => {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
};
