import supabase from "../db/supabase.js";

/**
 * Create or update an llm_calls record.
 * Pass { jobId, employeeId, groupId, callType, model } to create.
 * Pass { id, promptTokens, completionTokens, ... } to update with final metrics.
 * Returns the record id, or null if the DB write fails (non-fatal).
 */
export const logLLMCall = async (data) => {
  try {
    if (data.id) {
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

    const { data: record } = await supabase
      .from("llm_calls")
      .insert({
        job_id: data.jobId,
        session_id: data.sessionId || null,
        employee_id: data.employeeId,
        group_id: data.groupId,
        call_type: data.callType,
        model: data.model,
      })
      .select("id")
      .single();

    return record?.id ?? null;
  } catch (err) {
    console.error("[observability] logLLMCall failed:", err.message);
    return null;
  }
};

/** Log a single tool invocation inside an agent loop step. */
export const logToolCall = async ({ llmCallId, step, toolName, input, output, durationMs }) => {
  if (!llmCallId) return;
  try {
    await supabase.from("agent_tool_calls").insert({
      llm_call_id: llmCallId,
      step,
      tool_name: toolName,
      input,
      output,
      duration_ms: durationMs,
    });
  } catch (err) {
    console.error("[observability] logToolCall failed:", err.message);
  }
};
