import { Router } from "express";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = Router();
router.use(auth);
router.use(requireAdmin);

/** GET /api/admin/stats — platform-wide counts only, no private content */
router.get("/stats", async (req, res, next) => {
  try {
    const [
      employeesRes,
      groupsRes,
      articlesRes,
      sessionsRes,
      pendingRes,
      coreRes,
    ] = await Promise.all([
      supabase.from("employees").select("id", { count: "exact", head: true }),
      supabase
        .from("groups")
        .select("id", { count: "exact", head: true })
        .eq("archived", false),
      supabase
        .from("knowledge_articles")
        .select("id", { count: "exact", head: true })
        .eq("approved", true)
        .eq("rejected", false),
      supabase
        .from("interrogation_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      supabase
        .from("knowledge_articles")
        .select("id", { count: "exact", head: true })
        .eq("approved", false)
        .eq("rejected", false),
      supabase
        .from("knowledge_articles")
        .select("id", { count: "exact", head: true })
        .eq("is_core", true),
    ]);

    res.json({
      data: {
        total_employees: employeesRes.count ?? 0,
        total_groups: groupsRes.count ?? 0,
        total_articles: articlesRes.count ?? 0,
        total_sessions: sessionsRes.count ?? 0,
        pending_approvals: pendingRes.count ?? 0,
        core_articles: coreRes.count ?? 0,
      },
      error: null,
      message: null,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/employees — all employees with group name */
router.get("/employees", async (req, res, next) => {
  try {
    const { search } = req.query;

    let query = supabase
      .from("employees")
      .select("id, name, email, job_title, is_manager, is_admin, group_id, created_at")
      .order("name", { ascending: true });

    if (search?.trim()) {
      query = query.or(
        `name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`,
      );
    }

    const { data: employees, error } = await query;
    if (error) throw error;

    // Fetch group names separately to avoid FK join cache dependency
    const groupIds = [...new Set((employees || []).map((e) => e.group_id).filter(Boolean))];
    let groupNames = {};
    if (groupIds.length > 0) {
      const { data: groups } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", groupIds);
      for (const g of groups || []) {
        groupNames[g.id] = g.name;
      }
    }

    const enriched = (employees || []).map((e) => ({
      ...e,
      group_name: e.group_id ? (groupNames[e.group_id] || null) : null,
    }));

    res.json({ data: { employees: enriched }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/admin/employees/:id/role — update role flags, group, or job_title */
router.patch("/employees/:id/role", async (req, res, next) => {
  try {
    const { is_manager, is_admin, group_id, job_title } = req.body;

    const updates = {};
    if (is_manager !== undefined) updates.is_manager = Boolean(is_manager);
    if (is_admin !== undefined) updates.is_admin = Boolean(is_admin);
    if (group_id !== undefined) updates.group_id = group_id || null;
    if (job_title !== undefined) updates.job_title = job_title?.trim() || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        data: null,
        error: "Missing fields",
        message: "We need this to continue.",
      });
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .update(updates)
      .eq("id", req.params.id)
      .select("id, name, email, job_title, is_manager, is_admin, group_id")
      .single();

    if (error || !employee) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    res.json({ data: { employee }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
