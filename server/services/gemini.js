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

  // Gemini requires history to start with a user turn. The session opening
  // message is an AI turn with no preceding user message, so inject the
  // synthetic trigger that was used when the session was created.
  if (formattedHistory.length > 0 && formattedHistory[0].role === "model") {
    formattedHistory = [
      { role: "user", parts: [{ text: "begin" }] },
      ...formattedHistory,
    ];
  }

  const chat = model.startChat({ history: formattedHistory });
  const result = await chat.sendMessage(newMessage);
  return result.response.text();
};
