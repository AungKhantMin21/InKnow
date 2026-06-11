import { Router } from "express";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";
import { generateEmbedding } from "../services/embeddings.js";

const router = Router();
router.use(auth);

// POST /api/knowledge — save a reviewed article with its embedding
router.post("/", async (req, res, next) => {
  try {
    const { session_id, title, summary, content, tags } = req.body;

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
        group_id: req.employee.group_id,
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

// GET /api/knowledge — list approved articles scoped to own group + public
router.get("/", async (req, res, next) => {
  try {
    const { group_id, search } = req.query;

    let query = supabase
      .from("knowledge_articles")
      .select(
        "id, title, summary, tags, group_id, visibility, is_core, captured_by, view_count, created_at, groups(name), capturer:employees!captured_by(name)",
      )
      .eq("approved", true)
      .eq("rejected", false)
      .order("created_at", { ascending: false });

    if (req.employee.group_id) {
      query = query.or(`group_id.eq.${req.employee.group_id},visibility.eq.public`);
    } else {
      query = query.eq("visibility", "public");
    }

    if (group_id) query = query.eq("group_id", group_id);
    if (search) query = query.ilike("title", `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ data: { articles: data }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

// GET /api/knowledge/:id — return one article with group scoping enforced
router.get("/:id", async (req, res, next) => {
  try {
    let query = supabase
      .from("knowledge_articles")
      .select("*, groups(name), capturer:employees!captured_by(name)")
      .eq("id", req.params.id);

    if (req.employee.is_manager && req.employee.group_id) {
      // Managers can see their own group's articles (all approval states) + approved public
      query = query.or(
        `group_id.eq.${req.employee.group_id},visibility.eq.public`,
      );
    } else if (req.employee.group_id) {
      // Employees see approved only, own group + public
      query = query.eq("approved", true).or(
        `group_id.eq.${req.employee.group_id},visibility.eq.public`,
      );
    } else {
      // Admin without group: approved public articles only
      query = query.eq("approved", true).eq("visibility", "public");
    }

    const { data: article, error } = await query.single();

    if (error || !article) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    if (article.approved) {
      supabase
        .from("knowledge_articles")
        .update({ view_count: (article.view_count || 0) + 1 })
        .eq("id", req.params.id)
        .then(() => {})
        .catch(() => {});
    }

    res.json({ data: { article }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/knowledge/:id — update article (author only)
router.patch("/:id", async (req, res, next) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("knowledge_articles")
      .select("captured_by")
      .eq("id", req.params.id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    if (existing.captured_by !== req.employee.id) {
      return res.status(403).json({
        data: null,
        error: "Forbidden",
        message: "We couldn't find that. Try going back.",
      });
    }

    const { title, summary, content, tags } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (title?.trim()) updates.title = title.trim();
    if (summary !== undefined) updates.summary = summary?.trim() || null;
    if (content?.trim()) updates.content = content.trim();
    if (tags) updates.tags = tags;

    const { data: updated, error: updateErr } = await supabase
      .from("knowledge_articles")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ data: { article: updated }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

// POST /api/knowledge/update — save a new version of an existing article (author only)
router.post("/update", async (req, res, next) => {
  try {
    const { article_id, title, content, update_reason, session_id } = req.body;

    if (!article_id || !content?.trim()) {
      return res.status(400).json({
        data: null,
        error: "Missing fields",
        message: "We need this to continue.",
      });
    }

    const { data: current, error: fetchErr } = await supabase
      .from("knowledge_articles")
      .select("*")
      .eq("id", article_id)
      .single();

    if (fetchErr || !current) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    if (current.captured_by !== req.employee.id) {
      return res.status(403).json({
        data: null,
        error: "Forbidden",
        message: "We couldn't find that. Try going back.",
      });
    }

    const newTitle = title?.trim() || current.title;
    const embeddingText = [newTitle, current.summary, content.trim()].filter(Boolean).join(" ");
    const embedding = await generateEmbedding(embeddingText);

    const { data: updated, error: updateErr } = await supabase
      .from("knowledge_articles")
      .update({
        title: newTitle,
        content: content.trim(),
        update_reason: update_reason || null,
        previous_content: current.content,
        previous_title: current.title,
        version: (current.version || 1) + 1,
        approved: false,
        approved_by: null,
        approved_at: null,
        embedding,
        updated_at: new Date().toISOString(),
        updated_from_session_id: session_id || null,
      })
      .eq("id", article_id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ data: { article: updated }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/knowledge/:id/approve — manager only
router.patch("/:id/approve", async (req, res, next) => {
  try {
    if (!req.employee.is_manager) {
      return res.status(403).json({
        data: null,
        error: "Forbidden",
        message: "We couldn't find that. Try going back.",
      });
    }

    const { data: article, error } = await supabase
      .from("knowledge_articles")
      .update({
        approved: true,
        approved_by: req.employee.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .eq("group_id", req.employee.group_id)
      .select()
      .single();

    if (error || !article) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    res.json({ data: { article }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/knowledge/:id/reject — manager only, soft delete
router.patch("/:id/reject", async (req, res, next) => {
  try {
    if (!req.employee.is_manager) {
      return res.status(403).json({
        data: null,
        error: "Forbidden",
        message: "We couldn't find that. Try going back.",
      });
    }

    const { error } = await supabase
      .from("knowledge_articles")
      .update({ rejected: true })
      .eq("id", req.params.id)
      .eq("group_id", req.employee.group_id);

    if (error) throw error;

    res.json({ data: null, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
