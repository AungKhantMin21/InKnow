import supabase from "../db/supabase.js";
import { runCopilotAgent } from "../services/copilot-agent.js";
import { runInnoMessage } from "../services/inno-agent.js";
import { embedArticle, scoreArticle, generateTitle } from "../services/background-jobs.js";

// When a job is found, poll again quickly to catch any burst of new jobs.
// When idle, back off to avoid hammering Supabase with empty queries.
const POLL_ACTIVE_MS = 500;
const POLL_IDLE_MS = 3000;

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
    const result = await dispatchJob(job);

    // undefined means the agent called streamError and returned early without a result.
    // Mark as failed so the SSE fallback poller sends an error event, not null result.
    if (result === undefined) {
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error: "Agent returned no result",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      return;
    }

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

// Returns true if jobs were found so the scheduler knows to poll again quickly.
const pollJobs = async () => {
  try {
    const { data: jobs, error } = await supabase.rpc("claim_next_job");
    if (error) {
      console.error("[worker] poll error:", error.message);
      return false;
    }
    if (jobs?.length > 0) {
      // processJob is intentionally not awaited — each job runs independently.
      // Errors are caught inside processJob and written back to the jobs table.
      jobs.forEach((job) => processJob(job));
      return true;
    }
    return false;
  } catch (err) {
    console.error("[worker] unexpected poll error:", err.message);
    return false;
  }
};

// dispatchJob is extracted so processJob stays readable.
// Add cases here as each step is implemented.
const dispatchJob = async (job) => {
  switch (job.type) {
    case "copilot_query":
      return runCopilotAgent(job.id, job.payload);

    case "inno_message":
      return runInnoMessage(job.id, job.payload);

    case "embed_article":
      return embedArticle(job.payload.articleId);

    case "quality_score":
      return scoreArticle(job.payload.articleId);

    case "title_gen":
      return generateTitle(job.payload.sessionId);

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
};

// Adaptive scheduler: polls quickly after finding work, slowly when idle.
// Uses recursive setTimeout so the interval can change each cycle.
const scheduleNextPoll = async () => {
  const hadJobs = await pollJobs();
  setTimeout(scheduleNextPoll, hadJobs ? POLL_ACTIVE_MS : POLL_IDLE_MS);
};

export const startWorker = () => {
  console.log("[worker] started — adaptive polling (active: 500ms, idle: 3s)");
  scheduleNextPoll();
};
