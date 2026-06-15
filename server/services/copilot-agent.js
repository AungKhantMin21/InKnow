import { GoogleGenerativeAI } from "@google/generative-ai";
import supabase from "../db/supabase.js";
import { streamToken, streamComplete, streamError } from "../workers/job-worker.js";
import { COPILOT_TOOLS } from "./copilot-tools.js";
import { retrieveArticles, getArticleById, flagGap } from "./rag.js";
import { logLLMCall, logToolCall } from "./observability.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MAX_STEPS = 6;

const SYSTEM_INSTRUCTION = `You are Inno, InKnow's knowledge copilot.
Your job: answer the employee's question directly and completely using the company knowledge base.

Rules:
- Always search before answering — never answer from your own training data
- If search results have similarity below 0.45, search again with a different query
- After searching, you MUST call get_article for the top result before composing any answer — summaries are not enough
- If multiple results look relevant, call get_article for each of them
- Never write a final answer until you have fetched at least one article's full content
- Only flag a gap after genuinely trying multiple search approaches and finding nothing above 0.45
- Be direct and specific — employees need actionable, complete answers
- Use ask_clarification at most once, only when the question is genuinely ambiguous with no way to infer intent

Answer format:
- Write the full answer in your response — the employee must not need to open any article or document
- Synthesize information from all fetched articles into one cohesive response
- Do NOT end with "you can read more in...", "these workflows are detailed in...", or any referral to articles
- Do NOT list article titles at the end of your answer
- Sources are tracked automatically — never add a "Source:" line or article list to your response`;

export const runCopilotAgent = async (jobId, payload) => {
  const { question, groupId, employeeId } = payload;
  const startTime = Date.now();
  const sources = [];
  let maxSimilarity = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let toolCallsMade = 0;
  let steps = 0;

  const llmCallId = await logLLMCall({
    jobId,
    sessionId: null,
    employeeId,
    groupId,
    callType: "copilot_tool_call",
    model: "gemini-2.5-flash-lite",
  });

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    tools: [{ functionDeclarations: COPILOT_TOOLS }],
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: { temperature: 0.3 },
  });

  const chat = model.startChat();
  let result = await chat.sendMessage(
    `Employee question: "${question}"\n\nSearch the knowledge base and answer this.`,
  );

  while (steps < MAX_STEPS) {
    steps++;
    const response = result.response;

    if (response.usageMetadata) {
      totalPromptTokens += response.usageMetadata.promptTokenCount || 0;
      totalCompletionTokens += response.usageMetadata.candidatesTokenCount || 0;
    }

    // Gemini occasionally returns undefined content (safety filter, transient error).
    // Default to [] so the loop doesn't crash — the empty-finalText guard below catches it.
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const toolCalls = parts.filter((p) => p.functionCall);

    // ── No tool calls = model is ready to answer ─────────────────────────────
    if (toolCalls.length === 0) {
      const finalText = parts.find((p) => p.text)?.text || "";

      if (!finalText) {
        streamError(jobId, "The AI is taking too long — try again.");
        return;
      }

      // Stream the answer word by word so the UI can render it progressively.
      // 20ms per word on a 100-word answer = ~2s of visible streaming.
      const words = finalText.split(" ");
      for (const word of words) {
        streamToken(jobId, word + " ");
        await new Promise((r) => setTimeout(r, 20));
      }

      const uniqueSources = [...new Map(sources.map((s) => [s.id, s])).values()];

      const confidence = Math.round(maxSimilarity * 100);

      // Save the Q&A to copilot_queries so the feedback route can reference it.
      let queryId = null;
      try {
        const { data: queryRow } = await supabase
          .from("copilot_queries")
          .insert({
            employee_id: employeeId,
            question,
            answer: finalText,
            source_article_ids: uniqueSources.map((s) => s.id),
            confidence_score: maxSimilarity,
          })
          .select("id")
          .single();
        queryId = queryRow?.id ?? null;
      } catch {
        // non-fatal — feedback won't be linkable but the answer still reaches the user
      }

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
        sources: uniqueSources,
        queryId,
        confidence,
        agentSteps: steps,
        toolCallsMade,
      });

      return { answer: finalText, sources: uniqueSources, queryId, confidence, agentSteps: steps, toolCallsMade };
    }

    // ── Execute every tool call the model requested ───────────────────────────
    const toolResults = await Promise.all(
      toolCalls.map(async (part) => {
        const { name, args } = part.functionCall;
        const toolStart = Date.now();
        toolCallsMade++;
        let toolOutput;

        if (name === "search_knowledge") {
          try {
            const articles = await retrieveArticles(
              args.query,
              groupId,
              args.threshold ?? 0.45,
            );
            const highest = articles[0]?.similarity || 0;
            if (highest > maxSimilarity) maxSimilarity = highest;
            toolOutput = {
              articles: articles.map((a) => ({
                id: a.id,
                title: a.title,
                summary: a.summary,
                similarity: parseFloat((a.similarity || 0).toFixed(3)),
              })),
              count: articles.length,
              highest_similarity: highest,
            };
          } catch {
            toolOutput = { articles: [], count: 0, highest_similarity: 0 };
          }

        } else if (name === "get_article") {
          const article = await getArticleById(args.article_id, groupId);
          if (!article) {
            toolOutput = { error: "Article not found or not accessible" };
          } else {
            sources.push({
              id: article.id,
              title: article.title,
              captured_by_name: article.captured_by_name,
              group_name: article.group_name,
            });
            toolOutput = {
              id: article.id,
              title: article.title,
              content: article.content,
            };
          }

        } else if (name === "flag_knowledge_gap") {
          try {
            await flagGap({
              topic: args.topic,
              originalQuestion: args.original_question,
              employeeId,
              groupId,
            });
          } catch {
            // gap logging is best-effort — never block the response
          }
          toolOutput = { flagged: true };

        } else if (name === "ask_clarification") {
          // Stream the clarification question directly to the client and stop.
          streamToken(jobId, args.question);
          streamComplete(jobId, {
            clarification: args.question,
            agentSteps: steps,
            toolCallsMade,
          });
          return {
            functionResponse: { name, response: { clarification_sent: true } },
            isClarification: true,
          };

        } else {
          toolOutput = { error: `Unknown tool: ${name}` };
        }

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

    // Clarification was sent — the loop is done
    if (toolResults.some((r) => r.isClarification)) return;

    // Feed all tool results back to the model for the next step
    result = await chat.sendMessage(
      toolResults.map((r) => ({ functionResponse: r.functionResponse })),
    );
  }

  streamError(jobId, "Could not find a complete answer. Please try rephrasing.");
};
