import supabase from "../db/supabase.js";
import { runCopilotAgent } from "../services/copilot-agent.js";

const POLL_INTERVAL_MS = 2000;

// Maps jobId → active SSE response object.
// When a client connects to GET /api/jobs/:id/stream, their res is stored here.
// The worker writes tokens directly to that res as Gemini generates them.
const sseClients = new Map();

export const registerSSEClient = (jobId, res) => {
  sseClients.set(jobId, res);
};

export const unregisterSSEClient = (jobId) => {
  sseClients.delete(jobId);
};

export const streamToken = (jobId, chunk) => {
  const res = sseClients.get(jobId);
  if (res) res.write(`data: ${JSON.stringify({ type: "token", chunk })}\n\n`);
};

export const streamComplete = (jobId, result) => {
  const res = sseClients.get(jobId);
  if (res) {
    res.write(`data: ${JSON.stringify({ type: "complete", result })}\n\n`);
    res.end();
    sseClients.delete(jobId);
  }
};

export const streamError = (jobId, error) => {
  const res = sseClients.get(jobId);
  if (res) {
    res.write(`data: ${JSON.stringify({ type: "error", error })}\n\n`);
    res.end();
    sseClients.delete(jobId);
  }
};

const processJob = async (job) => {
  console.log(`[worker] processing job ${job.id} type=${job.type}`);

  try {
    // Handlers are added here incrementally across Steps 03, 05, and 06.
    // Each case sets result and breaks; the success update below runs after.
    const result = await dispatchJob(job);

    await supabase
      .from("jobs")
      .update({
        status: "completed",
        result,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  } catch (err) {
    console.error(`[worker] job ${job.id} failed:`, err.message);

    const newRetryCount = (job.retry_count || 0) + 1;
    const exhausted = newRetryCount >= (job.max_retries || 3);

    await supabase
      .from("jobs")
      .update({
        status: exhausted ? "failed" : "pending",
        retry_count: newRetryCount,
        error: err.message,
        started_at: null,
      })
      .eq("id", job.id);

    if (exhausted) {
      streamError(job.id, "Something went wrong. Please try again.");
    }
  }
};

const pollJobs = async () => {
  try {
    const { data: jobs, error } = await supabase.rpc("claim_next_job");
    if (error) {
      console.error("[worker] poll error:", error.message);
      return;
    }
    if (jobs?.length > 0) {
      // processJob is intentionally not awaited — each job runs independently.
      // Errors are caught inside processJob and written back to the jobs table.
      jobs.forEach((job) => processJob(job));
    }
  } catch (err) {
    console.error("[worker] unexpected poll error:", err.message);
  }
};

// dispatchJob is extracted so processJob stays readable.
// Add cases here as each step is implemented.
const dispatchJob = async (job) => {
  switch (job.type) {
    case "copilot_query":
      return runCopilotAgent(job.id, job.payload);

    // Step 05 — inno agent
    // case "inno_message":
    //   return runInnoMessage(job.id, job.payload);

    // Step 06 — background tasks
    // case "embed_article":
    // case "quality_score":
    // case "title_gen":

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
};

export const startWorker = () => {
  console.log("[worker] started, polling every", POLL_INTERVAL_MS, "ms");
  setInterval(pollJobs, POLL_INTERVAL_MS);
};
