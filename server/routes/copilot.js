import { Router } from "express";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";

const router = Router();
router.use(auth);

// POST /api/copilot/query — queue a copilot job, return jobId immediately.
// The client connects to GET /api/jobs/:jobId/stream to receive the streamed answer.
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

    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        type: "copilot_query",
        payload: {
          question: question.trim(),
          groupId: req.employee.group_id,
          employeeId: req.employee.id,
        },
        employee_id: req.employee.id,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) throw error;

    res.json({ data: { jobId: job.id }, error: null, message: null });
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
