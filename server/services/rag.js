import supabase from "../db/supabase.js";
import { generateEmbedding } from "./embeddings.js";

/** Enriches article matches with capturer names from the employees table */
export const enrichWithNames = async (matches) => {
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

/**
 * Embed a query and run a group-scoped vector similarity search.
 * Returns raw article matches (no name enrichment) so the caller
 * can decide how much content to load.
 */
export const retrieveArticles = async (query, groupId, threshold = 0.45) => {
  const embedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_articles", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 5,
    requesting_group: groupId || null,
  });

  if (error) throw error;
  return data || [];
};

/** Fetch a single article by ID, enforcing group privacy boundary.
 *  Returns enriched object with captured_by_name and group_name. */
export const getArticleById = async (articleId, groupId) => {
  const { data, error } = await supabase
    .from("knowledge_articles")
    .select("id, title, content, visibility, group_id, captured_by")
    .eq("id", articleId)
    .eq("approved", true)
    .eq("rejected", false)
    .single();

  if (error || !data) return null;

  if (data.group_id !== groupId && data.visibility !== "public") return null;

  const [employeeRes, groupRes] = await Promise.all([
    data.captured_by
      ? supabase.from("employees").select("name").eq("id", data.captured_by).single()
      : Promise.resolve({ data: null }),
    data.group_id
      ? supabase.from("groups").select("name").eq("id", data.group_id).single()
      : Promise.resolve({ data: null }),
  ]);

  return {
    id: data.id,
    title: data.title,
    content: data.content,
    captured_by_name: employeeRes.data?.name || "Unknown",
    group_name: groupRes.data?.name || null,
  };
};

/** Write a knowledge gap record for manager review. */
export const flagGap = async ({ topic, originalQuestion, employeeId, groupId }) => {
  await supabase.from("knowledge_gaps").insert({
    topic,
    original_question: originalQuestion,
    employee_id: employeeId,
    group_id: groupId,
    status: "open",
  });
};
