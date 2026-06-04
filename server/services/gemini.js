import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/** Build the interrogation system prompt for a specific employee and role */
export const buildInterrogationSystemPrompt = (employeeName, roleName) =>
  `
You are a warm, deeply curious colleague conducting a knowledge capture
session with ${employeeName}, who works as a ${roleName}.

Your purpose: extract the knowledge that lives in their head — the things
they know that aren't written down anywhere — and help preserve it for
their team.

CONVERSATION STYLE:
- Sound like a thoughtful colleague, never like an AI assistant
- Ask one question at a time, always — never two at once
- Acknowledge what they share before asking the next question
- Use their name occasionally — not every message, just enough to feel personal
- Keep your messages short — 1 to 3 sentences maximum
- When something sounds important: "That's really worth capturing — can
  you walk me through that step by step?"

OPENING QUESTION — always start here:
"What's the one thing in your role that took you the longest to figure
out? The thing nobody told you when you started?"

FOLLOW-UP STRATEGY:
- If they mention a workaround → ask exactly how it works
- If they mention a person → ask why that person specifically
- If they mention timing → ask how they know when to do it
- If they mention a tool → ask what happens when it's unavailable
- Ask about exceptions and edge cases — real knowledge lives here

AFTER 8+ EXCHANGES — offer to wrap up:
"I think we've captured some genuinely valuable things here. Want to
go deeper on anything, or shall we wrap up and I'll turn this into
knowledge articles for your team?"

EXTRACT TOWARD THESE TOPICS:
- Step-by-step processes with the non-obvious steps named
- Key contacts — specific people and why them, not just role titles
- Common mistakes and exactly how to avoid them
- Unofficial workarounds that actually work
- Context explaining WHY things are done a certain way
- Timing and cadences that matter
- What to do when things go wrong

NEVER:
- Ask generic questions like "describe your responsibilities"
- Ask two questions in one message
- Summarize everything back to them
- Sound like a form or an interview
`.trim();

/** Build the article generation prompt from a completed session conversation */
export const buildArticleGenerationPrompt = (conversation, roleName) =>
  `
You have completed a knowledge capture conversation with a ${roleName}.

CONVERSATION:
${conversation}

Generate structured knowledge articles from this conversation.
Each article captures one distinct topic, process, or piece of knowledge.

Return a JSON array only — no preamble, no markdown fences.

Each article:
{
  "title":   "Specific title — e.g. Monthly Close: The 3pm Timeout Rule",
  "summary": "One sentence describing what this article covers",
  "content": "Full article in markdown. Include: overview, step-by-step where relevant, key contacts if mentioned, common mistakes, what to do when things go wrong. Write in second person.",
  "tags":    ["relevant", "tags"]
}

Rules:
- Generate 2 to 6 articles — split by distinct topic
- Titles must be specific — never generic like "System Tips"
- Content must use the specific details from the conversation
- If something was mentioned but not fully explained, note it:
  "Note: needs more detail — ask [name] directly"
- Never invent information not present in the conversation
- Return valid JSON array only
`.trim();

/** Format a message array into a readable conversation string */
export const formatConversation = (messages) =>
  messages
    .map((m) => `${m.role === "ai" ? "Inno" : "Employee"}: ${m.content}`)
    .join("\n\n");

/** Generate a short working title from the first few exchanges */
export const generateProvisionalTitle = async (conversation) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const prompt = `
Read the start of this knowledge capture conversation and generate a short working title describing the topic so far.

CONVERSATION SO FAR:
${conversation}

Rules:
- 4 to 8 words maximum
- Title case
- Describe the actual topic being discussed
- No punctuation at the end
- If not enough context yet, use the most relevant words from what has been discussed

Return the title only. Nothing else.
`.trim();
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};

/** Generate a final specific title for a completed session */
export const generateSessionTitle = async (conversation) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const prompt = `
Read this knowledge capture conversation and generate a short, specific title that describes what was actually discussed.

CONVERSATION:
${conversation}

Rules:
- 4 to 8 words maximum
- Title case
- Describe the specific topic, not the person or role
- No punctuation at the end
- Sound like a document title, not a sentence
- Be specific — use the actual subject matter

Good examples:
"Monthly Inventory Close and Timeout Workarounds"
"Refund Approval Process Above 500"
"New Promotion Campaign Request Checklist"
"Vendor Contact Priority and Escalation Steps"

Bad examples:
"IT Administrator Knowledge Session" — too generic
"Knowledge Capture" — says nothing

Return the title only. No quotes, no explanation.
`.trim();
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};

/** Diff new conversation messages against existing articles — returns new/updated/nothing_new */
export const runKnowledgeDiff = async (existingArticles, newMessages) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const prompt = `
You are a knowledge curator reviewing new conversation messages against an existing knowledge base. Your job is to think like a human — only update notes when something genuinely new or different is said. Ignore repetition and reconfirmation.

EXISTING KNOWLEDGE ARTICLES:
${existingArticles
  .map(
    (a, i) => `
[Article ${i + 1}]
ID: ${a.id}
Title: ${a.title}
Content: ${a.content}
`,
  )
  .join("\n---\n")}

NEW CONVERSATION MESSAGES (since last session completion):
${newMessages}

For each piece of information in the new messages, decide:

1. TRULY NEW — does not exist in any current article
   → Create a new article

2. UPDATE — new messages describe a changed process, corrected fact, or important addition to an existing article
   → Update that specific article
   → Preserve everything still accurate
   → Only change what actually changed
   → Note the specific reason in one sentence

3. REPETITION — confirms or restates what is already captured accurately
   → Ignore entirely, no action

Return a JSON object only. No preamble. No explanation.

{
  "new_articles": [
    {
      "title": "specific title",
      "summary": "one sentence",
      "content": "full markdown content",
      "tags": ["tag1", "tag2"]
    }
  ],
  "updated_articles": [
    {
      "id": "existing article uuid exactly as provided",
      "title": "updated title if changed, else same as before",
      "content": "full updated markdown content",
      "update_reason": "one sentence — what changed and why"
    }
  ],
  "nothing_new": false
}

If nothing genuinely new was captured:
{
  "new_articles": [],
  "updated_articles": [],
  "nothing_new": true
}

Never invent information.
Never update an article unless new messages explicitly contain different or additional information about that specific topic.

Additional constraints:
- Never output --- as content
- Never mark a paragraph as both removed and added if the meaning is the same — only flag genuine changes
- Preserve unchanged paragraphs verbatim
- Compare at the paragraph level, not the word level
- Never duplicate the same information in both new_articles and updated_articles
`.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const clean = text.replace(/```json\n?|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object in diff response");
  return JSON.parse(match[0]);
};

/** Generate knowledge articles from a completed session conversation */
export const generateArticles = async (prompt) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const parseRetryDelay = (msg = "") => {
    const match = msg.match(/retry in ([\d.]+)s/i);
    return match ? Math.ceil(parseFloat(match[1])) * 1000 + 2000 : 35000;
  };

  const attempt = async () => {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const stripped = text.replace(/```json\n?|```/g, "").trim();
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`No JSON array in response: ${stripped.slice(0, 200)}`);
    return JSON.parse(match[0]);
  };

  try {
    return await attempt();
  } catch (err) {
    if (err.status !== 429) throw err;
    const delay = parseRetryDelay(err.message);
    console.error(`[ARTICLE GEN] Rate limited — retrying in ${delay / 1000}s`);
    await new Promise((r) => setTimeout(r, delay));
    return await attempt();
  }
};

/** Classifies a question as 'broad' (needs synthesis) or 'specific' (direct answer) */
export const classifyQuestion = async (question) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent(`
Classify this question as either "broad" or "specific".

broad    — requires synthesizing across multiple topics or articles;
           asks for an overview, a full process, or everything about a subject
specific — has a single direct answer; asks about one fact, one step,
           or one targeted thing

Examples:
"What is the onboarding process?" → broad
"How can I turn on two-factor authentication?" → specific
"Explain the refund policy" → broad
"Who approves expenses over $500?" → specific

Question: "${question}"

Reply with exactly one word: broad or specific
`.trim());
    const text = result.response.text().trim().toLowerCase();
    return text.startsWith("broad") ? "broad" : "specific";
  } catch {
    return "specific";
  }
};

/** Rewrites the question into 3 search query variants for broader retrieval coverage */
export const expandQuery = async (question) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent(`
Rewrite the following question into 3 search queries
for an internal company knowledge base.

Original: "${question}"

Rules:
- Query 1: rephrase as a direct factual question
- Query 2: keywords and topic nouns only, no sentence
- Query 3: rephrase as a step-by-step process question
- Max 12 words each
- Return only a JSON array of 3 strings
- No explanation, no markdown fences

Return format: ["query1", "query2", "query3"]
`.trim());

    const text = result.response.text();
    const clean = text.replace(/```json|```/g, "").trim();
    const queries = JSON.parse(clean);
    return [...new Set([question, ...queries])];
  } catch {
    return [question];
  }
};

/** Build the copilot RAG prompt from a question, retrieved articles, and question type */
export const buildCopilotPrompt = (question, articles, questionType) =>
  `
You are InKnow — an internal knowledge assistant.
Answer using ONLY the articles provided below.
Do not use any outside knowledge.

ARTICLES (${articles.length} retrieved):
${articles.map((a, i) => `[${i + 1}] ${a.title}
Captured by: ${a.captured_by_name} · ${a.created_at}
${"─".repeat(40)}
${a.content}`).join("\n\n")}

QUESTION: ${question}

${questionType === "broad" ? `
This is a broad question. Your answer must:

- Synthesize information across ALL relevant articles
- Give a complete, detailed response
- Include step-by-step instructions if the question
  is about how to do something
- Use specific names, system names, and details
  from the articles — not generic descriptions
- Be thorough — a shallow answer is a wrong answer
  for this type of question
` : `
This is a specific question. Your answer must:
- Be direct and precise
- Answer exactly what was asked
- Keep it concise — 2-4 sentences is often enough
`}

Common rules:

- Never mention that you are an AI
- If articles partially answer the question,
  give what you have and note what is missing
- If no articles are relevant: respond with exactly
  "Nobody has captured this yet."
- End with sources used:
  Source: [title] · [captured by]
  (one per line, only articles actually used)
`.trim();

/** Answer a copilot question from retrieved article context */
export const answerFromContext = async (prompt) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const result = await model.generateContent(prompt);
  return result.response.text();
};

/**
 * Send one message in an ongoing interrogation session.
 * history = array of { role: 'ai'|'employee', content: string }
 */
export const sendInterrogationMessage = async (systemPrompt, history, newMessage) => {
  // systemInstruction must be on getGenerativeModel, not startChat
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: systemPrompt,
  });

  let formattedHistory = history.map((msg) => ({
    role: msg.role === "ai" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  // Merge consecutive same-role turns — Gemini requires strictly alternating turns.
  const merged = [];
  for (const turn of formattedHistory) {
    if (merged.length > 0 && merged[merged.length - 1].role === turn.role) {
      merged[merged.length - 1].parts[0].text += "\n" + turn.parts[0].text;
    } else {
      merged.push(turn);
    }
  }
  formattedHistory = merged;

  // Gemini requires history to start with a user turn. The session opening
  // message is an AI turn with no preceding user message, so inject the
  // synthetic trigger that was used when the session was created.
  if (formattedHistory.length > 0 && formattedHistory[0].role === "model") {
    formattedHistory = [
      { role: "user", parts: [{ text: "begin" }] },
      ...formattedHistory,
    ];
  }

  // Extract retry delay from Gemini 429 error message, e.g. "retry in 29.2s"
  const parseRetryDelay = (msg = "") => {
    const match = msg.match(/retry in ([\d.]+)s/i);
    return match ? Math.ceil(parseFloat(match[1])) * 1000 + 2000 : 35000;
  };

  const attempt = async () => {
    const chat = model.startChat({ history: formattedHistory });
    return (await chat.sendMessage(newMessage)).response.text();
  };

  try {
    return await attempt();
  } catch (err) {
    if (err.status !== 429) throw err;
    const delay = parseRetryDelay(err.message);
    console.error(`[GEMINI] Rate limited — retrying in ${delay / 1000}s`);
    await new Promise((r) => setTimeout(r, delay));
    return await attempt();
  }
};
