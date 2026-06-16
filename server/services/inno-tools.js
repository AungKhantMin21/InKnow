export const INNO_TOOLS = [
  {
    name: "check_existing_coverage",
    description: `Check what knowledge already exists in the group's knowledge base on a specific topic.
CALL THIS FIRST whenever the employee introduces a new subject or says they want to discuss something — before calling send_message.
Similarity above 0.5 means the topic is already captured. Use the results to ask more targeted follow-up questions rather than generic ones.`,
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
    description: `Send your response to the employee. This is the ONLY way to reply — never return plain text.
ALWAYS call this as your last action each turn, after any check_existing_coverage or record_knowledge_captured calls.
The intent field tells the system the conversational direction.`,
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
