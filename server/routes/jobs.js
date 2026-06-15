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

  const keepalive = setInterval(() => res.write(": keepalive\n\n"), 15000);
  let pollFallback;

  // closeAndSend is the single exit path for this SSE connection.
  // The res.writableEnded guard prevents a double-send if the worker's
  // streamComplete and the fallback poller fire at almost the same moment.
  const closeAndSend = (event) => {
    if (res.writableEnded) return;
    clearInterval(keepalive);
    clearInterval(pollFallback);
    unregisterSSEClient(jobId);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    res.end();
  };

  // Register the SSE client BEFORE querying the DB.
  // If we checked the DB first and got "pending", then the worker completed
  // between that check and registerSSEClient, streamComplete would find no
  // client and the browser would hang forever. Registering first closes
  // that window: the worker will either find us in the map and stream directly,
  // or the DB check below will catch a status that was already "completed".
  registerSSEClient(jobId, res);

  const { data: job } = await supabase
    .from("jobs")
    .select("status, result, error")
    .eq("id", jobId)
    .single();

  if (job?.status === "completed") {
    closeAndSend({ type: "complete", result: job.result });
    return;
  }
  if (job?.status === "failed") {
    closeAndSend({ type: "error", error: job.error });
    return;
  }

  // Fallback poller: catches the narrow window where the worker calls streamComplete
  // after our DB check above but before it writes the DB update to "completed".
  // In the happy path the worker streams directly to this res and closes it;
  // req.close fires and clears this interval before it ever runs twice.
  pollFallback = setInterval(async () => {
    if (res.writableEnded) { clearInterval(pollFallback); return; }
    const { data: s } = await supabase
      .from("jobs")
      .select("status, result, error")
      .eq("id", jobId)
      .single();
    if (s?.status === "completed") closeAndSend({ type: "complete", result: s.result });
    else if (s?.status === "failed") closeAndSend({ type: "error", error: s.error });
  }, 2000);

  req.on("close", () => {
    clearInterval(keepalive);
    clearInterval(pollFallback);
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
