import { Router } from "express";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";
import { generateEmbedding } from "../services/embeddings.js";

const router = Router();
router.use(auth);

// POST /api/knowledge — save a reviewed article with its embedding
router.post("/", async (req, res, next) => {
  try {
    const { role_id, session_id, title, summary, content, tags } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({
        data: null,
        error: "Missing fields",
        message: "We need this to continue.",
      });
    }

    const embeddingText = [title, summary, content].filter(Boolean).join(" ");
    const embedding = await generateEmbedding(embeddingText);

    const { data: article, error } = await supabase
      .from("knowledge_articles")
      .insert({
        role_id,
        session_id,
        title: title.trim(),
        summary: summary?.trim() || null,
        content: content.trim(),
        tags: tags || [],
        approved: false,
        captured_by: req.employee.id,
        embedding,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data: { article }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
