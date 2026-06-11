import { Router } from "express";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";
import {
  buildInterrogationSystemPrompt,
  sendInterrogationMessage,
  buildArticleGenerationPrompt,
  generateArticles,
  generateSessionTitle,
  generateProvisionalTitle,
  runKnowledgeDiff,
  formatConversation,
} from "../services/gemini.js";

const router = Router();
router.use(auth);

// POST /api/sessions — create session and generate AI opening message
router.post("/", async (req, res, next) => {
  try {
    if (!req.employee.group_id) {
      return res.status(400).json({
        data: null,
        error: "No group",
        message: "You need to join a group before starting a session.",
      });
    }

    const { data: session, error: sessionErr } = await supabase
      .from("interrogation_sessions")
      .insert({ employee_id: req.employee.id, group_id: req.employee.group_id })
      .select()
      .single();

    if (sessionErr) throw sessionErr;

    const systemPrompt = buildInterrogationSystemPrompt(
      req.employee.name,
      req.employee.job_title || "employee",
    );

    const openingText = await sendInterrogationMessage(systemPrompt, [], "begin");

    const { data: openingMsg, error: msgErr } = await supabase
      .from("session_messages")
      .insert({ session_id: session.id, role: "ai", content: openingText })
      .select()
      .single();

    if (msgErr) throw msgErr;

    res.status(201).json({
      data: { session, messages: [openingMsg] },
      error: null,
      message: null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions — list sessions for the authenticated employee
router.get("/", async (req, res, next) => {
  try {
    const { data: sessions, error } = await supabase
      .from("interrogation_sessions")
      .select("id, status, title, group_id, started_at, completed_at, last_completed_at, groups(name)")
      .eq("employee_id", req.employee.id)
      .order("started_at", { ascending: false });

    if (error) throw error;

    if (!sessions.length) {
      return res.json({ data: { sessions: [] }, error: null, message: null });
    }

    const ids = sessions.map((s) => s.id);
    const { data: counts, error: countErr } = await supabase
      .from("session_messages")
      .select("session_id")
      .in("session_id", ids);

    if (countErr) throw countErr;

    const countMap = counts.reduce((acc, m) => {
      acc[m.session_id] = (acc[m.session_id] || 0) + 1;
      return acc;
    }, {});

    const result = sessions.map((s) => ({
      ...s,
      message_count: countMap[s.id] || 0,
    }));

    res.json({ data: { sessions: result }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id — return session with all messages
router.get("/:id", async (req, res, next) => {
  try {
    const { data: session, error: sessionErr } = await supabase
      .from("interrogation_sessions")
      .select()
      .eq("id", req.params.id)
      .eq("employee_id", req.employee.id)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    const { data: messages, error: msgErr } = await supabase
      .from("session_messages")
      .select()
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (msgErr) throw msgErr;

    res.json({ data: { session, messages }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id/articles — return all knowledge articles for this session
router.get("/:id/articles", async (req, res, next) => {
  try {
    const { data: articles, error } = await supabase
      .from("knowledge_articles")
      .select("id, title, summary, version, approved, created_at, updated_at, captured_by")
      .eq("session_id", req.params.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({ data: { articles: articles || [] }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/message — send employee message, get AI response
router.post("/:id/message", async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({
        data: null,
        error: "Missing content",
        message: "We need this to continue.",
      });
    }

    const { data: session, error: sessionErr } = await supabase
      .from("interrogation_sessions")
      .select("id, status, group_id, employee_id, message_count, title, last_completion_message_id")
      .eq("id", req.params.id)
      .eq("employee_id", req.employee.id)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    const { data: history, error: histErr } = await supabase
      .from("session_messages")
      .select("role, content")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (histErr) throw histErr;

    const systemPrompt = buildInterrogationSystemPrompt(
      req.employee.name,
      req.employee.job_title || "employee",
    );

    const aiText = await sendInterrogationMessage(
      systemPrompt,
      history,
      content.trim(),
    );

    const { data: empMsg, error: empMsgErr } = await supabase
      .from("session_messages")
      .insert({ session_id: session.id, role: "employee", content: content.trim() })
      .select()
      .single();

    if (empMsgErr) throw empMsgErr;

    const { data: aiMsg, error: aiMsgErr } = await supabase
      .from("session_messages")
      .insert({ session_id: session.id, role: "ai", content: aiText })
      .select()
      .single();

    if (aiMsgErr) throw aiMsgErr;

    // Track message count and flip completed → re-opened
    const newCount = (session.message_count || 0) + 2;
    const sessionUpdates = { message_count: newCount };
    if (session.status === "completed") {
      sessionUpdates.status = "re-opened";
    }

    await supabase
      .from("interrogation_sessions")
      .update(sessionUpdates)
      .eq("id", session.id);

    // Fire-and-forget provisional title after 3 exchanges (6 messages)
    if (newCount === 6 && !session.title) {
      supabase
        .from("session_messages")
        .select("role, content")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true })
        .then(({ data: allMsgs }) => {
          const conversation = formatConversation(allMsgs || []);
          return generateProvisionalTitle(conversation);
        })
        .then((title) => {
          supabase
            .from("interrogation_sessions")
            .update({ title, title_generated_at: new Date().toISOString() })
            .eq("id", session.id);
        })
        .catch(() => {});
    }

    const updatedStatus = sessionUpdates.status || session.status;

    res.json({
      data: { employeeMessage: empMsg, aiMessage: aiMsg, sessionStatus: updatedStatus },
      error: null,
      message: null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/complete — two-path completion
router.post("/:id/complete", async (req, res, next) => {
  try {
    const { data: session, error: sessionErr } = await supabase
      .from("interrogation_sessions")
      .select("*")
      .eq("id", req.params.id)
      .eq("employee_id", req.employee.id)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    const { data: messages, error: msgErr } = await supabase
      .from("session_messages")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (msgErr) throw msgErr;

    const conversation = formatConversation(messages);
    const jobTitle = req.employee.job_title || "employee";
    const lastMessage = messages[messages.length - 1];

    // ── PATH A: First completion ──────────────────────────────────────────
    if (session.status === "active") {
      let articles = [];
      let title = session.title || `${jobTitle} Session`;

      try {
        [articles, title] = await Promise.all([
          generateArticles(buildArticleGenerationPrompt(conversation, jobTitle)),
          generateSessionTitle(conversation),
        ]);
      } catch (genErr) {
        console.error("[COMPLETE] Generation failed:", genErr.message?.slice(0, 200));
        return res.json({
          data: { type: "generation_failed", generationFailed: true },
          error: null,
          message: null,
        });
      }

      if (articles.length === 0) {
        return res.json({
          data: { type: "generation_empty" },
          error: null,
          message: null,
        });
      }

      await supabase
        .from("interrogation_sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          last_completed_at: new Date().toISOString(),
          last_completion_message_id: lastMessage?.id || null,
          title,
          title_generated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      return res.json({
        data: { type: "first_completion", articles, title },
        error: null,
        message: null,
      });
    }

    // ── PATH B: Re-opened completion ──────────────────────────────────────
    if (session.status === "re-opened") {
      const { data: existingArticles } = await supabase
        .from("knowledge_articles")
        .select("id, title, content, summary, tags")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      const lastCompletionIndex = session.last_completion_message_id
        ? messages.findIndex((m) => m.id === session.last_completion_message_id)
        : -1;

      const newMessages = messages.slice(lastCompletionIndex + 1);
      const newConversation = formatConversation(newMessages);

      let diffResult;
      try {
        diffResult = await runKnowledgeDiff(existingArticles || [], newConversation);
      } catch (diffErr) {
        console.error("[COMPLETE] Diff failed:", diffErr.message?.slice(0, 200));
        return res.json({
          data: { type: "generation_failed", generationFailed: true },
          error: null,
          message: null,
        });
      }

      await supabase
        .from("interrogation_sessions")
        .update({
          status: "completed",
          last_completed_at: new Date().toISOString(),
          last_completion_message_id: lastMessage?.id || null,
        })
        .eq("id", session.id);

      if (diffResult.nothing_new) {
        return res.json({
          data: { type: "nothing_new" },
          error: null,
          message: null,
        });
      }

      const enrichedUpdates = (diffResult.updated_articles || []).map((u) => {
        const existing = (existingArticles || []).find((a) => a.id === u.id);
        return {
          ...u,
          current_title: existing?.title || u.title,
          current_content: existing?.content || "",
          current_summary: existing?.summary || "",
        };
      });

      return res.json({
        data: {
          type: "re_opened_completion",
          new_articles: diffResult.new_articles || [],
          updated_articles: enrichedUpdates,
        },
        error: null,
        message: null,
      });
    }

    return res.status(400).json({
      data: null,
      error: "Cannot complete session",
      message: "Something went wrong — try again.",
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/articles — retry article generation for a completed session
router.post("/:id/articles", async (req, res, next) => {
  try {
    const { data: session, error: sessionErr } = await supabase
      .from("interrogation_sessions")
      .select("*")
      .eq("id", req.params.id)
      .eq("employee_id", req.employee.id)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    const { data: messages, error: msgErr } = await supabase
      .from("session_messages")
      .select("role, content")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (msgErr) throw msgErr;

    const conversation = formatConversation(messages);
    const prompt = buildArticleGenerationPrompt(
      conversation,
      req.employee.job_title || "employee",
    );
    const articles = await generateArticles(prompt);

    res.json({ data: { articles }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
