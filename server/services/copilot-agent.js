import { GoogleGenerativeAI } from "@google/generative-ai";
import supabase from "../db/supabase.js";
import { streamToken, streamComplete, streamError } from "../workers/job-worker.js";
import { COPILOT_TOOLS } from "./copilot-tools.js";
import { retrieveArticles, getArticleById, flagGap } from "./rag.js";
import { logLLMCall, logToolCall } from "./observability.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MAX_STEPS = 6;

const SYSTEM_INSTRUCTION = `You are Inno, InKnow's knowledge copilot.
Your job: answer the employee's question using the company knowledge base.

HOW TO SEARCH:
- Always search before answering — never use your own training data
- If search returns nothing above 0.45 similarity, try a different query angle
- Try at least 2 different search queries before concluding nothing exists
- After finding relevant results, call get_article for the top matches to read the full content
- Never write a final answer until you have read at least one article in full

WHEN YOU CAN ANSWER:
- Write a direct, complete answer — the employee should not need to go anywhere else
- Synthesize across all relevant articles into one clear response
- Never reference article titles, never say "based on the articles" or "according to the search results"
- Sources are tracked automatically — never add a Source line to your response

WHEN YOU CANNOT ANSWER — this is critical:
You MUST call flag_knowledge_gap before writing any response when the knowledge base has no answer.
Then write a response based on your honest assessment of WHY there is no answer:

Case 1 — Topic genuinely not captured by anyone yet:
Call flag_knowledge_gap, then respond naturally. Example:
"Nobody on your team has captured this yet — it's a gap in the knowledge base. You could be the first to document it by starting a capture session."

Case 2 — Topic sounds like it belongs to a specific team or function (HR, Finance, Legal, IT, etc.) that is not your group:
Call flag_knowledge_gap, then respond naturally. Example:
"This sounds like something the [HR / Finance / IT] team would own — it's not in your group's knowledge base. You're better off asking them directly."

Case 3 — Question is too vague to search meaningfully:
Use ask_clarification instead of searching.

NEVER:
- Say "the search results do not contain" — the employee does not know how you work
- Say "the provided articles" or "based on what was retrieved"
- Give up after one search attempt
- Answer without calling flag_knowledge_gap first when you cannot answer
- Invent information not in the knowledge base`;

export const runCopilotAgent = async (jobId, payload) => {
  const { question, groupId, employeeId } = payload;
  const startTime = Date.now();
  const sources = [];
  let maxSimilarity = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let toolCallsMade = 0;
  let steps = 0;
  let gapFlagged = false;

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
      // 5ms per word keeps streaming visible without adding noticeable latency.
      const words = finalText.split(" ");
      for (const word of words) {
        streamToken(jobId, word + " ");
        await new Promise((r) => setTimeout(r, 5));
      }

      // If the agent called flag_knowledge_gap, it decided this is a gap.
      // Sources collected during search are not credited — the agent couldn't answer from them.
      const uniqueSources = gapFlagged
        ? []
        : [...new Map(sources.map((s) => [s.id, s])).values()];

      const confidence = gapFlagged ? 0 : Math.round(maxSimilarity * 100);

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
          gapFlagged = true;
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
