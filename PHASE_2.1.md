# PHASE_2.1.md — InKnow V1.2.0 Build Context

## Feed this file to Claude Code at the start of every Phase 2.1 session.

---

## What Phase 2.1 Is

Phase 2 made InKnow ready for an entire company — groups, permissions,
context caching, tiered knowledge injection.

Phase 2.1 makes InKnow production-grade at 100–500 employee scale.
Three parallel upgrades that work together:

**1. Background Job Queue** — AI calls move off the HTTP request thread.
No more blocking. No more timeouts at peak load (100+ concurrent users).
Employees see responses stream in immediately. The server stays responsive.

**2. SSE Streaming** — Token-by-token streaming from Gemini to the browser.
Response starts appearing in ~300ms instead of waiting 6–8 seconds.
Copilot and interrogation sessions feel instant, not laggy.

**3. Single Agent Tool Use (Copilot first, then Inno)** — Gemini moves from
one-shot text generation to an autonomous reasoning loop with real tools.
It decides what to search, whether results are good enough, when to flag gaps,
when to ask for clarification. This is not prompt engineering — it is genuine
agency via Gemini's function calling API.

Everything in Phase 1 and Phase 2 continues to work.
Phase 2.1 upgrades the infrastructure underneath and the intelligence on top.

---

## What Is NOT Changing

- Tech stack: React + Vite + Express + Supabase + Gemini — unchanged
- Design system: Fraunces + Epilogue + DM Mono + all CSS variables — unchanged
- All Phase 2 flows: groups, RBAC, caching, admin portal — unchanged
- No UI libraries, no ORM, no state management libraries — same rules apply
- Dependency philosophy: question every npm install — same rules apply
- Phase 2 caching architecture for interrogation sessions — unchanged,
  Phase 2.1 builds the same streaming pattern on top of it

---

## Why These Three Together

At 100–500 employees, three things break simultaneously at peak:

```
Problem 1: Blocking HTTP
  100 employees hit Copilot at 8am morning briefing.
  Each Gemini call takes 6–8 seconds.
  Express queues requests. Users wait 30–60 seconds. Some timeout.
  Fix: job queue + async processing.

Problem 2: Perceived slowness
  Even with async processing, if the user sees nothing for 6 seconds,
  it feels broken. Streaming fixes the perception problem.
  Fix: SSE streaming — first token in ~300ms.

Problem 3: One-shot AI is brittle at scale
  When Gemini returns a weak answer (low similarity results),
  the current architecture has no fallback — it returns whatever it got.
  At 500 employees, this happens dozens of times per day.
  Fix: agent loop — Gemini detects weak results and retries automatically.
```

These three upgrades are independent in implementation but unified in effect:
together they make InKnow feel fast, reliable, and intelligent at real scale.

---

## New Database Tables

Run these migrations in Supabase SQL editor before writing any application code.

```sql
-- ══════════════════════════════════════════════════════════════
-- STEP 1: Job queue
-- ══════════════════════════════════════════════════════════════
CREATE TABLE jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL,
  -- types: 'copilot_query' | 'inno_message' | 'article_gen'
  --        | 'embed_article' | 'quality_score' | 'title_gen'
  status       text NOT NULL DEFAULT 'pending',
  -- statuses: 'pending' | 'processing' | 'completed' | 'failed'
  payload      jsonb NOT NULL DEFAULT '{}',
  result       jsonb,
  error        text,
  retry_count  int DEFAULT 0,
  max_retries  int DEFAULT 3,
  employee_id  uuid REFERENCES employees(id),
  session_id   uuid REFERENCES interrogation_sessions(id),
  created_at   timestamptz DEFAULT now(),
  started_at   timestamptz,
  completed_at timestamptz
);

CREATE INDEX idx_jobs_status ON jobs(status, created_at);
CREATE INDEX idx_jobs_session ON jobs(session_id);
CREATE INDEX idx_jobs_employee ON jobs(employee_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 2: LLM observability
-- ══════════════════════════════════════════════════════════════
CREATE TABLE llm_calls (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            uuid REFERENCES jobs(id),
  session_id        uuid REFERENCES interrogation_sessions(id),
  employee_id       uuid REFERENCES employees(id),
  group_id          uuid REFERENCES groups(id),
  call_type         text NOT NULL,
  -- types: 'copilot_tool_call' | 'copilot_synthesis'
  --        | 'inno_message' | 'article_gen' | 'title_gen'
  --        | 'quality_score'
  model             text NOT NULL,
  prompt_tokens     int,
  completion_tokens int,
  cached_tokens     int DEFAULT 0,
  tool_calls_made   int DEFAULT 0,
  agent_steps       int DEFAULT 1,
  latency_ms        int,
  cache_hit         boolean DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_llm_calls_group ON llm_calls(group_id, created_at);
CREATE INDEX idx_llm_calls_session ON llm_calls(session_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 3: Agent tool calls log (for debugging + transparency)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE agent_tool_calls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  llm_call_id uuid REFERENCES llm_calls(id),
  step        int NOT NULL,
  tool_name   text NOT NULL,
  input       jsonb,
  output      jsonb,
  duration_ms int,
  created_at  timestamptz DEFAULT now()
);
```

---

## Part 1 — Background Job Queue

### Architecture

```
Before (blocking):
  POST /api/copilot/query
    → await gemini.generate()  ← 6–8 seconds, blocks Express worker
    → return answer

After (non-blocking):
  POST /api/copilot/query
    → INSERT INTO jobs (type='copilot_query', payload={question, groupId})
    → return { jobId }          ← responds in <50ms

  Worker (background, polls every 2s):
    → SELECT job WHERE status='pending' LIMIT 1 FOR UPDATE SKIP LOCKED
    → process job (Gemini agent loop)
    → UPDATE job SET status='completed', result={answer}

  GET /api/jobs/:id/stream (SSE)
    → client connects immediately after POST
    → worker writes tokens as they arrive
    → client receives stream, displays in real time
```

### Job Worker Implementation

```javascript
// server/workers/job-worker.js

import { createClient } from "@supabase/supabase-js";
import { runCopilotAgent } from "../services/copilot-agent.js";
import { runInnoMessage } from "../services/inno-agent.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY, // service key for worker, not anon key
);

const POLL_INTERVAL_MS = 2000;
const sseClients = new Map(); // jobId → res (SSE connection)

// Called by SSE route to register a client
export const registerSSEClient = (jobId, res) => {
  sseClients.set(jobId, res);
};

export const unregisterSSEClient = (jobId) => {
  sseClients.delete(jobId);
};

// Called by agent to stream a token chunk to the connected client
export const streamToken = (jobId, chunk) => {
  const res = sseClients.get(jobId);
  if (res) {
    res.write(`data: ${JSON.stringify({ type: "token", chunk })}\n\n`);
  }
};

// Called by agent to signal completion
export const streamComplete = (jobId, result) => {
  const res = sseClients.get(jobId);
  if (res) {
    res.write(`data: ${JSON.stringify({ type: "complete", result })}\n\n`);
    res.end();
    sseClients.delete(jobId);
  }
};

// Called by agent to signal an error
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
    let result;

    switch (job.type) {
      case "copilot_query":
        result = await runCopilotAgent(job.id, job.payload);
        break;

      case "inno_message":
        result = await runInnoMessage(job.id, job.payload);
        break;

      // Non-streaming background jobs
      case "embed_article":
        result = await embedArticle(job.payload.articleId);
        break;

      case "quality_score":
        result = await scoreArticle(job.payload.articleId);
        break;

      case "title_gen":
        result = await generateTitle(job.payload.sessionId);
        break;

      default:
        throw new Error(`Unknown job type: ${job.type}`);
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
    const failed = newRetryCount >= job.max_retries;

    await supabase
      .from("jobs")
      .update({
        status: failed ? "failed" : "pending", // re-queue if retries remain
        retry_count: newRetryCount,
        error: err.message,
        started_at: null, // reset so worker picks it up again
      })
      .eq("id", job.id);

    if (failed) {
      streamError(job.id, "Something went wrong. Please try again.");
    }
  }
};

const pollJobs = async () => {
  // FOR UPDATE SKIP LOCKED = only one worker processes each job
  // Safe for multiple worker processes if ever scaled
  const { data: jobs } = await supabase.rpc("claim_next_job");

  if (jobs && jobs.length > 0) {
    // Process claimed jobs (non-blocking — don't await in poll loop)
    jobs.forEach((job) => processJob(job));
  }
};

// Start polling
export const startWorker = () => {
  console.log("[worker] started, polling every", POLL_INTERVAL_MS, "ms");
  setInterval(pollJobs, POLL_INTERVAL_MS);
};
```

### Supabase Function: claim_next_job

```sql
-- Run in Supabase SQL editor
-- Also claims jobs stuck in 'processing' for >2 minutes (server crash recovery).
-- The 2-minute timeout restarts on each claim via started_at = now().
-- Combined with retry_count/max_retries in processJob, genuinely failing jobs
-- exhaust after 3 attempts; crashed jobs get a clean retry.
CREATE OR REPLACE FUNCTION claim_next_job()
RETURNS SETOF jobs
LANGUAGE sql
AS $$
  UPDATE jobs
  SET status = 'processing', started_at = now()
  WHERE id IN (
    SELECT id FROM jobs
    WHERE status = 'pending'
       OR (
         status = 'processing'
         AND started_at < now() - interval '2 minutes'
       )
    ORDER BY created_at ASC
    LIMIT 5
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
```

### Updated Routes: POST → Queue, GET → Stream

```javascript
// server/routes/copilot.js

import { supabase } from "../lib/supabase.js";
import {
  registerSSEClient,
  unregisterSSEClient,
} from "../workers/job-worker.js";
import { requireAuth } from "../middleware/auth.js";

// POST: create job, return jobId immediately
router.post("/api/copilot/query", requireAuth, async (req, res) => {
  const { question } = req.body;
  const { id: employeeId, group_id: groupId } = req.employee;

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      type: "copilot_query",
      payload: { question, groupId, employeeId },
      employee_id: employeeId,
      status: "pending",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: "Failed to queue job" });

  res.json({ jobId: job.id });
});

// GET: SSE stream for job result
router.get("/api/jobs/:jobId/stream", requireAuth, async (req, res) => {
  const { jobId } = req.params;

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Send keepalive every 15s to prevent connection timeout
  const keepalive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 15000);

  // Check if job is already completed (race condition: worker finished before SSE connected)
  const { data: job } = await supabase
    .from("jobs")
    .select("status, result, error")
    .eq("id", jobId)
    .single();

  if (job?.status === "completed") {
    res.write(
      `data: ${JSON.stringify({ type: "complete", result: job.result })}\n\n`,
    );
    res.end();
    clearInterval(keepalive);
    return;
  }

  if (job?.status === "failed") {
    res.write(
      `data: ${JSON.stringify({ type: "error", error: job.error })}\n\n`,
    );
    res.end();
    clearInterval(keepalive);
    return;
  }

  // Register this SSE connection — worker will stream to it
  registerSSEClient(jobId, res);

  // Clean up on client disconnect
  req.on("close", () => {
    clearInterval(keepalive);
    unregisterSSEClient(jobId);
  });
});
```

### Wire Worker into Server Entry Point

```javascript
// server/index.js — add after all routes

import { startWorker } from "./workers/job-worker.js";

// Start background worker
startWorker();
```

---

## Part 2 — SSE Streaming (Frontend)

### React Hook: useJobStream

```javascript
// client/src/hooks/useJobStream.js

import { useState, useCallback } from "react";

export const useJobStream = () => {
  const [streaming, setStreaming] = useState(false);
  const [tokens, setTokens] = useState("");
  const [complete, setComplete] = useState(null);
  const [error, setError] = useState(null);

  const startStream = useCallback(async (jobId, token) => {
    setStreaming(true);
    setTokens("");
    setComplete(null);
    setError(null);

    const eventSource = new EventSource(
      `/api/jobs/${jobId}/stream`,
      // EventSource doesn't support custom headers natively.
      // Auth is handled via httpOnly cookie (set at login).
      // If using Bearer tokens, use a polyfill like 'event-source-polyfill'.
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "token") {
        setTokens((prev) => prev + data.chunk);
      }

      if (data.type === "complete") {
        setComplete(data.result);
        setStreaming(false);
        eventSource.close();
      }

      if (data.type === "error") {
        setError(data.error);
        setStreaming(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setError("Connection lost. Please try again.");
      setStreaming(false);
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  return { streaming, tokens, complete, error, startStream };
};
```

### Updated Copilot Component

```javascript
// client/src/pages/Inno.jsx (copilot view)

import { useJobStream } from "../hooks/useJobStream";

const Inno = () => {
  const [question, setQuestion] = useState("");
  const { streaming, tokens, complete, error, startStream } = useJobStream();

  const handleSubmit = async () => {
    if (!question.trim() || streaming) return;

    // POST to create job — returns immediately
    const res = await fetch("/api/copilot/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const { jobId } = await res.json();

    // Start SSE stream — tokens appear as they arrive
    startStream(jobId);
    setQuestion("");
  };

  return (
    <div>
      {/* Streaming response — shows tokens as they arrive */}
      {(streaming || tokens) && (
        <div className="font-body font-light text-sm text-ink leading-relaxed">
          {tokens}
          {streaming && (
            <span className="inline-block w-0.5 h-3.5 bg-volt ml-0.5 animate-pulse" />
          )}
        </div>
      )}

      {/* Final result with citations once complete */}
      {complete && <CopilotAnswer answer={complete} />}

      {error && <p className="font-mono text-[10px] text-red-500">{error}</p>}

      <div className="flex gap-2 mt-4">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={streaming}
          placeholder="Ask Inno anything..."
          className="flex-1 font-body text-sm ..."
        />
        <button onClick={handleSubmit} disabled={streaming || !question.trim()}>
          {streaming ? "Thinking..." : "Ask"}
        </button>
      </div>
    </div>
  );
};
```

### Streaming from Gemini Agent to SSE Client

The agent calls `streamToken(jobId, chunk)` as Gemini emits tokens:

```javascript
// Inside runCopilotAgent — synthesis step (Part 3 below)
const synthesisStream = await model.generateContentStream(synthesisPrompt);

for await (const chunk of synthesisStream.stream) {
  const text = chunk.text();
  if (text) {
    streamToken(jobId, text); // push token to SSE client
  }
}

const fullAnswer = (await synthesisStream.response).text();
streamComplete(jobId, { answer: fullAnswer, sources, agentSteps });
```

---

## Part 3 — Single Agent Tool Use (Copilot)

This is the core upgrade. Gemini moves from text-generation to
autonomous reasoning with real tool calls.

### Tool Definitions

```javascript
// server/services/copilot-tools.js

export const COPILOT_TOOLS = [
  {
    name: "search_knowledge",
    description: `Search the company knowledge base for articles relevant
    to a query. Call this when you need information to answer a question.
    If first results have low similarity (below 0.5), call again with a
    rephrased or broader query before concluding nothing exists.`,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query — be specific",
        },
        threshold: {
          type: "number",
          description:
            "Similarity threshold 0.0–1.0. Start at 0.45. Drop to 0.3 if first search returns nothing.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_article",
    description: `Retrieve the full content of a specific article by ID.
    Use this when search results show a promising article and you need
    the complete text to give a thorough answer.`,
    parameters: {
      type: "object",
      properties: {
        article_id: {
          type: "string",
          description: "The UUID of the article to retrieve",
        },
      },
      required: ["article_id"],
    },
  },
  {
    name: "flag_knowledge_gap",
    description: `Flag a topic as a knowledge gap when no relevant articles
    exist after searching. This notifies the manager's dashboard so a
    knowledge capture session can be scheduled. Only call this after
    at least one search has returned no useful results.`,
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Brief label for the missing knowledge area",
        },
        original_question: {
          type: "string",
          description: "The original employee question that revealed the gap",
        },
      },
      required: ["topic", "original_question"],
    },
  },
  {
    name: "ask_clarification",
    description: `Ask the employee a clarifying question when their query
    is genuinely ambiguous between two or more knowledge areas and you
    cannot determine which to search. Use sparingly — try to infer
    intent from context before asking.`,
    parameters: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "A single, specific clarifying question",
        },
      },
      required: ["question"],
    },
  },
];
```

### The Agent Loop

```javascript
// server/services/copilot-agent.js

import { GoogleGenerativeAI, FunctionCallingMode } from "@google/generative-ai";
import { supabase } from "../lib/supabase.js";
import {
  streamToken,
  streamComplete,
  streamError,
} from "../workers/job-worker.js";
import { COPILOT_TOOLS } from "./copilot-tools.js";
import { retrieveArticles, getArticleById, flagGap } from "./rag.js";
import { logLLMCall, logToolCall } from "./observability.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MAX_STEPS = 6;

export const runCopilotAgent = async (jobId, payload) => {
  const { question, groupId, employeeId } = payload;
  const startTime = Date.now();
  const observations = [];
  const sources = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let toolCallsMade = 0;
  let steps = 0;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    tools: [{ functionDeclarations: COPILOT_TOOLS }],
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingMode.AUTO },
    },
    systemInstruction: `You are Inno, InKnow's knowledge copilot.
Your job: answer the employee's question using the company knowledge base.

Rules:
- Always search before answering — never answer from your own training data
- If search results have similarity below 0.5, search again with a different query
- Get full article content when a result looks highly relevant
- Only flag a gap after genuinely trying multiple search approaches
- Cite your sources: reference article titles in your answer
- Be direct and specific — employees need actionable answers
- One clarification question maximum if genuinely needed`,
  });

  const chat = model.startChat();

  // Log the LLM call to observability table
  const llmCallId = await logLLMCall({
    jobId,
    sessionId: null,
    employeeId,
    groupId,
    callType: "copilot_tool_call",
    model: "gemini-2.5-flash-lite",
  });

  let result = await chat.sendMessage(
    `Employee question: "${question}"\n\nSearch the knowledge base and answer this.`,
  );

  // ═══════════════════════════
  // THE AGENT LOOP
  // ═══════════════════════════
  while (steps < MAX_STEPS) {
    steps++;
    const response = result.response;

    // Track token usage
    if (response.usageMetadata) {
      totalPromptTokens += response.usageMetadata.promptTokenCount || 0;
      totalCompletionTokens += response.usageMetadata.candidatesTokenCount || 0;
    }

    const parts = response.candidates[0].content.parts;
    const toolCalls = parts.filter((p) => p.functionCall);

    // No tool calls = model is done, stream final answer
    if (toolCalls.length === 0) {
      const finalText = parts.find((p) => p.text)?.text || "";

      // Stream synthesis back to client token by token
      // (for the final answer, we stream directly from the text)
      const words = finalText.split(" ");
      for (const word of words) {
        streamToken(jobId, word + " ");
        // Small delay to simulate streaming (remove in production —
        // real streaming comes from generateContentStream)
      }

      // Update observability
      await logLLMCall({
        id: llmCallId,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        toolCallsMade,
        agentSteps: steps,
        latencyMs: Date.now() - startTime,
      });

      streamComplete(jobId, {
        answer: finalText,
        sources: [...new Set(sources)], // deduplicated
        agentSteps: steps,
        toolCallsMade,
      });

      return { answer: finalText, sources, agentSteps: steps };
    }

    // Execute all tool calls the model requested
    const toolResults = await Promise.all(
      toolCalls.map(async (part, i) => {
        const { name, args } = part.functionCall;
        const toolStart = Date.now();
        toolCallsMade++;
        let toolOutput;

        // ── Tool: search_knowledge ──────────────────────────────
        if (name === "search_knowledge") {
          const articles = await retrieveArticles(
            args.query,
            groupId,
            args.threshold || 0.45,
          );

          toolOutput = {
            articles: articles.map((a) => ({
              id: a.id,
              title: a.title,
              summary: a.summary,
              similarity: parseFloat(a.similarity.toFixed(3)),
              visibility: a.visibility,
            })),
            count: articles.length,
            highest_similarity: articles[0]?.similarity || 0,
          };

          observations.push({
            step: steps,
            tool: "search_knowledge",
            query: args.query,
            resultsCount: articles.length,
            highestSimilarity: toolOutput.highest_similarity,
          });
        }

        // ── Tool: get_article ───────────────────────────────────
        else if (name === "get_article") {
          const article = await getArticleById(args.article_id, groupId);
          if (!article) {
            toolOutput = { error: "Article not found or not accessible" };
          } else {
            toolOutput = {
              id: article.id,
              title: article.title,
              content: article.content,
              visibility: article.visibility,
            };
            sources.push(article.title); // track for citations
            observations.push({
              step: steps,
              tool: "get_article",
              title: article.title,
            });
          }
        }

        // ── Tool: flag_knowledge_gap ────────────────────────────
        else if (name === "flag_knowledge_gap") {
          await flagGap({
            topic: args.topic,
            originalQuestion: args.original_question,
            employeeId,
            groupId,
          });
          toolOutput = {
            flagged: true,
            message: "Gap flagged for manager review",
          };
          observations.push({
            step: steps,
            tool: "flag_gap",
            topic: args.topic,
          });
        }

        // ── Tool: ask_clarification ─────────────────────────────
        else if (name === "ask_clarification") {
          // Stream clarification question directly to user
          streamToken(jobId, args.question);
          streamComplete(jobId, {
            clarification: args.question,
            agentSteps: steps,
            toolCallsMade,
          });
          toolOutput = { clarification_sent: true };
          return {
            functionResponse: { name, response: toolOutput },
            isClarification: true,
          };
        }

        // Log tool call to observability
        await logToolCall({
          llmCallId,
          step: steps,
          toolName: name,
          input: args,
          output: toolOutput,
          durationMs: Date.now() - toolStart,
        });

        return { functionResponse: { name, response: toolOutput } };
      }),
    );

    // If clarification was sent, stop the loop
    if (toolResults.some((r) => r.isClarification)) return;

    // Feed all tool results back to model — it decides what to do next
    result = await chat.sendMessage(
      toolResults.map((r) => ({ functionResponse: r.functionResponse })),
    );
  }

  // Safety: max steps reached
  streamError(
    jobId,
    "Could not find a complete answer. Please try rephrasing.",
  );
};
```

### RAG Service Updates

```javascript
// server/services/rag.js — add these if not already present

export const retrieveArticles = async (query, groupId, threshold = 0.45) => {
  const embedding = await generateEmbedding(query);
  const { data, error } = await supabase.rpc("match_articles", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 5,
    requesting_group: groupId,
  });
  if (error) throw error;
  return data || [];
};

export const getArticleById = async (articleId, groupId) => {
  const { data, error } = await supabase
    .from("knowledge_articles")
    .select("id, title, content, visibility, group_id")
    .eq("id", articleId)
    .eq("approved", true)
    .eq("rejected", false)
    .single();

  if (error || !data) return null;

  // Enforce group scoping — only return if accessible
  if (data.group_id === groupId || data.visibility === "public") {
    return data;
  }
  return null; // privacy boundary
};

export const flagGap = async ({
  topic,
  originalQuestion,
  employeeId,
  groupId,
}) => {
  // Store in a gaps table or as a manager notification
  // For now: insert into a knowledge_gaps table
  await supabase.from("knowledge_gaps").insert({
    topic,
    original_question: originalQuestion,
    employee_id: employeeId,
    group_id: groupId,
    status: "open",
  });
};
```

### knowledge_gaps Table

```sql
-- Add to Supabase
CREATE TABLE knowledge_gaps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic             text NOT NULL,
  original_question text,
  employee_id       uuid REFERENCES employees(id),
  group_id          uuid REFERENCES groups(id),
  status            text DEFAULT 'open',
  -- 'open' | 'scheduled' | 'captured'
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_gaps_group ON knowledge_gaps(group_id, status);
```

### Observability Service

```javascript
// server/services/observability.js

import { supabase } from "../lib/supabase.js";

export const logLLMCall = async (data) => {
  if (data.id) {
    // Update existing record with final metrics
    await supabase
      .from("llm_calls")
      .update({
        prompt_tokens: data.promptTokens,
        completion_tokens: data.completionTokens,
        tool_calls_made: data.toolCallsMade,
        agent_steps: data.agentSteps,
        latency_ms: data.latencyMs,
      })
      .eq("id", data.id);
    return data.id;
  }

  // Create new record
  const { data: record } = await supabase
    .from("llm_calls")
    .insert({
      job_id: data.jobId,
      session_id: data.sessionId,
      employee_id: data.employeeId,
      group_id: data.groupId,
      call_type: data.callType,
      model: data.model,
    })
    .select("id")
    .single();

  return record.id;
};

export const logToolCall = async ({
  llmCallId,
  step,
  toolName,
  input,
  output,
  durationMs,
}) => {
  await supabase.from("agent_tool_calls").insert({
    llm_call_id: llmCallId,
    step,
    tool_name: toolName,
    input,
    output,
    duration_ms: durationMs,
  });
};
```

---

## Part 4 — Inno Agent (Interrogation)

Same tool-use pattern but different tool set.
Inno's tools let it track what it has captured, check coverage, and
decide its own conversational intent — not a hardcoded message counter.

```javascript
// server/services/inno-tools.js

export const INNO_TOOLS = [
  {
    name: "check_existing_coverage",
    description: `Check what knowledge already exists in the group's
    knowledge base on a specific topic before asking about it.
    Use this to avoid asking employees to repeat things already captured.`,
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic to check coverage for" },
      },
      required: ["topic"],
    },
  },
  {
    name: "record_knowledge_captured",
    description: `Record that a valuable piece of knowledge has been
    captured in this session. Call this when the employee has shared
    something new and specific that belongs in the knowledge base.`,
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Short label for what was captured",
        },
        confidence: {
          type: "number",
          description:
            "0.0–1.0. How complete is this capture? 0.7+ means ready for article generation.",
        },
      },
      required: ["topic", "confidence"],
    },
  },
  {
    name: "send_message",
    description: `Send a message to the employee. This is the ONLY way
    to respond during the session. Always call this to continue the
    conversation. The intent field tells the system what you are doing.`,
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to send — 1–3 sentences maximum",
        },
        intent: {
          type: "string",
          enum: ["go_deeper", "pivot_topic", "wrap_up"],
          description: `go_deeper: extracting more on current topic.
          pivot_topic: moving to a new uncaptured area.
          wrap_up: enough has been captured, suggesting natural close.`,
        },
      },
      required: ["message", "intent"],
    },
  },
];
```

```javascript
// server/services/inno-agent.js

export const runInnoMessage = async (jobId, payload) => {
  const { sessionId, employeeMessage, groupId, employeeId } = payload;

  // Load session with cached system prompt
  const { data: session } = await supabase
    .from("interrogation_sessions")
    .select("gemini_cache_id, message_count")
    .eq("id", sessionId)
    .single();

  // Load conversation history
  const { data: history } = await supabase
    .from("session_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  // Use Phase 2 context caching (unchanged from Phase 2)
  const cacheValid = await isCacheValid(session.gemini_cache_id);
  const cacheId = cacheValid
    ? session.gemini_cache_id
    : await refreshCache(sessionId);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    cachedContent: cacheId,
    tools: [{ functionDeclarations: INNO_TOOLS }],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
  });

  const chat = model.startChat({
    history: (history || []).map((m) => ({
      role: m.role === "ai" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  });

  const result = await chat.sendMessage(employeeMessage);
  const parts = result.response.candidates[0].content.parts;
  const toolCalls = parts.filter((p) => p.functionCall);

  // Process tool calls
  let innoMessage = null;
  let intent = "go_deeper";
  const toolResults = [];

  for (const part of toolCalls) {
    const { name, args } = part.functionCall;

    if (name === "check_existing_coverage") {
      const articles = await retrieveArticles(args.topic, groupId, 0.5);
      toolResults.push({
        functionResponse: {
          name,
          response: {
            existing: articles.map((a) => ({
              title: a.title,
              similarity: a.similarity,
            })),
            count: articles.length,
          },
        },
      });
    } else if (name === "record_knowledge_captured") {
      // Log to session metadata — used for article generation context
      await supabase.from("session_captures").insert({
        session_id: sessionId,
        topic: args.topic,
        confidence: args.confidence,
      });
      toolResults.push({
        functionResponse: { name, response: { recorded: true } },
      });
    } else if (name === "send_message") {
      innoMessage = args.message;
      intent = args.intent;
      // send_message doesn't need a result fed back
    }
  }

  // If there were non-message tool calls, get Inno's follow-up message
  if (toolResults.length > 0 && !innoMessage) {
    const followUp = await chat.sendMessage(
      toolResults.map((r) => ({
        functionResponse: r.functionResponse,
      })),
    );
    const followUpParts = followUp.response.candidates[0].content.parts;
    const followUpToolCalls = followUpParts.filter((p) => p.functionCall);
    const sendMsg = followUpToolCalls.find(
      (p) => p.functionCall.name === "send_message",
    );
    if (sendMsg) {
      innoMessage = sendMsg.functionCall.args.message;
      intent = sendMsg.functionCall.args.intent;
    }
  }

  // Fallback: extract text if no send_message tool call
  if (!innoMessage) {
    innoMessage = parts.find((p) => p.text)?.text || "";
  }

  // Save Inno's message to DB
  await supabase.from("session_messages").insert({
    session_id: sessionId,
    role: "ai",
    content: innoMessage,
    intent, // new column — visible in manager dashboard
  });

  // Stream to client
  streamToken(jobId, innoMessage);
  streamComplete(jobId, { message: innoMessage, intent });

  return { message: innoMessage, intent };
};
```

```sql
-- Add intent column to session_messages
ALTER TABLE session_messages
  ADD COLUMN intent text;
  -- values: 'go_deeper' | 'pivot_topic' | 'wrap_up' | null (for employee messages)
```

---

## New API Endpoints (Phase 2.1)

```
── JOB QUEUE ───────────────────────────────────────────────────
GET    /api/jobs/:id/stream         SSE stream for any job
GET    /api/jobs/:id                check job status (polling fallback)

── UPDATED EXISTING ────────────────────────────────────────────
POST   /api/copilot/query           returns { jobId } immediately
                                    (previously returned answer directly)
POST   /api/sessions/:id/message    returns { jobId } immediately
                                    (previously returned AI message directly)

── ADMIN OBSERVABILITY ─────────────────────────────────────────
GET    /api/admin/llm-usage         admin only — cost by group by day
GET    /api/admin/gaps              admin only — open knowledge gaps
GET    /api/admin/agent-traces/:id  admin only — tool call log for a job

── MANAGER ─────────────────────────────────────────────────────
GET    /api/manager/gaps            manager only — gaps in own group

── UNCHANGED ───────────────────────────────────────────────────
All Phase 1 + Phase 2 endpoints unchanged.
```

---

## Build Order — Phase 2.1

Steps must be done in this order. Each builds on the previous.

---

### 01 — Database Migrations

```
□ Create jobs table with indexes
□ Create llm_calls table with indexes
□ Create agent_tool_calls table
□ Create knowledge_gaps table with indexes
□ Add intent column to session_messages
□ Create claim_next_job() Supabase function
□ Create session_captures table (for Inno capture tracking)
□ Verify all tables and indexes in Supabase dashboard
```

**Done when:** All tables exist. claim_next_job() function works.
Existing data untouched.

---

### 02 — Job Worker + SSE Infrastructure

```
□ server/workers/job-worker.js — full implementation
□ sseClients Map, registerSSEClient, unregisterSSEClient
□ streamToken, streamComplete, streamError helpers
□ pollJobs loop calling claim_next_job()
□ startWorker() called in server/index.js
□ GET /api/jobs/:jobId/stream route with SSE headers
□ GET /api/jobs/:jobId route (status check, polling fallback)
□ Keepalive ping every 15s to prevent timeout
□ Completed job check on SSE connect (race condition guard)
□ Test: POST a dummy job, connect SSE, verify stream
```

**Done when:** Worker starts with server. SSE route established.
A manually inserted job can be streamed to browser.

---

### 03 — Copilot Agent (Replaces current copilot route)

```
□ server/services/copilot-tools.js — COPILOT_TOOLS definitions
□ server/services/rag.js — retrieveArticles, getArticleById, flagGap
□ server/services/observability.js — logLLMCall, logToolCall
□ server/services/copilot-agent.js — runCopilotAgent with full loop
□ POST /api/copilot/query → queue job, return { jobId }
□ Worker processes 'copilot_query' jobs via runCopilotAgent
□ streaming tokens arrive at SSE client as Gemini generates
□ sources array returned in complete event for citation UI
□ Test: simple question → 1 tool call → answer
□ Test: vague question → 2+ searches → better answer
□ Test: unknown topic → gap flagged → gap appears in DB
□ Test: ambiguous question → clarification streamed to client
```

**Done when:** Copilot questions produce streamed answers.
Agent traces visible in agent_tool_calls table.
Gaps appear in knowledge_gaps table.

---

### 04 — Frontend: useJobStream Hook + Copilot UI

```
□ client/src/hooks/useJobStream.js — EventSource hook
□ POST copilot query → receive jobId → connect EventSource
□ Tokens accumulate in state and render progressively
□ Blinking cursor while streaming
□ Sources rendered as article chips below answer on complete
□ Error state: clear message if agent fails
□ Clarification state: renders as Inno asking a question
□ Remove old copilot direct-response logic
□ Test: submit question, see tokens stream in real time
□ Test: disconnect mid-stream, reconnect, check behavior
```

**Done when:** Copilot UI streams responses. First token appears
within 1–2 seconds. Sources shown after completion.

---

### 05 — Inno Agent (Replaces current session message route)

```
□ server/services/inno-tools.js — INNO_TOOLS definitions
□ server/services/inno-agent.js — runInnoMessage with tool loop
□ session_captures table populated on record_knowledge_captured calls
□ intent column written to session_messages
□ POST /api/sessions/:id/message → queue job, return { jobId }
□ Worker processes 'inno_message' jobs via runInnoMessage
□ Phase 2 caching (gemini_cache_id) still used — unchanged
□ Test: Inno checks coverage before asking about captured topics
□ Test: intent field populated correctly in session_messages
□ Test: wrap_up intent triggers end-session nudge in UI
```

**Done when:** Inno interrogation uses tool loop.
Intent visible per message. Coverage checks reduce repeated questions.

---

### 06 — Background Job Types (Non-streaming)

```
□ Worker handles 'embed_article', 'quality_score', 'title_gen'
□ Move article embedding from POST /api/knowledge to job queue
□ Move quality scoring to job queue (after article approval)
□ Move provisional title gen to job queue (fire and forget)
□ Existing fire-and-forget title gen → proper job queue entry
□ Test: article save returns immediately, embedding happens async
□ Test: failed embed job retries up to max_retries
```

**Done when:** All async AI tasks are queued, not blocking HTTP.
No more fire-and-forget .catch(() => {}) patterns.

---

### 07 — Admin Observability UI

```
□ GET /api/admin/llm-usage — cost by group by day (aggregate query)
□ GET /api/admin/gaps — open knowledge gaps with employee + group
□ GET /api/admin/agent-traces/:jobId — tool call log for debugging
□ GET /api/manager/gaps — manager sees own group's gaps
□ /admin/usage page: cost chart by group + model + date range
□ /admin/gaps page: list of open gaps with [Schedule capture] action
□ Manager dashboard: gaps section showing own group's open gaps
□ Test: copilot query → appears in /admin/usage within poll cycle
□ Test: flagged gap → appears in /admin/gaps and /manager/gaps
```

**Done when:** Admin can see LLM cost per group.
Managers see knowledge gaps for their team.
Agent traces accessible for debugging.

---

### 08 — Polish Pass (Phase 2.1 specific)

```
□ Loading state: "Inno is thinking..." with subtle animation while streaming
□ Job status polling fallback if SSE disconnects (GET /api/jobs/:id)
□ Auto-reconnect SSE on disconnect (max 3 attempts)
□ Intent badge on Inno messages in session view:
  go_deeper: subtle (invisible to employee, visible in manager view)
  wrap_up: triggers "Ready to wrap up?" nudge UI element
□ Agent steps counter in admin traces: "4 steps · 3 tool calls · 2.1s"
□ Knowledge gap notification badge on manager sidebar
□ Empty state for /admin/gaps: "No open gaps — knowledge base is complete"
□ Cost display format: "$0.003" not "0.003212847..."
```

---

### 09 — Deploy V1.2.0

```
□ Run all Phase 2.1 migrations on production Supabase in order
□ Deploy server to Railway (worker starts automatically with server)
□ Deploy client to Vercel
□ Smoke test: copilot query streams in real time
□ Smoke test: interrogation session streams Inno's response
□ Smoke test: agent makes 2+ tool calls on a complex question
□ Smoke test: gap flagged → appears in manager dashboard
□ Smoke test: llm_calls table populated after each query
□ Smoke test: 10 simultaneous copilot queries — all complete
□ Smoke test: server stays responsive during peak load test
□ Monitor: Railway logs show worker polling and processing jobs
□ Monitor: Supabase llm_calls table showing realistic token counts
```

---

## Definition of Phase 2.1 Complete

```
□ Job queue table exists and claim_next_job() works correctly
□ Worker starts with server and polls every 2 seconds
□ POST /api/copilot/query returns { jobId } in <50ms
□ POST /api/sessions/:id/message returns { jobId } in <50ms
□ SSE stream delivers tokens within 1–2 seconds of submission
□ Copilot agent makes real tool calls — search, get_article, flag_gap
□ Agent retries with different queries when first search is weak
□ Gaps flagged by agent appear in knowledge_gaps table
□ Inno agent checks coverage before asking about known topics
□ Inno intent (go_deeper / pivot_topic / wrap_up) logged per message
□ wrap_up intent triggers session end nudge in UI
□ All async AI tasks (embed, quality, title) go through job queue
□ llm_calls populated for every Gemini call
□ agent_tool_calls populated for every tool invocation
□ Admin can view LLM cost by group at /admin/usage
□ Manager sees open knowledge gaps at /manager/gaps
□ 10 simultaneous queries complete without timeout
□ Phase 2 caching still working (interrogation sessions use cache_id)
□ All Phase 1 + Phase 2 flows unchanged and working
□ V1.2.0 deployed and smoke tested on production
```

---

## Never Do These Things (Phase 2.1 additions)

```
✗ Await Gemini calls inside HTTP request handlers — always queue
✗ Use WebSockets — SSE is sufficient and simpler for one-way streaming
✗ Let the agent loop run more than 6 steps — MAX_STEPS hard limit
✗ Feed full article content in tool results when summary suffices
✗ Answer from Gemini's training data — always tool-search first
✗ Skip logging to llm_calls — observability is not optional
✗ Remove Phase 2 cache_id usage from Inno — caching stays
✗ Block the HTTP response while waiting for AI — always return { jobId }
✗ All Phase 1 + Phase 2 rules still apply in full
```

---

## How This Relates to Phase 3

Phase 2.1 builds single-agent tool use on both Copilot and Inno.
Phase 3 promotes this to full multi-agent orchestration:

```
Phase 2.1 (now):
  Copilot Agent    — one model, tool loop, streaming
  Inno Agent       — one model, tool loop, streaming
  Background Jobs  — embed, quality, title (no AI reasoning)

Phase 3 (later):
  Orchestrator     — routes requests to specialist agents
  Retrieval Agent  — specialist system prompt for search + rerank
  Synthesis Agent  — specialist system prompt for answer generation
  Quality Agent    — specialist for scoring + gap detection
  Staleness Agent  — background, runs nightly without user trigger
                     scans articles for drift vs recent sessions
```

The job queue and SSE infrastructure built in Phase 2.1 is unchanged
in Phase 3 — multi-agent jobs are just the same job types with more
internal complexity. No architectural rework required.
