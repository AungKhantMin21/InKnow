import { Router } from "express";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = Router();
router.use(auth);

/** GET /api/groups — admin only: list all groups with member/article counts */
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { data: groups, error } = await supabase
      .from("groups")
      .select("id, name, description, archived, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Attach member + article counts per group
    const [membersRes, articlesRes] = await Promise.all([
      supabase.from("employees").select("id, group_id"),
      supabase
        .from("knowledge_articles")
        .select("id, group_id")
        .eq("approved", true)
        .eq("rejected", false),
    ]);

    const memberCounts = {};
    const articleCounts = {};
    for (const e of membersRes.data || []) {
      if (e.group_id) memberCounts[e.group_id] = (memberCounts[e.group_id] || 0) + 1;
    }
    for (const a of articlesRes.data || []) {
      if (a.group_id) articleCounts[a.group_id] = (articleCounts[a.group_id] || 0) + 1;
    }

    const enriched = (groups || []).map((g) => ({
      ...g,
      member_count: memberCounts[g.id] || 0,
      article_count: articleCounts[g.id] || 0,
    }));

    res.json({ data: { groups: enriched }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

/** GET /api/groups/:id — admin only: single group info */
router.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { data: group, error } = await supabase
      .from("groups")
      .select("id, name, description, archived, created_at")
      .eq("id", req.params.id)
      .single();

    if (error || !group) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    res.json({ data: { group }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

/** POST /api/groups — admin only: create group */
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({
        data: null,
        error: "Missing fields",
        message: "We need this to continue.",
      });
    }

    const { data: group, error } = await supabase
      .from("groups")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        created_by: req.employee.id,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data: { group }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/groups/:id — admin only: update name or description */
router.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (name?.trim()) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;

    const { data: group, error } = await supabase
      .from("groups")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !group) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    res.json({ data: { group }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/groups/:id/archive — admin only: soft-archive group */
router.patch("/:id/archive", requireAdmin, async (req, res, next) => {
  try {
    const { data: group, error } = await supabase
      .from("groups")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !group) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    res.json({ data: { group }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

/** GET /api/groups/:id/members — admin or that group's manager */
router.get("/:id/members", async (req, res, next) => {
  try {
    const isAdmin = req.employee.is_admin;
    const isGroupManager =
      req.employee.is_manager && req.employee.group_id === req.params.id;

    if (!isAdmin && !isGroupManager) {
      return res.status(403).json({
        data: null,
        error: "Forbidden",
        message: "We couldn't find that. Try going back.",
      });
    }

    const { data, error } = await supabase
      .from("employees")
      .select("id, name, email, job_title, is_manager, is_admin, created_at")
      .eq("group_id", req.params.id)
      .order("name", { ascending: true });

    if (error) throw error;

    res.json({ data: { members: data || [] }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

/** POST /api/groups/:id/members — admin only: assign employee to group */
router.post("/:id/members", requireAdmin, async (req, res, next) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) {
      return res.status(400).json({
        data: null,
        error: "Missing fields",
        message: "We need this to continue.",
      });
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .update({ group_id: req.params.id })
      .eq("id", employee_id)
      .select("id, name, email, job_title, group_id")
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

/** DELETE /api/groups/:id/members/:eid — admin only: remove employee from group */
router.delete("/:id/members/:eid", requireAdmin, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from("employees")
      .update({ group_id: null })
      .eq("id", req.params.eid)
      .eq("group_id", req.params.id);

    if (error) throw error;

    res.json({ data: null, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

/** GET /api/groups/:id/invites — admin or that group's manager: list active invites */
router.get("/:id/invites", async (req, res, next) => {
  try {
    const isAdmin = req.employee.is_admin;
    const isGroupManager =
      req.employee.is_manager && req.employee.group_id === req.params.id;

    if (!isAdmin && !isGroupManager) {
      return res.status(403).json({
        data: null,
        error: "Forbidden",
        message: "We couldn't find that. Try going back.",
      });
    }

    const { data, error } = await supabase
      .from("group_invites")
      .select("id, group_id, token, expires_at, created_at, created_by")
      .eq("group_id", req.params.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const now = new Date();
    const active = (data || []).filter(
      (inv) => !inv.expires_at || new Date(inv.expires_at) > now,
    );

    res.json({ data: { invites: active }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

/** POST /api/groups/:id/invites — admin or that group's manager */
router.post("/:id/invites", async (req, res, next) => {
  try {
    const isAdmin = req.employee.is_admin;
    const isGroupManager =
      req.employee.is_manager && req.employee.group_id === req.params.id;

    if (!isAdmin && !isGroupManager) {
      return res.status(403).json({
        data: null,
        error: "Forbidden",
        message: "We couldn't find that. Try going back.",
      });
    }

    const { expires_in_days } = req.body;
    const expires_at = expires_in_days
      ? new Date(Date.now() + Number(expires_in_days) * 86400000).toISOString()
      : null;

    const { data: invite, error } = await supabase
      .from("group_invites")
      .insert({
        group_id: req.params.id,
        created_by: req.employee.id,
        expires_at,
      })
      .select("id, group_id, token, expires_at, created_at")
      .single();

    if (error) throw error;

    res.status(201).json({ data: { invite }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
