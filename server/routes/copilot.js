import { Router } from "express";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";
import { retrieveArticles } from "../services/rag.js";
import { buildCopilotPrompt, answerFromContext } from "../services/gemini.js";

const router = Router();
router.use(auth);

// POST /api/copilot/query — embed question, retrieve articles, generate answer
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

    const articles = await retrieveArticles(question.trim());

    let answer = null;
    let confidence = 0;

    if (articles.length > 0) {
      const prompt = buildCopilotPrompt(question.trim(), articles);
      answer = await answerFromContext(prompt);
      confidence = articles[0].similarity ?? 0;
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

    const sources = isGap
      ? []
      : articles.map((a) => ({
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
        question: question.trim(),
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
