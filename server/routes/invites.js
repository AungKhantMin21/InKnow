import { Router } from "express";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";

const router = Router();

/** GET /api/invites/:token — public: validate token and return group info */
router.get("/:token", async (req, res, next) => {
  try {
    const { data: invite, error } = await supabase
      .from("group_invites")
      .select("id, group_id, token, expires_at")
      .eq("token", req.params.token)
      .single();

    if (error || !invite) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "This invite link is not valid.",
      });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({
        data: null,
        error: "Expired",
        message: "This invite link has expired.",
      });
    }

    // Fetch group info separately to avoid FK join cache issues
    const { data: group } = await supabase
      .from("groups")
      .select("id, name, description")
      .eq("id", invite.group_id)
      .single();

    res.json({
      data: {
        invite: {
          id: invite.id,
          group_id: invite.group_id,
          token: invite.token,
          expires_at: invite.expires_at,
          group: group || null,
        },
      },
      error: null,
      message: null,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/invites/:token/accept — authenticated: join group via token */
router.post("/:token/accept", auth, async (req, res, next) => {
  try {
    const { data: invite, error: inviteErr } = await supabase
      .from("group_invites")
      .select("id, group_id, expires_at")
      .eq("token", req.params.token)
      .single();

    if (inviteErr || !invite) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "This invite link is not valid.",
      });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({
        data: null,
        error: "Expired",
        message: "This invite link has expired.",
      });
    }

    const { data: employee, error: updateErr } = await supabase
      .from("employees")
      .update({ group_id: invite.group_id })
      .eq("id", req.employee.id)
      .select("id, name, email, group_id, job_title, is_manager, is_admin")
      .single();

    if (updateErr) throw updateErr;

    res.json({ data: { employee }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
