import { Router } from "express";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";

const router = Router();
router.use(auth);

// Guard — all routes below require is_manager=true
router.use((req, res, next) => {
  if (!req.employee.is_manager) {
    return res.status(403).json({
      data: null,
      error: "Forbidden",
      message: "We couldn't find that. Try going back.",
    });
  }
  next();
});

// GET /api/manager/stats — total approved articles, sessions this month, pending count
router.get("/stats", async (req, res, next) => {
  try {
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    ).toISOString();

    const [articlesRes, sessionsRes, pendingRes] = await Promise.all([
      supabase
        .from("knowledge_articles")
        .select("id", { count: "exact", head: true })
        .eq("approved", true),
      supabase
        .from("interrogation_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("completed_at", startOfMonth),
      supabase
        .from("knowledge_articles")
        .select("id", { count: "exact", head: true })
        .eq("approved", false)
        .eq("rejected", false),
    ]);

    res.json({
      data: {
        total_articles: articlesRes.count ?? 0,
        sessions_this_month: sessionsRes.count ?? 0,
        pending_approvals: pendingRes.count ?? 0,
      },
      error: null,
      message: null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/manager/coverage — article count and last capture per role
router.get("/coverage", async (req, res, next) => {
  try {
    const [rolesRes, articlesRes] = await Promise.all([
      supabase.from("roles").select("id, name, department").order("name"),
      supabase
        .from("knowledge_articles")
        .select("role_id, created_at")
        .eq("approved", true),
    ]);

    if (rolesRes.error) throw rolesRes.error;

    const articles = articlesRes.data || [];

    const coverage = (rolesRes.data || []).map((role) => {
      const roleArticles = articles.filter((a) => a.role_id === role.id);
      const sorted = roleArticles.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      return {
        ...role,
        article_count: roleArticles.length,
        last_capture: sorted[0]?.created_at ?? null,
      };
    });

    res.json({ data: { coverage }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

// GET /api/manager/pending — articles awaiting approval
router.get("/pending", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("knowledge_articles")
      .select(
        "id, title, summary, role_id, created_at, roles(name), capturer:employees!captured_by(name)",
      )
      .eq("approved", false)
      .eq("rejected", false)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ data: { articles: data || [] }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
