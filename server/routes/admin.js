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

/** GET /api/admin/llm-usage — token counts and estimated cost by group and by day */
router.get("/llm-usage", async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from("llm_calls")
      .select("id, group_id, call_type, model, prompt_tokens, completion_tokens, cached_tokens, agent_steps, tool_calls_made, latency_ms, created_at, groups(name)")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Rough Gemini cost estimate: $0.10/1M input, $0.40/1M output, $0.025/1M cached
    const estimateCost = (prompt, completion, cached) =>
      ((prompt || 0) / 1_000_000) * 0.10 +
      ((completion || 0) / 1_000_000) * 0.40 +
      ((cached || 0) / 1_000_000) * 0.025;

    // Aggregate by group
    const groupMap = {};
    for (const r of rows || []) {
      const key = r.group_id || "none";
      if (!groupMap[key]) {
        groupMap[key] = {
          group_id: r.group_id,
          group_name: r.groups?.name || "Unknown",
          total_calls: 0,
          total_prompt_tokens: 0,
          total_completion_tokens: 0,
          estimated_cost_usd: 0,
        };
      }
      groupMap[key].total_calls++;
      groupMap[key].total_prompt_tokens += r.prompt_tokens || 0;
      groupMap[key].total_completion_tokens += r.completion_tokens || 0;
      groupMap[key].estimated_cost_usd += estimateCost(r.prompt_tokens, r.completion_tokens, r.cached_tokens);
    }

    // Aggregate by day
    const dayMap = {};
    for (const r of rows || []) {
      const day = r.created_at.slice(0, 10);
      if (!dayMap[day]) {
        dayMap[day] = { date: day, total_calls: 0, total_prompt_tokens: 0, total_completion_tokens: 0, estimated_cost_usd: 0 };
      }
      dayMap[day].total_calls++;
      dayMap[day].total_prompt_tokens += r.prompt_tokens || 0;
      dayMap[day].total_completion_tokens += r.completion_tokens || 0;
      dayMap[day].estimated_cost_usd += estimateCost(r.prompt_tokens, r.completion_tokens, r.cached_tokens);
    }

    const by_group = Object.values(groupMap).map((g) => ({
      ...g,
      estimated_cost_usd: parseFloat(g.estimated_cost_usd.toFixed(4)),
    }));
    const by_day = Object.values(dayMap)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((d) => ({ ...d, estimated_cost_usd: parseFloat(d.estimated_cost_usd.toFixed(4)) }));

    const recent_calls = (rows || []).slice(0, 20).map((r) => ({
      id: r.id,
      call_type: r.call_type,
      group_name: r.groups?.name || "Unknown",
      agent_steps: r.agent_steps || 1,
      tool_calls_made: r.tool_calls_made || 0,
      latency_ms: r.latency_ms || 0,
      created_at: r.created_at,
    }));

    res.json({
      data: { by_group, by_day, recent_calls, total_calls: (rows || []).length },
      error: null,
      message: null,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/gaps — all open knowledge gaps with employee and group info */
router.get("/gaps", async (req, res, next) => {
  try {
    const { data: gaps, error } = await supabase
      .from("knowledge_gaps")
      .select("id, topic, original_question, status, created_at, employee_id, group_id, employees(name), groups(name)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const enriched = (gaps || []).map((g) => ({
      id: g.id,
      topic: g.topic,
      original_question: g.original_question,
      status: g.status,
      created_at: g.created_at,
      employee_name: g.employees?.name || "Unknown",
      group_name: g.groups?.name || "Unknown",
    }));

    res.json({ data: { gaps: enriched }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/agent-traces/:jobId — tool call log for a specific job */
router.get("/agent-traces/:jobId", async (req, res, next) => {
  try {
    const { data: llmCall, error: callErr } = await supabase
      .from("llm_calls")
      .select("*")
      .eq("job_id", req.params.jobId)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (callErr || !llmCall) {
      return res.json({ data: { llm_call: null, tool_calls: [] }, error: null, message: null });
    }

    const { data: toolCalls, error: toolErr } = await supabase
      .from("agent_tool_calls")
      .select("*")
      .eq("llm_call_id", llmCall.id)
      .order("step", { ascending: true });

    if (toolErr) throw toolErr;

    res.json({ data: { llm_call: llmCall, tool_calls: toolCalls || [] }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
