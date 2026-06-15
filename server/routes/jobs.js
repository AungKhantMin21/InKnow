import { Router } from "express";
import jwt from "jsonwebtoken";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";
import { registerSSEClient, unregisterSSEClient } from "../workers/job-worker.js";

const router = Router();

// GET /api/jobs/:jobId/stream — SSE stream for any job type.
//
// The browser's native EventSource API cannot send Authorization headers,
// so we accept the JWT as a ?token= query parameter on this route only.
// The client appends its stored token: `/api/jobs/${jobId}/stream?token=${jwt}`
router.get("/:jobId/stream", async (req, res) => {
  const { jobId } = req.params;
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({
      data: null,
      error: "Unauthorized",
      message: "Please log in to continue.",
    });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({
      data: null,
      error: "Unauthorized",
      message: "Please log in to continue.",
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // prevents nginx from buffering the stream
  res.flushHeaders();

  // Send a keepalive comment every 15s so the connection survives proxy timeouts.
  // SSE comments (lines starting with :) are ignored by the browser.
  const keepalive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 15000);

  // Race condition guard: the worker may finish before the client connects to the stream.
  // Check the job's current state first and resolve immediately if already done.
  const { data: job } = await supabase
    .from("jobs")
    .select("status, result, error")
    .eq("id", jobId)
    .single();

  if (job?.status === "completed") {
    res.write(`data: ${JSON.stringify({ type: "complete", result: job.result })}\n\n`);
    clearInterval(keepalive);
    res.end();
    return;
  }

  if (job?.status === "failed") {
    res.write(`data: ${JSON.stringify({ type: "error", error: job.error })}\n\n`);
    clearInterval(keepalive);
    res.end();
    return;
  }

  // Job still in progress — register this response so the worker can stream to it.
  registerSSEClient(jobId, res);

  req.on("close", () => {
    clearInterval(keepalive);
    unregisterSSEClient(jobId);
  });
});

// GET /api/jobs/:jobId — polling fallback if SSE disconnects or is unavailable
router.get("/:jobId", auth, async (req, res, next) => {
  try {
    const { data: job, error } = await supabase
      .from("jobs")
      .select("id, type, status, result, error, created_at, completed_at")
      .eq("id", req.params.jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    res.json({ data: { job }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
