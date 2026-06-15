export const COPILOT_TOOLS = [
  {
    name: "search_knowledge",
    description: `Search the company knowledge base for articles relevant to a query.
Call this when you need information to answer a question.
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
    description: `Flag a topic as a knowledge gap when no relevant articles exist
after searching. This notifies the manager's dashboard so a knowledge
capture session can be scheduled. Only call this after at least one
search has returned no useful results.`,
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
    description: `Ask the employee a clarifying question when their query is genuinely
ambiguous between two or more knowledge areas and you cannot determine
which to search. Use sparingly — try to infer intent from context first.`,
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
