import { Router } from "express";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";

const router = Router();
router.use(auth);

// Guard — requires is_manager=true AND a group assignment
router.use((req, res, next) => {
  if (!req.employee.is_manager || !req.employee.group_id) {
    return res.status(403).json({
      data: null,
      error: "Forbidden",
      message: "We couldn't find that. Try going back.",
    });
  }
  next();
});

// GET /api/manager/stats — article, session, and pending counts for manager's group
router.get("/stats", async (req, res, next) => {
  try {
    const gid = req.employee.group_id;
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    ).toISOString();

    const [articlesRes, sessionsRes, pendingRes] = await Promise.all([
      supabase
        .from("knowledge_articles")
        .select("id", { count: "exact", head: true })
        .eq("approved", true)
        .eq("group_id", gid),
      supabase
        .from("interrogation_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .eq("group_id", gid)
        .gte("completed_at", startOfMonth),
      supabase
        .from("knowledge_articles")
        .select("id", { count: "exact", head: true })
        .eq("approved", false)
        .eq("rejected", false)
        .eq("group_id", gid),
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

// GET /api/manager/coverage — article count per job_title in manager's group
router.get("/coverage", async (req, res, next) => {
  try {
    const gid = req.employee.group_id;

    const [employeesRes, articlesRes] = await Promise.all([
      supabase
        .from("employees")
        .select("id, name, job_title")
        .eq("group_id", gid),
      supabase
        .from("knowledge_articles")
        .select("captured_by, created_at")
        .eq("group_id", gid)
        .eq("approved", true),
    ]);

    if (employeesRes.error) throw employeesRes.error;

    const employees = employeesRes.data || [];
    const articles = articlesRes.data || [];

    // Build a map of job_title → articles captured by employees with that title
    const titleMap = new Map();
    for (const emp of employees) {
      const title = emp.job_title || "Unknown Role";
      if (!titleMap.has(title)) titleMap.set(title, []);
    }
    for (const article of articles) {
      const emp = employees.find((e) => e.id === article.captured_by);
      const title = emp?.job_title || "Unknown Role";
      if (!titleMap.has(title)) titleMap.set(title, []);
      titleMap.get(title).push(article);
    }

    const coverage = Array.from(titleMap.entries()).map(([job_title, jobArticles]) => {
      const sorted = [...jobArticles].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      return {
        job_title,
        article_count: jobArticles.length,
        last_capture: sorted[0]?.created_at ?? null,
      };
    });

    res.json({ data: { coverage }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

// GET /api/manager/pending — articles awaiting approval in manager's group
router.get("/pending", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("knowledge_articles")
      .select(
        "id, title, summary, group_id, created_at, groups(name), capturer:employees!captured_by(name)",
      )
      .eq("approved", false)
      .eq("rejected", false)
      .eq("group_id", req.employee.group_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ data: { articles: data || [] }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

/** GET /api/manager/gaps — open knowledge gaps for the manager's own group */
router.get("/gaps", async (req, res, next) => {
  try {
    const { data: gaps, error } = await supabase
      .from("knowledge_gaps")
      .select("id, topic, original_question, status, created_at, employee_id, employees(name)")
      .eq("group_id", req.employee.group_id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const enriched = (gaps || []).map((g) => ({
      id: g.id,
      topic: g.topic,
      original_question: g.original_question,
      status: g.status,
      created_at: g.created_at,
      employee_name: g.employees?.name || "Unknown",
    }));

    res.json({ data: { gaps: enriched }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
