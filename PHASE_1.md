# PHASE_1.md — InKnow MVP Build Context

## Feed this file to Claude Code at the start of every session.

---

## What You Are Building

**InKnow** — an internal knowledge base platform built around conversational
knowledge capture. This is Phase 1: the complete MVP.

The product solves one problem: institutional knowledge lives in people's heads.
When they leave, it leaves with them. InKnow fixes this through AI-powered
interrogation sessions — structured conversations that extract knowledge
naturally, then generate structured knowledge articles automatically.

**Three flows in this MVP:**

1. Interrogation — AI interviews an employee, extracts knowledge conversationally
2. Article generation — AI structures the conversation into knowledge articles
3. Copilot — employees query the knowledge base in natural language

---

## Tech Stack

```
Frontend:     React 18 + Vite + React Router v6
Styling:      Tailwind CSS v3 — utility-first, NO component libraries
Backend:      Express.js + Node.js
Database:     Supabase (PostgreSQL + pgvector extension)
Auth:         JWT (jsonwebtoken + bcrypt)
AI:           Google Gemini API — model: gemini-2.5-flash-lite (all AI tasks)
Embeddings:   Google text-embedding-004 (768 dimensions)
Rich text:    Tiptap (article editor in review flow)
Hosting:      Vercel (frontend) + Railway (backend)
HTTP:         Axios
```

**Hard rules on dependencies:**

- No UI libraries — no MUI, Shadcn, Chakra, Radix, Ant Design, nothing
- No ORM — use Supabase JS client directly
- No state management library — React state only
- Question every npm install before running it

---

## Project Structure

```
inknow/
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── lib/
│       │   ├── api.js          # ALL axios calls live here — nowhere else
│       │   ├── auth.js         # Token helpers (save/get/remove from localStorage)
│       │   ├── markdown.js     # markdownToHtml / htmlToMarkdown helpers
│       │   ├── diff.js         # Client-side diff helpers for article review
│       │   └── diffEngine.js   # Paragraph-level diff engine
│       ├── hooks/
│       │   └── useAuth.jsx     # Auth state — user, loading, login, logout
│       ├── components/
│       │   ├── ui/             # AIAvatar, Sidebar
│       │   ├── layout/
│       │   ├── chat/
│       │   └── knowledge/      # ArticleDiffView
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Session.jsx
│           ├── SessionsList.jsx
│           ├── SessionComplete.jsx
│           ├── ArticleReview.jsx
│           ├── Copilot.jsx
│           ├── Knowledge.jsx
│           ├── ArticleDetail.jsx
│           └── Manager.jsx
│
├── server/
│   ├── index.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── roles.js
│   │   ├── sessions.js
│   │   ├── knowledge.js
│   │   ├── copilot.js
│   │   └── manager.js
│   ├── services/
│   │   ├── gemini.js           # All Gemini API calls — chat, generation, prompts
│   │   ├── embeddings.js       # Google text-embedding-004
│   │   └── rag.js              # Retrieval logic — enrichWithNames, retrieveArticles
│   └── db/
│       └── supabase.js
│
├── PHASE_1.md
├── CLAUDE.md
└── .env.example
```

---

## Environment Variables

```bash
# server/.env
PORT=3001
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
JWT_SECRET=                     # minimum 32 characters
GEMINI_API_KEY=                 # one key covers both chat and embeddings

# client/.env
VITE_API_URL=http://localhost:3001
```

One API key covers everything AI-related — chat, generation, and embeddings
all use the same Google Gemini API key.

---

## Database Schema

Run this in full in Supabase SQL editor before writing any application code.

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Roles
CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  department  text,
  description text,
  created_at  timestamptz DEFAULT now()
);

-- Employees
CREATE TABLE employees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text UNIQUE NOT NULL,
  password    text NOT NULL,
  role_id     uuid REFERENCES roles(id),
  is_manager  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Interrogation sessions
-- status: active → completed (first completion) → re-opened (employee sends more messages)
--         re-opened → completed again on subsequent completions
CREATE TABLE interrogation_sessions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                 uuid REFERENCES employees(id) ON DELETE CASCADE,
  role_id                     uuid REFERENCES roles(id),
  status                      text CHECK (status IN ('active','completed','re-opened','abandoned'))
                              DEFAULT 'active',
  title                       text,                         -- auto-generated by Gemini after 3 exchanges
  title_generated_at          timestamptz,
  message_count               integer DEFAULT 0,            -- total messages in session
  last_completion_message_id  uuid,                         -- last message when completed — used to detect new messages on re-open
  started_at                  timestamptz DEFAULT now(),
  completed_at                timestamptz,
  last_completed_at           timestamptz                   -- updated on every completion (including re-opened)
);

-- Session messages
CREATE TABLE session_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid REFERENCES interrogation_sessions(id) ON DELETE CASCADE,
  role        text CHECK (role IN ('ai','employee')) NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Knowledge articles
-- NOTE: embedding is vector(768) — Google text-embedding-004 dimensions
-- version: increments each time the article is updated from a re-opened session
-- rejected: soft delete — rejected articles stay in DB but are never shown to employees or fed to AI
CREATE TABLE knowledge_articles (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id                 uuid REFERENCES roles(id),
  session_id              uuid REFERENCES interrogation_sessions(id),
  updated_from_session_id uuid REFERENCES interrogation_sessions(id),
  title                   text NOT NULL,
  summary                 text,
  content                 text NOT NULL,
  tags                    text[],
  version                 integer DEFAULT 1,
  previous_title          text,                 -- stores title before last update
  previous_content        text,                 -- stores content before last update
  update_reason           text,                 -- one-sentence reason from Gemini diff
  approved                boolean DEFAULT false,
  approved_by             uuid REFERENCES employees(id),
  approved_at             timestamptz,
  rejected                boolean DEFAULT false, -- soft delete — never hard-delete articles
  captured_by             uuid REFERENCES employees(id),
  embedding               vector(768),
  view_count              integer DEFAULT 0,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- Copilot queries
CREATE TABLE copilot_queries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        uuid REFERENCES employees(id),
  question           text NOT NULL,
  answer             text,
  source_article_ids uuid[],
  confidence_score   float,
  feedback           int CHECK (feedback IN (-1, 0, 1)) DEFAULT 0,
  created_at         timestamptz DEFAULT now()
);

-- Seed roles
INSERT INTO roles (name, department, description) VALUES
  ('Operations Manager',    'Operations',        'Manages day-to-day operations'),
  ('Finance Officer',       'Finance',           'Handles financial processes and reporting'),
  ('Customer Service Lead', 'Customer Service',  'Manages customer interactions'),
  ('HR Manager',            'Human Resources',   'Manages people and processes'),
  ('IT Administrator',      'Technology',        'Manages internal systems');
```

**Vector similarity search function — run this separately:**

```sql
-- NOTE: vector(768) matches Google text-embedding-004 dimensions
-- Only returns approved=true articles — rejected articles are automatically excluded
-- because rejected articles always have approved=false
CREATE OR REPLACE FUNCTION match_articles (
  query_embedding  vector(768),
  match_threshold  float DEFAULT 0.4,
  match_count      int   DEFAULT 3
)
RETURNS TABLE (
  id           uuid,
  title        text,
  summary      text,
  content      text,
  role_id      uuid,
  captured_by  uuid,
  created_at   timestamptz,
  similarity   float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, title, summary, content, role_id, captured_by, created_at,
    1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_articles
  WHERE approved = true
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

## Design System

Follow this exactly. No deviations.

### Fonts

```html
<!-- client/index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100;0,9..144,200;0,9..144,300;1,9..144,100;1,9..144,200;1,9..144,300&family=Epilogue:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

| Font     | Role    | Usage                                             |
| -------- | ------- | ------------------------------------------------- |
| Fraunces | Display | ALL h1–h3, brand moments, emotional screens       |
| Epilogue | Body    | ALL UI text, body copy, labels, buttons           |
| DM Mono  | Mono    | Timestamps, IDs, badges, section labels, metadata |

**Rules — no exceptions:**

- Fraunces `weight 100 italic` → hero/display moments only
- Fraunces `weight 200` → section headings
- Epilogue `weight 300` → default body (not 400)
- Epilogue `weight 500` → buttons, labels, actions only
- DM Mono → ALL metadata without exception
- NEVER use Inter, Roboto, system-ui, or any unlisted font

### CSS Variables

```css
/* client/src/index.css */
:root {
  --surface: #f8f7f4;
  --white: #ffffff;
  --ground: #f0eee9;
  --rule: #e2ded6;
  --rule-hi: #c8c3b8;
  --ink: #131210;
  --ink-2: #3d3b37;
  --ink-3: #8c8980;
  --ink-4: #bab7b0;
  --volt: #2d4eff;
  --volt-light: #eef1ff;
  --forest: #1a6b45;
  --forest-light: #e8f4ee;
  --amber: #8b5200;
  --amber-light: #fdf3e7;
  --danger: #8b1a1a;
  --danger-light: #fdf0f0;
  --font-display: "Fraunces", serif;
  --font-body: "Epilogue", sans-serif;
  --font-mono: "DM Mono", monospace;
}

body {
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-body);
  font-weight: 300;
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3,
h4 {
  font-family: var(--font-display);
  font-weight: 200;
  letter-spacing: -0.01em;
}

@keyframes diamondPulse {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
    opacity: 1;
  }
  50% {
    transform: rotate(45deg) scale(0.7);
    opacity: 0.55;
  }
}

@keyframes messageIn {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0);   }
}

@keyframes articleReveal {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0);   }
}

@keyframes captureIn {
  from { opacity: 0; transform: translateX(5px); }
  to   { opacity: 1; transform: translateX(0);   }
}

@keyframes pageFade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes skeletonPulse {
  0%, 100% { opacity: 1;    }
  50%       { opacity: 0.45; }
}

@keyframes typingDot {
  0%, 60%, 100% { transform: translateY(0);    opacity: 0.35; }
  30%           { transform: translateY(-4px); opacity: 1;    }
}
```

### Tailwind Config

```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#F8F7F4",
        white: "#FFFFFF",
        ground: "#F0EEE9",
        rule: "#E2DED6",
        "rule-hi": "#C8C3B8",
        ink: "#131210",
        "ink-2": "#3D3B37",
        "ink-3": "#8C8980",
        "ink-4": "#BAB7B0",
        volt: "#2D4EFF",
        "volt-light": "#EEF1FF",
        forest: "#1A6B45",
        "forest-light": "#E8F4EE",
        amber: "#8B5200",
        "amber-light": "#FDF3E7",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Epilogue", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
};
```

### Component Patterns

**Cards — sharp corners, no border-radius on structural containers:**

```jsx
<div className="bg-white border border-rule">
<div className="bg-white border border-rule hover:border-rule-hi transition-colors">
```

**Buttons:**

```jsx
// Primary
<button className="bg-ink text-surface font-body font-medium
                   text-xs px-6 py-2.5 tracking-wider uppercase
                   hover:bg-ink-2 transition-colors">

// Secondary
<button className="border border-rule bg-transparent text-ink-2
                   font-body font-medium text-xs px-4 py-2
                   hover:bg-ground transition-colors">
```

**Inputs:**

```jsx
<input
  className="w-full border border-rule bg-surface font-body
                  font-light text-sm text-ink px-3 py-2.5 outline-none
                  focus:border-rule-hi transition-colors
                  placeholder:text-ink-4"
/>
```

**Section labels:**

```jsx
<div className="flex items-center gap-3 mb-6">
  <span
    className="font-mono text-[9px] tracking-[0.22em] uppercase
                   text-ink-4 whitespace-nowrap"
  >
    Label
  </span>
  <div className="flex-1 h-px bg-rule" />
</div>
```

**Role / status badges:**

```jsx
<span
  className="font-mono text-[8px] tracking-[0.16em] uppercase
                 text-ink-3 bg-ground border border-rule px-2 py-1"
>
  Operations
</span>
```

**Skeleton elements — use skeletonPulse, never a spinner:**

```jsx
<div
  className="bg-ground h-4 w-32"
  style={{ animation: "skeletonPulse 1.5s ease infinite" }}
/>
```

### The AI Avatar

The only visual identity of AI presence in InKnow.
Not a circle. Not a dot. Not a robot icon.
A rotating diamond that breathes.

```jsx
// components/ui/AIAvatar.jsx
const AIAvatar = ({ size = 24 }) => (
  <div
    style={{ width: size, height: size }}
    className="flex items-center justify-center flex-shrink-0"
  >
    <div
      className="bg-volt"
      style={{
        width: size * 0.42,
        height: size * 0.42,
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        animation: "diamondPulse 3s ease infinite",
      }}
    />
  </div>
);

export default AIAvatar;
```

---

## API Contract

All endpoints prefixed `/api`.
Protected routes require: `Authorization: Bearer <token>`
All responses: `{ data, error, message }`

```
POST   /api/auth/register              { name, email, password, role_id }
POST   /api/auth/login                 { email, password }
GET    /api/auth/me

GET    /api/roles

POST   /api/sessions                   { role_id }
GET    /api/sessions
GET    /api/sessions/:id
GET    /api/sessions/:id/articles      — list knowledge articles created from this session
POST   /api/sessions/:id/articles      — retry article generation for a completed session
POST   /api/sessions/:id/message       { content }
POST   /api/sessions/:id/complete      — two-path: first_completion or re_opened_completion

GET    /api/knowledge                  ?role_id=&search=  — approved=true only
GET    /api/knowledge/:id              — managers bypass approved filter to view pending
POST   /api/knowledge                  { role_id, session_id, title, summary, content, tags }
PATCH  /api/knowledge/:id              { title, summary, content, tags }  — author only
POST   /api/knowledge/update           { article_id, title, content, update_reason, session_id }
                                         — create new version of existing article, sets approved=false
PATCH  /api/knowledge/:id/approve      — manager only, sets approved=true
PATCH  /api/knowledge/:id/reject       — manager only, soft delete: sets rejected=true

POST   /api/copilot/query              { question }
POST   /api/copilot/feedback           { query_id, feedback }

GET    /api/manager/stats              — total approved articles, sessions this month, pending count
GET    /api/manager/coverage           — article count and last capture date per role
GET    /api/manager/pending            — articles with approved=false AND rejected=false
```

---

## AI Service Files

### server/services/gemini.js

All content generation uses `gemini-2.5-flash-lite`.
Chat (sendInterrogationMessage) also uses `gemini-2.5-flash-lite`.

Exports:

```js
// Prompts
buildInterrogationSystemPrompt(employeeName, roleName) → string
buildArticleGenerationPrompt(conversation, roleName)   → string
buildCopilotPrompt(question, articles, questionType)   → string
  // questionType: "broad" | "specific" — changes synthesis instructions

// Utilities
formatConversation(messages) → string
  // maps [{role, content}] to "Inno: ...\n\nEmployee: ..." format

// Generation
sendInterrogationMessage(systemPrompt, history, newMessage) → string
generateArticles(prompt)                    → JSON array of articles
generateProvisionalTitle(conversation)      → string (4–8 words, fires after 3 exchanges)
generateSessionTitle(conversation)          → string (4–8 words, fires on first completion)
runKnowledgeDiff(existingArticles, newMessages) → { new_articles, updated_articles, nothing_new }
expandQuery(question)                       → string[] (original + 3 rephrasings for RAG)
answerFromContext(prompt)                   → string
```

### server/services/embeddings.js

```js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// Returns float array of 768 dimensions
export const generateEmbedding = async (text) => {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
};
```

### server/services/rag.js

```js
// Enriches match results with capturer names from employees table
export const enrichWithNames = async (matches) => { ... }

// Embeds question, queries match_articles RPC, returns enriched matches
export const retrieveArticles = async (question, matchCount = 3) => { ... }
```

### Install

```bash
cd server
npm install @google/generative-ai
```

No other AI packages needed. One package, one API key.

---

## AI Prompts

These live in `server/services/gemini.js`.
Do not simplify. Do not genericize. Use exactly as written.

### Interrogation System Prompt

```js
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
```

### Article Generation Prompt

```js
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
  "content": "Full article in markdown. Include: overview, step-by-step
              where relevant, key contacts if mentioned, common mistakes,
              what to do when things go wrong. Write in second person.",
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
```

### Knowledge Diff Prompt

Used when a completed session is re-opened and the employee adds more messages.
Gemini compares new messages against existing articles and returns what to create, update, or ignore.

```js
export const runKnowledgeDiff = async (existingArticles, newMessages) => {
  // Returns { new_articles: [...], updated_articles: [...], nothing_new: bool }
  // updated_articles include: id, title, content, update_reason
  // nothing_new: true if new messages only repeat what is already captured
};
```

### Copilot RAG Prompt

`questionType` is `"broad"` or `"specific"`, detected by `detectQuestionType` in copilot route.
Broad questions get synthesis instructions; specific questions get precision instructions.

```js
export const buildCopilotPrompt = (question, articles, questionType) =>
  `
You are InKnow — an internal knowledge assistant.
Answer using ONLY the articles provided below.
...
`.trim();
```

---

## Build Order

Build in this exact sequence.
Do not move to the next step until the current one is complete and working.

---

### 01 — Project Scaffold ✓

```
✓ Create monorepo: inknow/ with client/ and server/ directories
✓ Initialize React + Vite in client/
✓ Install and configure Tailwind with the exact config above
✓ Add fonts to client/index.html
✓ Paste CSS variables and keyframes into client/src/index.css
✓ Initialize Express in server/
✓ Install @google/generative-ai in server/
✓ Create .env.example with all required variables
✓ Initialize git — first commit
```

---

### 02 — Database ✓

```
✓ Run full schema SQL in Supabase SQL editor
✓ Run match_articles function SQL (vector(768) dimensions)
✓ Verify all tables exist in Supabase dashboard
✓ Verify 5 seed roles exist in roles table
✓ Create server/db/supabase.js with Supabase client
```

---

### 03 — Authentication ✓

```
✓ POST /api/auth/register — hash password, create employee, return JWT
✓ POST /api/auth/login    — verify password, return JWT
✓ GET  /api/auth/me       — return employee from token
✓ server/middleware/auth.js — verify JWT on protected routes
✓ GET  /api/roles         — return all roles (used in register form)
✓ client/lib/api.js       — axios instance with base URL + auth header
✓ client/lib/auth.js      — save/get/remove token from localStorage
✓ client/hooks/useAuth.jsx — auth state management
✓ Login.jsx               — InKnow wordmark + email + password + submit
✓ Protected route wrapper in App.jsx
✓ Dashboard.jsx           — shows employee name, recent sessions, quick actions
```

---

### 04 — Interrogation Session ✓

```
✓ server/services/gemini.js — sendInterrogationMessage, buildInterrogationSystemPrompt

✓ POST /api/sessions — create session, call Gemini for opening message,
                        save as first session_message (role: 'ai')

✓ POST /api/sessions/:id/message
  — save employee message to session_messages
  — call sendInterrogationMessage with full history
  — save AI response
  — increment message_count on session
  — if session was 'completed', flip to 're-opened'
  — fire-and-forget provisional title via generateProvisionalTitle
    after message_count reaches 6 (3 exchanges)
  — return { employeeMessage, aiMessage, sessionStatus }

✓ GET  /api/sessions     — list sessions with message_count
✓ GET  /api/sessions/:id — return session with all messages ordered by created_at

✓ Session.jsx layout:
  ┌─────────────────────────────────────────────┐
  │  TopBar: role name · session ID · status    │
  ├──────────────────────────┬──────────────────┤
  │                          │                  │
  │   Chat messages (65%)    │  Capture sidebar │
  │                          │  (35%)           │
  ├──────────────────────────┴──────────────────┤
  │   Input bar (active/re-opened)              │
  └─────────────────────────────────────────────┘

  Completed sessions show a bottom banner instead of input bar.
  Continuing the conversation from the banner flips status to re-opened.

✓ AIAvatar component — the rotating volt diamond
✓ AI bubble    — bg-ground, border-rule, radius: 0 10px 10px 10px
✓ Employee bubble — bg-ink, text-surface, radius: 10px 0 10px 10px
✓ TypingIndicator — three dots animating (typingDot keyframe) while waiting for Gemini
✓ Capture sidebar — keyword-triggered client-side captures with captureIn animation
✓ "End session" button appears after 8+ employee messages
✓ SessionGuard — if an active session exists for this role, prompt resume or start fresh
✓ NewConversationDivider — shown at last_completion_message_id when session is re-opened
✓ SessionsList.jsx — list all sessions with status badges
```

---

### 05 — Article Generation + Review ✓

This step has two sub-flows: first completion and re-opened completion.

**First completion (status = 'active'):**

```
✓ POST /api/sessions/:id/complete — PATH A
  — generate articles via generateArticles
  — generate final title via generateSessionTitle (both in parallel)
  — mark session completed, store title and last_completion_message_id
  — return { type: "first_completion", articles, title }
  — if Gemini fails → return { type: "generation_failed" }
  — if Gemini returns 0 articles → return { type: "generation_empty" }

✓ SessionComplete.jsx:
  — full-screen, bg-white, centered max-width 560px
  — Fraunces 100 italic: "Knowledge preserved."  — "preserved" in volt
  — articles stagger in with articleReveal (40ms delay per item)
  — CTA: "Review your articles →" → navigate to ArticleReview.jsx

✓ ArticleReview.jsx:
  — receives articles array from navigation state
  — shows one article at a time
  — Tiptap rich-text editor for content editing
  — "Save article" → POST /api/knowledge (saves with embedding, approved=false)
  — "Skip" → discard, move to next
  — after all reviewed → redirect to Knowledge.jsx

✓ POST /api/knowledge:
  — embed title + summary + content with generateEmbedding
  — save to knowledge_articles (approved=false, captured_by=current employee)
```

**Re-opened completion (status = 're-opened'):**

```
✓ POST /api/sessions/:id/complete — PATH B
  — load existing articles for this session
  — load messages since last_completion_message_id
  — call runKnowledgeDiff(existingArticles, newMessages)
  — if nothing_new → return { type: "nothing_new" }
    client shows a dismissable banner, stays on session page
  — if diff found → return {
      type: "re_opened_completion",
      new_articles: [...],
      updated_articles: [...] (each includes current_title, current_content for diff view)
    }
  — mark session completed again, update last_completion_message_id

✓ ArticleReview.jsx handles both first_completion and re_opened_completion:
  — new_articles: same save flow as above
  — updated_articles: show ArticleDiffView (paragraph-level diff), then Tiptap editor
    "Update article" → POST /api/knowledge/update (increments version, sets approved=false)
    "Skip" → keep current version

✓ POST /api/sessions/:id/articles — retry article generation
  — used when generation_failed — allows retrying without losing the session
```

---

### 06 — Knowledge Browser ✓

```
✓ GET /api/knowledge
  — returns approved=true articles only
  — filters: role_id, search (ilike on title)
  — joins roles(name), capturer:employees!captured_by(name)

✓ GET /api/knowledge/:id
  — non-managers: approved=true filter enforced
  — managers: bypass approved filter (can view pending/rejected articles)
  — increments view_count only for approved articles

✓ Knowledge.jsx layout:
  — left sidebar: role filter list
  — main area: 2-column card grid
  — search input above grid

✓ Knowledge card:
  — role badge (DM Mono 8px uppercase, bg-ground, border-rule)
  — freshness badge: < 30 days → "New" (forest), 30–90 days → "Recent" (amber)
  — title (Fraunces 200, 16px)
  — summary (Epilogue 300, 12px, ink-3, truncated at 110 chars)
  — footer: captured by · date · view count (DM Mono 9px, ink-4)

✓ ArticleDetail.jsx:
  — full markdown rendered via ReactMarkdown + remarkGfm
  — captured by + date + version (if v2+) metadata
  — back button: "← Knowledge" or "← Manager" depending on navigation source
  — amber "Pending approval" badge when approved=false and rejected=false
  — edit button (approved articles only, for author)
  — manager review bar: Approve + Reject buttons at bottom
    visible only when is_manager=true AND approved=false AND rejected=false
```

---

### 07 — Copilot ✓

The copilot ("Inno") uses a multi-query RAG pipeline with smart question classification.

```
✓ server/services/embeddings.js — generateEmbedding
✓ server/services/rag.js        — enrichWithNames, retrieveArticles
✓ server/services/gemini.js     — expandQuery, buildCopilotPrompt, answerFromContext

✓ POST /api/copilot/query — full RAG pipeline:

  1. detectQuestionType(question) → "broad" | "specific"
     Smart regex classifier — matches semantic patterns, not phrase prefixes.
     Broad: explain/describe/summarize, how does X work, what are the steps,
            list all, compare, best practices, end-to-end process, etc.
     Specific: everything else (who, when, where, specific fact lookup)

  2. Set retrieval parameters by type:
     broad    → matchCount=7, matchThreshold=0.35
     specific → matchCount=3, matchThreshold=0.4

  3. expandQuery(question) → [original, rephrasing1, keywords, process_variant]
     Gemini generates 3 search variants. All 4 queries are used.

  4. generateEmbedding on all query variants in parallel

  5. match_articles RPC on each embedding in parallel

  6. Deduplicate across results — keep highest similarity per article id

  7. enrichWithNames(rawArticles) — join capturer names

  8. If articles found:
     — buildCopilotPrompt(question, articles, questionType)
     — answerFromContext(prompt)
     — calculateConfidence: Math.min(100, Math.round(articles[0].similarity * 100))

  9. Gap detection:
     — If answer contains "nobody has captured" → treat as gap, return answer=null
     — Gap state: return { answer: null, sources: [], confidence: 0 }

  10. parseCitedSources(answerText, articles)
      — filters articles by whether their title appears in the answer text
      — only cited articles are returned as sources

  11. Save to copilot_queries, return { answer, sources, confidence, query_id }

✓ POST /api/copilot/feedback — update feedback field (1 or -1)

✓ Copilot.jsx (named "Inno" in the product):
  — centered column, max-width 660px
  — Q&A pairs stack vertically, most recent at bottom
  — answer rendered via ReactMarkdown + remarkGfm with design-system typography
  — "Source:" lines stripped from rendered markdown (shown separately as source chips)
  — confidence bar: 1.5px track bg-rule, ink fill proportional to confidence (0–100)
  — feedback row: thumbs up / thumbs down

✓ Gap state — when no articles match or Gemini returns gap language:
  NEVER show blank. Always show:
  "Nobody's captured this yet."
  → "Start a capture session on this topic" link to /sessions/new

TODO (post-MVP): chunked embeddings — articles currently stored as single vectors.
Broad questions suffer because dense articles average across all topics.
Next improvement: chunk articles at ~150 words with 30-word overlap.
```

---

### 08 — Manager View ✓

**Manager account setup — Phase 1:**
Set `is_manager = true` directly in Supabase for any manager account.
No registration UI change needed. Run in Supabase SQL editor:
`UPDATE employees SET is_manager = true WHERE email = 'manager@company.com';`

**Planned for later (not Phase 1):**
Option C — manager sends invite link → employee registers via invite →
account created under that manager's team with a proper approval flow.
Do not build this now.

**Soft delete — important:**
Rejecting an article sets `rejected=true`. The article is NEVER hard-deleted.
Rejected articles have `approved=false`, so they are automatically excluded from:
- `GET /api/knowledge` (filters `approved=true`)
- `match_articles` RPC (filters `approved=true`)
- `GET /api/manager/pending` (filters `approved=false AND rejected=false`)
They are only visible to managers reading a specific article directly.

```
✓ Manager route guard:
  — server: middleware checks is_manager=true on all /api/manager/* routes
  — client: ManagerRoute component in App.jsx redirects non-managers to /dashboard

✓ Manager.jsx layout:
  — stat row: total approved articles · sessions this month · pending approvals
  — role coverage grid — one card per role:
    · role name (Fraunces 200)
    · article count + proportional fill bar
    · last capture date with freshness badge
      < 90 days → "Current" (forest), 90–270 days → "Verify soon" (amber),
      > 270 days → "May be outdated" (danger)
    · "Copy invite link" → copies /sessions/new URL to clipboard
  — pending approvals list:
    · title (clickable → ArticleDetail with from="manager" state)
    · captured by · role · date
    · Approve button (green) · Reject button (secondary)

✓ ArticleDetail.jsx manager review bar:
  — sticky bottom bar visible when: is_manager=true AND approved=false AND rejected=false
  — Approve → PATCH /api/knowledge/:id/approve → navigate back to /manager
  — Reject  → PATCH /api/knowledge/:id/reject  → navigate back to /manager
  — Manager reads the full article before deciding

✓ PATCH /api/knowledge/:id/approve — manager only:
  — sets approved=true, approved_by, approved_at
  — article now appears in knowledge browser and copilot

✓ PATCH /api/knowledge/:id/reject — manager only, soft delete:
  — sets rejected=true
  — article stays in DB, disappears from all employee-facing views

✓ GET /api/manager/stats:   { total_articles, sessions_this_month, pending_approvals }
✓ GET /api/manager/coverage: [{ id, name, department, article_count, last_capture }]
✓ GET /api/manager/pending:  [{ id, title, summary, role_id, created_at,
                                roles(name), capturer:employees!captured_by(name) }]
```

---

### 09 — Loading + Error + Empty States ✓

Every screen has all three.

```
✓ LOADING — skeleton screens using skeletonPulse keyframe, never spinners
  — Knowledge.jsx:    SkeletonCard grid (same card dimensions, bg-ground pulse)
  — Dashboard.jsx:    SkeletonRow list (status dot + title + date placeholders)
  — Manager.jsx:      StatSkeleton + CoverageSkeleton + PendingSkeleton
  — Session.jsx:      Two-column skeleton (topbar + AI avatar circle + two text lines)
  — ArticleDetail.jsx: Full-width skeleton

✓ ERROR — human language, always with recovery action
  — All pages show error message in danger color + "Try again →" action
  — Dashboard.jsx: error was previously swallowed silently — now surfaced

✓ EMPTY — actionable, never blank
  — Knowledge.jsx no articles:    "No knowledge captured for this role yet.
                                   Start the first capture session →"
  — Dashboard.jsx no sessions:    "You haven't captured any knowledge yet.
                                   Start your first session →"
  — Manager.jsx no approvals:     "Everything is up to date."
  — Copilot gap state:            "Nobody's captured this yet."
                                   + link to start a capture session
```

---

### 10 — Polish Pass

Do this after all features are working.
Not while building features.

```
□ Animations audit
  — messages:            messageIn (300ms) on every new chat bubble
  — completion articles: articleReveal staggered 40ms per item
  — page transitions:    pageFade (200ms) on route change
  — capture sidebar:     captureIn (400ms) as items appear
  — hover transitions:   150ms on all interactive elements
  — typing indicator:    typingDot keyframe, 3 dots, 0.2s stagger

□ Typography audit — check every screen
  — all headings use Fraunces
  — all body text uses Epilogue weight 300
  — all metadata uses DM Mono
  — no rogue font-weight: 400 on body text
  — no rogue border-radius on structural cards

□ Color audit
  — no hardcoded hex values — all CSS variables
  — volt (#2D4EFF) used only: brand mark, active state, completion headline
  — no color outside the defined palette

□ Copy audit — replace every instance
  "No results found"  → "Nobody's captured this yet."
  "Loading..."        → skeleton screen
  "Error occurred"    → "Something went wrong — try again."
  "Session complete"  → "Knowledge preserved."
  "Submit"            → specific verb: Send / Approve / Save
  "Delete"            → "Remove"
  "Are you sure?"     → "This will remove [X]. Can't undo."
```

---

### 11 — Deploy

```
□ client/ → Vercel
  — set VITE_API_URL to Railway production URL
  — verify build passes without errors

□ server/ → Railway
  — set all production environment variables
  — GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET
  — verify server starts and Supabase connects

□ Smoke test on production URLs:
  — register new account
  — complete full interrogation session (10+ exchanges)
  — approve articles as manager
  — query copilot
  — verify answers come from approved knowledge only
```

**Done when:** Everything works on production URLs, not just localhost.

---

### 12 — Internal Launch

```
□ Identify one internal champion — colleague most likely to understand it
□ Create their account manually
□ Sit with them, say nothing, just watch
□ Note every moment of confusion
□ Note every moment of delight
□ Fix the top 3 friction points immediately — not tomorrow
□ Write a 5-line internal README: what it is, how to log in, what to do first
```

**Done when:** One real colleague used the product without guidance
and understood what to do.

---

## Current Status

```
✓ 01 — Project Scaffold
✓ 02 — Database
✓ 03 — Authentication
✓ 04 — Interrogation Session
✓ 05 — Article Generation + Review
✓ 06 — Knowledge Browser
✓ 07 — Copilot (with multi-query RAG, detectQuestionType, query expansion)
✓ 08 — Manager View (with soft delete, full article review before approve/reject)
✓ 09 — Loading + Error + Empty States
□ 10 — Polish Pass           ← NEXT
□ 11 — Deploy
□ 12 — Internal Launch
```

---

## Definition of Phase 1 Complete

```
□ Employee can register and select a role
□ Employee can complete a full interrogation session (10+ exchanges)
□ Gemini conducts the session using the interrogation system prompt
□ Session generates 2–6 knowledge articles via Gemini
□ Employee can review and edit articles before saving (Tiptap editor)
□ Re-opened sessions use knowledge diff — only new/changed info is surfaced
□ Approved articles are stored with 768-dimension embeddings
□ Articles appear in the knowledge browser
□ Copilot answers questions from approved knowledge
□ Copilot uses multi-query expansion and smart question type detection
□ Copilot shows gap state when nothing found
□ Gap state links to starting a capture session
□ Manager can see role coverage
□ Manager can read full article before approving or rejecting
□ Reject is soft delete — articles preserved in DB, hidden from all views
□ All screens have loading / error / empty states
□ Production deploy is live on Vercel + Railway
□ One real internal colleague used the product without guidance
```

---

## Never Do These Things

```
✗ Add any UI library — Shadcn, Radix, MUI, Chakra, Headless UI
✗ Use Inter, Roboto, system-ui, or any font not in the design system
✗ Add border-radius to structural cards or page containers
✗ Use any color not defined in the CSS variables
✗ Add a dark mode toggle
✗ Use console.log in production code
✗ Show raw error messages or stack traces to users
✗ Build features outside the current build order step
✗ Skip the empty state on any screen
✗ Use placeholder copy — "Lorem ipsum", "Coming soon", "TODO"
✗ Add animations purely for decoration — every motion has meaning
✗ Use OpenAI, Anthropic, or any AI provider other than Google Gemini
✗ Change the embedding model or dimensions (must stay text-embedding-004, 768d)
✗ Hard-delete knowledge articles — always use soft delete (rejected=true)
```

---

## How to Use This File

**Start every Claude Code session:**

```
Read PHASE_1.md fully before doing anything.
We are currently on Build Order step [number]: [name].
Do not proceed past this step until I confirm it is complete.
```

**When Claude Code goes off-track:**

```
Stop. Re-read PHASE_1.md.
The design system is non-negotiable.
Return to Build Order step [number] and complete it correctly.
```

**When a new idea appears mid-build:**

```
Good idea. Adding it to the post-MVP list.
Right now we are on step [number]. Stay focused on that.
```
