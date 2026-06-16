import supabase from "../db/supabase.js";
import { generateEmbedding } from "./embeddings.js";
import {
  generateProvisionalTitle,
  formatConversation,
  scoreArticleQuality,
} from "./gemini.js";

/** Generate and save the embedding for an article saved without one */
export const embedArticle = async (articleId) => {
  const { data: article, error } = await supabase
    .from("knowledge_articles")
    .select("id, title, summary, content")
    .eq("id", articleId)
    .single();

  if (error || !article) throw new Error(`Article ${articleId} not found`);

  const embeddingText = [article.title, article.summary, article.content]
    .filter(Boolean)
    .join(" ");
  const embedding = await generateEmbedding(embeddingText);

  const { error: updateErr } = await supabase
    .from("knowledge_articles")
    .update({ embedding })
    .eq("id", articleId);

  if (updateErr) throw updateErr;

  return { articleId, embedded: true };
};

/** Score an article's quality after approval and save the result */
export const scoreArticle = async (articleId) => {
  const { data: article, error } = await supabase
    .from("knowledge_articles")
    .select("id, title, content")
    .eq("id", articleId)
    .single();

  if (error || !article) throw new Error(`Article ${articleId} not found`);

  const score = await scoreArticleQuality(article.title, article.content);
  if (score === null) return { articleId, scored: false };

  const { error: updateErr } = await supabase
    .from("knowledge_articles")
    .update({ quality_score: score })
    .eq("id", articleId);

  if (updateErr) throw updateErr;

  return { articleId, quality_score: score };
};

/** Generate a provisional title for a session at the 3-exchange mark */
export const generateTitle = async (sessionId) => {
  const { data: messages, error } = await supabase
    .from("session_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error || !messages?.length) throw new Error(`Session ${sessionId} messages not found`);

  const title = await generateProvisionalTitle(formatConversation(messages));

  const { error: updateErr } = await supabase
    .from("interrogation_sessions")
    .update({ title, title_generated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (updateErr) throw updateErr;

  return { sessionId, title };
};
