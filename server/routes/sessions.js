import { Router } from "express";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";
import {
  buildInterrogationSystemPrompt,
  sendInterrogationMessage,
} from "../services/gemini.js";

const router = Router();
router.use(auth);

// POST /api/sessions — create session and generate AI opening message
router.post("/", async (req, res, next) => {
  try {
    const employeeId = req.employee.id;

    const { data: employee, error: empErr } = await supabase
      .from("employees")
      .select("name, role_id, roles(name)")
      .eq("id", employeeId)
      .single();

    if (empErr || !employee) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    const { data: session, error: sessionErr } = await supabase
      .from("interrogation_sessions")
      .insert({ employee_id: employeeId, role_id: employee.role_id })
      .select()
      .single();

    if (sessionErr) throw sessionErr;

    const systemPrompt = buildInterrogationSystemPrompt(
      employee.name,
      employee.roles.name,
    );

    // Empty history — Gemini generates the opening question from the system prompt
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
      .select("id, role_id, employee_id, employees(name, roles(name))")
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

    if (session.status === "completed") {
      return res.status(400).json({
        data: null,
        error: "Session completed",
        message: "This session is already complete.",
      });
    }

    // Load existing history BEFORE saving the new employee message.
    // This way a Gemini failure never leaves an orphaned employee message in the DB.
    const { data: history, error: histErr } = await supabase
      .from("session_messages")
      .select("role, content")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (histErr) throw histErr;

    const systemPrompt = buildInterrogationSystemPrompt(
      session.employees.name,
      session.employees.roles.name,
    );

    const aiText = await sendInterrogationMessage(
      systemPrompt,
      history,
      content.trim(),
    );

    // Gemini succeeded — now persist both messages
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

    res.json({
      data: { employeeMessage: empMsg, aiMessage: aiMsg },
      error: null,
      message: null,
    });
  } catch (err) {
    console.log("SESSIONS ROUTE CATCH:", err.status, err.message?.slice(0, 200));
    next(err);
  }
});

// POST /api/sessions/:id/complete — mark session as completed
router.post("/:id/complete", async (req, res, next) => {
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

    const { data: completed, error: updateErr } = await supabase
      .from("interrogation_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", session.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ data: { session: completed }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
