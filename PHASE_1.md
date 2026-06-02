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
AI Chat:      Google Gemini API — model: gemini-2.0-flash
Embeddings:   Google text-embedding-004 (768 dimensions)
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
│       │   ├── auth.js         # Token helpers
│       │   └── utils.js
│       ├── hooks/
│       │   ├── useAuth.js
│       │   ├── useSession.js
│       │   └── useKnowledge.js
│       ├── components/
│       │   ├── ui/             # Button, Input, Badge, Skeleton, Avatar
│       │   ├── layout/         # Shell, Sidebar, Header, PageWrapper
│       │   ├── chat/           # Chat-specific components
│       │   └── knowledge/      # Article card, article reader
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Session.jsx
│           ├── SessionComplete.jsx
│           ├── Copilot.jsx
│           ├── Knowledge.jsx
│           └── Manager.jsx
│
├── server/
│   ├── index.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── sessions.js
│   │   ├── knowledge.js
│   │   └── copilot.js
│   ├── services/
│   │   ├── gemini.js           # All Gemini chat API calls
│   │   ├── embeddings.js       # Google text-embedding-004
│   │   └── rag.js              # Retrieval logic
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

One API key covers everything AI-related — chat and embeddings both
use the same Google Gemini API key.

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
CREATE TABLE interrogation_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid REFERENCES employees(id) ON DELETE CASCADE,
  role_id      uuid REFERENCES roles(id),
  status       text CHECK (status IN ('active','completed','abandoned'))
               DEFAULT 'active',
  started_at   timestamptz DEFAULT now(),
  completed_at timestamptz
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
CREATE TABLE knowledge_articles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id      uuid REFERENCES roles(id),
  session_id   uuid REFERENCES interrogation_sessions(id),
  title        text NOT NULL,
  summary      text,
  content      text NOT NULL,
  tags         text[],
  approved     boolean DEFAULT false,
  approved_by  uuid REFERENCES employees(id),
  approved_at  timestamptz,
  captured_by  uuid REFERENCES employees(id),
  embedding    vector(768),
  view_count   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
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
CREATE OR REPLACE FUNCTION match_articles (
  query_embedding  vector(768),
  match_threshold  float DEFAULT 0.7,
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
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes articleReveal {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes captureIn {
  from {
    opacity: 0;
    transform: translateX(5px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pageFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
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
POST   /api/sessions/:id/message       { content }
POST   /api/sessions/:id/complete

GET    /api/knowledge                  ?role_id=&approved=&search=
GET    /api/knowledge/:id
POST   /api/knowledge                  { role_id, session_id, title, summary, content, tags }
PATCH  /api/knowledge/:id/approve
PATCH  /api/knowledge/:id              { title, summary, content, tags }

POST   /api/copilot/query              { question }
POST   /api/copilot/feedback           { query_id, feedback }
```

---

## AI Service Files

### server/services/gemini.js

````js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const chatModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

// Send one message in an ongoing interrogation session
// history = array of { role: 'ai'|'employee', content: string }
export const sendInterrogationMessage = async (
  systemPrompt,
  history,
  newMessage,
) => {
  const chat = chatModel.startChat({
    systemInstruction: systemPrompt,
    history: history.map((msg) => ({
      role: msg.role === "ai" ? "model" : "user",
      parts: [{ text: msg.content }],
    })),
  });

  const result = await chat.sendMessage(newMessage);
  return result.response.text();
};

// Generate knowledge articles from a completed session
// Returns parsed JSON array of articles
export const generateArticles = async (prompt) => {
  const result = await chatModel.generateContent(prompt);
  const text = result.response.text();
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
};

// Answer a copilot question from retrieved context
export const answerFromContext = async (prompt) => {
  const result = await chatModel.generateContent(prompt);
  return result.response.text();
};
````

### server/services/embeddings.js

```js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

// Returns float array of 768 dimensions
export const generateEmbedding = async (text) => {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
};
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

### Copilot RAG Prompt

```js
export const buildCopilotPrompt = (question, articles) =>
  `
You are InKnow's knowledge assistant. Answer using only the articles below.
Do not use any outside information.

KNOWLEDGE ARTICLES:
${articles
  .map(
    (a, i) => `
[Article ${i + 1}]
Title: ${a.title}
Content: ${a.content}
Captured by: ${a.captured_by_name} · ${a.created_at}
`,
  )
  .join("\n---\n")}

QUESTION: ${question}

Rules:
- Answer directly and specifically
- Use only information from the articles above
- If articles partially answer: "The knowledge base has partial
  information on this..."
- If no relevant information: "Nobody has captured this yet."
- Never invent information
- Keep answers concise: 2–4 sentences for simple, more for processes
- End with: "Source: [Article title] · [Name]"
  Multiple sources: list each on a new line
`.trim();
```

---

## Build Order

Build in this exact sequence.
Do not move to the next step until the current one is complete and working.

---

### 01 — Project Scaffold

```
□ Create monorepo: inknow/ with client/ and server/ directories
□ Initialize React + Vite in client/
□ Install and configure Tailwind with the exact config above
□ Add fonts to client/index.html
□ Paste CSS variables and keyframes into client/src/index.css
□ Initialize Express in server/
□ Install @google/generative-ai in server/
□ Create .env.example with all required variables
□ Initialize git — first commit
```

**Done when:** `npm run dev` starts both client and server without errors.

---

### 02 — Database

```
□ Run full schema SQL in Supabase SQL editor
□ Run match_articles function SQL (vector(768) dimensions)
□ Verify all 6 tables exist in Supabase dashboard
□ Verify 5 seed roles exist in roles table
□ Create server/db/supabase.js with Supabase client
□ Test connection with a simple SELECT from server
```

**Done when:** Server can query the roles table and return 5 rows.

---

### 03 — Authentication

```
□ POST /api/auth/register — hash password, create employee, return JWT
□ POST /api/auth/login    — verify password, return JWT
□ GET  /api/auth/me       — return employee from token
□ server/middleware/auth.js — verify JWT on protected routes
□ GET  /api/roles         — return all roles (used in register form)
□ client/lib/api.js       — axios instance with base URL + auth header
□ client/lib/auth.js      — save/get/remove token from localStorage
□ client/hooks/useAuth.js — auth state management
□ Login.jsx               — InKnow wordmark + email + password + submit
□ Protected route wrapper in App.jsx
□ Dashboard.jsx           — shows employee name and role, empty otherwise
```

**Done when:** Register, login, and see dashboard with your name.
The Login page must look like the product — not a placeholder.
Use Fraunces wordmark centered on a white card on the surface background.

---

### 04 — Interrogation Session

```
□ server/services/gemini.js — implement sendInterrogationMessage
□ server/services/gemini.js — add buildInterrogationSystemPrompt

□ POST /api/sessions — create session, call Gemini for opening message
                        using buildInterrogationSystemPrompt,
                        save as first session_message (role: 'ai')

□ POST /api/sessions/:id/message
  — save employee message to session_messages
  — load full message history for this session
  — call sendInterrogationMessage with history + new message
  — save AI response to session_messages
  — return both messages

□ GET  /api/sessions/:id — return session with all messages ordered by created_at
□ POST /api/sessions/:id/complete — set status='completed', completed_at=now()

□ Session.jsx layout:
  ┌─────────────────────────────────────────────┐
  │  TopBar: role name · session ID · progress  │
  ├──────────────────────────┬──────────────────┤
  │                          │                  │
  │   Chat messages (65%)    │  Capture sidebar │
  │                          │  (35%)           │
  ├──────────────────────────┴──────────────────┤
  │   Input bar (always visible)                │
  └─────────────────────────────────────────────┘

□ AIAvatar component — the rotating volt diamond (exact code above)
□ AI bubble    — bg-ground, border-rule, radius: 0 10px 10px 10px
□ Employee bubble — bg-ink, text-surface, radius: 10px 0 10px 10px
□ Typing indicator — three dots animating while waiting for Gemini
□ Capture sidebar — shows topics as they emerge (simple client-side
                    keyword detection is fine for MVP)
□ "End session" button appears after 8+ exchanges
□ Message entrance: messageIn keyframe on every new bubble
```

**Done when:** Full conversation runs end-to-end. All messages save to DB.
AI uses the interrogation system prompt. End session marks it complete.

---

### 05 — Article Generation + Review

```
□ server/services/gemini.js — add buildArticleGenerationPrompt
                               and generateArticles function

□ POST /api/sessions/:id/complete (extend from step 04):
  — load all session messages
  — format as conversation string
  — call generateArticles with buildArticleGenerationPrompt
  — return articles array in response
  — do NOT save to DB yet — pending employee review

□ SessionComplete.jsx:
  — full-screen centered layout, max-width 560px, bg-white
  — Fraunces 100 italic large: "Knowledge preserved."
  — "preserved" rendered in volt color
  — subtitle: "X articles captured and ready for review"
  — articles appear staggered with articleReveal animation, 40ms delay each
  — each row: number (DM Mono) + title + check icon
  — CTA button: "Review your articles →"

□ Article review flow:
  — show each generated article one at a time
  — display title (editable) and content (editable textarea)
  — "Approve & save" → POST /api/knowledge
  — "Skip" → discard this article, move to next
  — after all reviewed → redirect to Knowledge.jsx

□ POST /api/knowledge:
  — save article to knowledge_articles
  — call generateEmbedding on title + summary + content
  — store embedding in vector(768) column
  — set approved=false by default (manager approves)
  — set captured_by to current employee
```

**Done when:** Session generates articles. Employee reviews and saves them.
Approved articles appear in Supabase with embeddings in the vector column.

---

### 06 — Knowledge Browser

```
□ GET /api/knowledge
  — return articles filtered by role_id and/or search query
  — default: approved=true only
  — increment view_count on GET /api/knowledge/:id

□ Knowledge.jsx layout:
  — left sidebar: role filter list
  — main area: 2-column card grid

□ Knowledge card:
  — role badge (DM Mono 8px uppercase, bg-ground, border-rule)
  — freshness dot:
    < 90 days   → var(--forest)  label: "Current"
    90–270 days → var(--amber)   label: "Verify soon"
    > 270 days  → var(--danger)  label: "May be outdated"
  — title (Fraunces 200, 17px)
  — summary (Epilogue 300, 12px, ink-3)
  — footer: captured by · date · view count (DM Mono 9px, ink-4)

□ Article detail:
  — full markdown content rendered
  — captured by + date metadata
  — back button
  — edit button (author only) → PATCH /api/knowledge/:id
```

**Done when:** Browse all articles by role. Click to read full content.
Search returns relevant results.

---

### 07 — Copilot

```
□ server/services/embeddings.js — implement generateEmbedding
□ server/services/rag.js        — implement retrieval logic
□ server/services/gemini.js     — add buildCopilotPrompt
                                   and answerFromContext

□ POST /api/copilot/query:
  — embed question with generateEmbedding (768 dimensions)
  — call match_articles Supabase function with embedding
  — if results found:
    · build context with buildCopilotPrompt
    · call answerFromContext
    · calculate confidence from similarity scores
    · return { answer, sources, confidence, query_id }
  — if no results:
    · return { answer: null, sources: [], confidence: 0, query_id }
    · client handles gap state
  — save to copilot_queries table

□ POST /api/copilot/feedback — update feedback field on query

□ Copilot.jsx layout:
  — centered column, max-width 660px
  — Q&A pairs stack vertically, most recent at bottom
  — input at bottom, Fraunces italic placeholder:
    "Ask anything about company knowledge..."

□ Answer card:
  — question label (DM Mono 8px uppercase ink-4): "Your question"
  — question text (Fraunces 200, 20px)
  — answer text (Epilogue 300, 14px, ink-2, line-height 1.75)
  — source tag (DM Mono 9px, forest color, bg-forest-light)
  — confidence bar (1.5px track bg-rule, ink fill at confidence%)
  — feedback row: "Helpful" / "Not quite right"

□ Gap state — when no articles match:
  NEVER show empty. Always show:
  "Nobody's captured this yet."
  [suggest best person based on role match]
  → "Start a capture session on this topic" link to Session.jsx
```

**Done when:** Ask a question, get a real answer sourced from approved knowledge.
Gap state works and links to starting a new session.

---

### 08 — Manager View

```
□ Manager route guard — check is_manager=true, redirect if not

□ Manager.jsx layout:
  — stat row: total articles · sessions this month · pending approvals
  — role coverage grid — one card per role:
    · role name (Fraunces 200)
    · article count
    · last capture date
    · coverage bar (visual fill proportional to article count)
    · "Invite to capture" button → copies session link to clipboard
  — pending approvals list:
    · all articles with approved=false
    · title + captured by + date
    · "Approve" button → PATCH /api/knowledge/:id/approve
    · "Reject" button  → delete article

□ PATCH /api/knowledge/:id/approve:
  — set approved=true
  — set approved_by to manager's employee id
  — set approved_at to now()
  — article now appears in knowledge browser and copilot
```

**Done when:** Manager sees team knowledge coverage.
Can approve pending articles. Approved articles appear in copilot immediately.

---

### 09 — Loading + Error + Empty States

Every screen must have all three.
Do this as a dedicated pass — not while building features.

```
□ LOADING — skeleton screens, not spinners
  — knowledge card skeleton: same card dimensions, bg-ground pulse animation
  — chat message skeleton: avatar circle + two lines of varying width
  — dashboard skeleton: stat block placeholders

□ ERROR — human language, always with recovery action
  — network error:   "Something went wrong — try again."
  — auth error:      "Please log in to continue."
  — not found:       "We couldn't find that. Try going back."
  — API failure:     "That didn't work — try again in a moment."
  — Gemini timeout:  "The AI is taking too long — try again."

□ EMPTY — actionable, never blank
  — no articles for role:  "No knowledge captured for this role yet.
                             Start the first capture session →"
  — no sessions:           "You haven't captured any knowledge yet.
                             Start your first session →"
  — manager no approvals:  "Everything is up to date."
  — copilot no results:    (handled by gap state in step 07)
```

**Done when:** Every page tested deliberately in all three states.

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
  — approve articles
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

## Definition of Phase 1 Complete

```
□ Employee can register and select a role
□ Employee can complete a full interrogation session (10+ exchanges)
□ Gemini conducts the session using the interrogation system prompt
□ Session generates 2–6 knowledge articles via Gemini
□ Employee can review and approve articles
□ Approved articles are stored with 768-dimension embeddings
□ Articles appear in the knowledge browser
□ Copilot answers questions from approved knowledge
□ Copilot shows gap state when nothing found
□ Gap state links to starting a capture session
□ Manager can see role coverage
□ Manager can approve pending articles
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
