import { Router } from "express";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";
import { enrichWithNames } from "../services/rag.js";
import { generateEmbedding } from "../services/embeddings.js";
import { expandQuery, buildCopilotPrompt, answerFromContext } from "../services/gemini.js";

const router = Router();
router.use(auth);

const detectQuestionType = (question) => {
  const broadPatterns = [
    "how do i", "how can i", "what is", "what are",
    "explain", "tell me about", "walk me through",
    "how does", "what should i", "give me",
    "overview", "describe", "everything about",
  ];
  const q = question.toLowerCase();
  return broadPatterns.some((p) => q.includes(p)) ? "broad" : "specific";
};

const calculateConfidence = (articles) => {
  if (!articles.length) return 0;
  return Math.min(100, Math.round(articles[0].similarity * 100));
};

const parseCitedSources = (answerText, articles) =>
  articles.filter((a) =>
    answerText.toLowerCase().includes(a.title.toLowerCase()),
  );

// TODO: chunked embeddings — articles currently stored
// as single vectors. Broad questions suffer because
// dense articles average across all topics.
// Next improvement: chunk articles at ~150 words
// with 30-word overlap, embed each chunk separately.

// POST /api/copilot/query — expand query, embed variants, retrieve and merge, generate answer
router.post("/query", async (req, res, next) => {
  try {
    const { question } = req.body;

    if (!question?.trim()) {
      return res.status(400).json({
        data: null,
        error: "Missing question",
        message: "We need this to continue.",
      });
    }

    const q = question.trim();
    const questionType = detectQuestionType(q);
    const matchCount = questionType === "broad" ? 7 : 3;
    const matchThreshold = questionType === "broad" ? 0.35 : 0.4;

    // Expand query into multiple variants for broader retrieval coverage
    const queries = await expandQuery(q);

    // Embed all query variants in parallel
    const embeddings = await Promise.all(queries.map((qv) => generateEmbedding(qv)));

    // Search with each embedding in parallel
    const allResults = await Promise.all(
      embeddings.map((embedding) =>
        supabase.rpc("match_articles", {
          query_embedding: embedding,
          match_threshold: matchThreshold,
          match_count: matchCount,
        }),
      ),
    );

    // Merge and deduplicate — keep highest similarity per article
    const seen = new Map();
    for (const { data, error } of allResults) {
      if (error || !data) continue;
      for (const article of data) {
        const existing = seen.get(article.id);
        if (!existing || article.similarity > existing.similarity) {
          seen.set(article.id, article);
        }
      }
    }

    // Sort by similarity descending, cap at matchCount
    const rawArticles = Array.from(seen.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, matchCount);

    const articles = await enrichWithNames(rawArticles);

    let answer = null;
    let confidence = 0;

    if (articles.length > 0) {
      const prompt = buildCopilotPrompt(q, articles, questionType);
      answer = await answerFromContext(prompt);
      confidence = calculateConfidence(articles);
    }

    // Gemini may return gap language even when articles were retrieved —
    // it means the retrieved articles weren't relevant enough to answer.
    // Normalise those cases to a true gap state so the client renders
    // the gap UI rather than a low-confidence "answer" with sources.
    const GAP_PHRASES = ["nobody has captured", "nobody's captured", "nobody captured"];
    const isGap = !answer || GAP_PHRASES.some((p) => answer.toLowerCase().includes(p));
    if (isGap) {
      answer = null;
      confidence = 0;
    }

    const cited = isGap ? [] : parseCitedSources(answer, articles);
    const sources = cited.map((a) => ({
      id: a.id,
      title: a.title,
      captured_by_name: a.captured_by_name,
      created_at: a.created_at,
      similarity: a.similarity,
    }));

    const { data: saved, error: saveErr } = await supabase
      .from("copilot_queries")
      .insert({
        employee_id: req.employee.id,
        question: q,
        answer,
        source_article_ids: articles.map((a) => a.id),
        confidence_score: confidence,
      })
      .select("id")
      .single();

    if (saveErr) console.error("[COPILOT] Failed to save query:", saveErr.message);

    res.json({
      data: {
        answer,
        sources,
        confidence,
        query_id: saved?.id ?? null,
      },
      error: null,
      message: null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/copilot/feedback — record helpful / not helpful signal
router.post("/feedback", async (req, res, next) => {
  try {
    const { query_id, feedback } = req.body;

    if (!query_id || ![1, -1].includes(feedback)) {
      return res.status(400).json({
        data: null,
        error: "Invalid feedback",
        message: "We need this to continue.",
      });
    }

    const { error } = await supabase
      .from("copilot_queries")
      .update({ feedback })
      .eq("id", query_id)
      .eq("employee_id", req.employee.id);

    if (error) throw error;

    res.json({ data: null, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
