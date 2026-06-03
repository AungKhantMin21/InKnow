import supabase from "../db/supabase.js";
import { generateEmbedding } from "./embeddings.js";

/**
 * Embeds the question, runs vector similarity search, and returns
 * matching articles enriched with capturer name and similarity score.
 */
export const retrieveArticles = async (question, matchCount = 3) => {
  const embedding = await generateEmbedding(question);

  const { data: matches, error } = await supabase.rpc("match_articles", {
    query_embedding: embedding,
    match_threshold: 0.4,
    match_count: matchCount,
  });

  if (error) throw error;
  if (!matches?.length) return [];

  const capturerIds = [...new Set(matches.map((m) => m.captured_by).filter(Boolean))];

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name")
    .in("id", capturerIds);

  const nameMap = (employees || []).reduce((acc, e) => {
    acc[e.id] = e.name;
    return acc;
  }, {});

  return matches.map((m) => ({
    ...m,
    captured_by_name: nameMap[m.captured_by] || "Unknown",
  }));
};
