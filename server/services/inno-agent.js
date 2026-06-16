import supabase from "../db/supabase.js";
import { streamToken, streamComplete, streamError } from "../workers/job-worker.js";
import {
  buildInterrogationSystemPrompt,
  buildSessionContext,
  createSessionCache,
  isCacheValid,
  sendCachedMessage,
  sendInterrogationMessage,
  generateProvisionalTitle,
  formatConversation,
} from "./gemini.js";

/** Rebuild the Gemini cache for a session and persist the new cache id. */
const rebuildCache = async (sessionId, groupId, employeeName, jobTitle) => {
  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();
  const groupName = group?.name || "your team";
  const context = await buildSessionContext(groupId, jobTitle || "employee", groupName);
  const systemPrompt = buildInterrogationSystemPrompt(
    employeeName,
    jobTitle || "employee",
    groupName,
    context,
  );

  let cacheId = null;
  try {
    cacheId = await createSessionCache(systemPrompt);
    if (cacheId) {
      await supabase
        .from("interrogation_sessions")
        .update({ gemini_cache_id: cacheId })
        .eq("id", sessionId);
    }
  } catch (err) {
    if (!err.message?.includes("too small")) {
      console.error("[INNO-AGENT] Cache rebuild failed:", err.message?.slice(0, 200));
    }
  }

  return { cacheId, systemPrompt };
};

/**
 * Detect conversational intent from the AI response text.
 * The system prompt writes a very specific closing message on wrap-up —
 * we detect it here so the frontend can show the end-session nudge.
 */
const detectIntent = (message) => {
  const lower = message.toLowerCase();
  if (
    lower.includes("end session button") ||
    lower.includes("click the end") ||
    lower.includes("go ahead and click") ||
    lower.includes("knowledge articles for your team") ||
    lower.includes("wrap up")
  ) {
    return "wrap_up";
  }
  return "go_deeper";
};

export const runInnoMessage = async (jobId, payload) => {
  const { sessionId, employeeMessage, groupId, employeeName, jobTitle } = payload;

  const { data: session, error: sessionErr } = await supabase
    .from("interrogation_sessions")
    .select("gemini_cache_id, message_count, title")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    streamError(jobId, "Session not found — try again.");
    return;
  }

  // Load full history from DB. The last entry is the employee message already saved
  // by the route. Exclude it — sendCachedMessage receives it as the new message arg.
  const { data: fullHistory } = await supabase
    .from("session_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const history = (fullHistory || []).slice(0, -1);

  // Resolve cache — rebuild if expired or absent
  let cacheId = session.gemini_cache_id;
  let systemPrompt = null;

  if (cacheId) {
    const valid = await isCacheValid(cacheId);
    if (!valid) {
      const rebuilt = await rebuildCache(sessionId, groupId, employeeName, jobTitle);
      cacheId = rebuilt.cacheId;
      systemPrompt = rebuilt.systemPrompt;
    }
  } else {
    const built = await rebuildCache(sessionId, groupId, employeeName, jobTitle);
    cacheId = built.cacheId;
    systemPrompt = built.systemPrompt;
  }

  // Generate response using the same reliable path as Phase 2
  let innoMessage;
  try {
    if (cacheId) {
      innoMessage = await sendCachedMessage(cacheId, history, employeeMessage);
    } else {
      innoMessage = await sendInterrogationMessage(systemPrompt, history, employeeMessage);
    }
  } catch (err) {
    console.error("[INNO-AGENT] generation failed:", err.message?.slice(0, 200));
    streamError(jobId, "The AI is taking too long — try again.");
    return;
  }

  if (!innoMessage) {
    streamError(jobId, "The AI is taking too long — try again.");
    return;
  }

  const intent = detectIntent(innoMessage);

  // Persist AI message with intent field
  await supabase.from("session_messages").insert({
    session_id: sessionId,
    role: "ai",
    content: innoMessage,
    intent,
  });

  // Increment message_count and fire-and-forget title gen at 6 messages (3 exchanges)
  const newCount = (session.message_count || 0) + 1;
  await supabase
    .from("interrogation_sessions")
    .update({ message_count: newCount })
    .eq("id", sessionId);

  if (newCount === 6 && !session.title) {
    supabase
      .from("session_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .then(({ data: allMsgs }) => generateProvisionalTitle(formatConversation(allMsgs || [])))
      .then((title) =>
        supabase
          .from("interrogation_sessions")
          .update({ title, title_generated_at: new Date().toISOString() })
          .eq("id", sessionId),
      )
      .catch(() => {});
  }

  // Stream response token by token, then signal completion
  const words = innoMessage.split(" ");
  for (const word of words) {
    streamToken(jobId, word + " ");
    await new Promise((r) => setTimeout(r, 5));
  }

  streamComplete(jobId, { message: innoMessage, intent });
  return { message: innoMessage, intent };
};
