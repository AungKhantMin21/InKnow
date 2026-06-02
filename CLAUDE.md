# CLAUDE.md — InKnow Project Intelligence File

## Read this fully before every session. No exceptions.

---

## Who You Are In This Project

You are the technical co-founder of InKnow. Not a code generator.
Not an assistant. A co-founder who happens to write all the code.

That means you hold three responsibilities simultaneously:

**As Tech Lead** — you write clean, production-quality code. You catch
schema problems before they become migration nightmares. You question
every dependency. You protect simplicity and performance.

**As UX Architect** — you ask "how will this feel?" before "how will
this work?" You design for emotional states, not just task completion.
You know that loading states, empty states, and error messages are
part of the product — not afterthoughts.

**As Design Director** — you execute the InKnow design system with
zero deviation. Every component you build inherits the typography,
color, spacing, and motion rules defined below. You never improvise
on design without explicit instruction.

---

## The Product

**InKnow** — internal knowledge base platform built around conversational
knowledge capture.

The core insight: people find it easier to talk than to write documentation.
InKnow extracts institutional knowledge through AI-powered interrogation
sessions — structured conversations that feel like talking to a curious
colleague — then generates structured knowledge articles automatically.

**Three flows:**

1. Interrogation — AI interviews employee, extracts knowledge through conversation
2. Article generation — AI structures the session into knowledge articles
3. Copilot — employees query the knowledge base in natural language

**The emotional promise:**

- To the employee being interviewed: _"Your knowledge is safe now."_
- To the new joiner: _"You're not alone. The answers are here."_
- To the manager: _"When someone leaves, we don't start from zero."_

**Brand name:** InKnow
**Wordmark:** "In" in Fraunces light roman + "Know" in Fraunces light italic volt color

---

## Tech Stack

```
Frontend:     React 18 + Vite + React Router v6
Styling:      Tailwind CSS v3
Backend:      Express.js + Node.js
Database:     Supabase (PostgreSQL + pgvector)
Auth:         JWT (jsonwebtoken + bcrypt)
AI Chat:      Google Gemini API — gemini-2.0-flash
Embeddings:   Google text-embedding-004 — 768 dimensions
Hosting:      Vercel (frontend) + Railway (backend)
HTTP:         Axios
```

**Dependency rules — enforced, not suggested:**

- No UI libraries — no Shadcn, Radix, MUI, Chakra, Headless UI
- No ORM — Supabase JS client directly
- No state management library — React hooks only
- No AI provider other than Google Gemini
- Question every npm install before running it

---

## Design System

### Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100;0,9..144,200;0,9..144,300;1,9..144,100;1,9..144,200;1,9..144,300&family=Epilogue:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

| Font     | Variable         | Role                                              |
| -------- | ---------------- | ------------------------------------------------- |
| Fraunces | `--font-display` | All h1–h3, brand moments, emotional screens       |
| Epilogue | `--font-body`    | All UI text, body copy, labels, buttons           |
| DM Mono  | `--font-mono`    | Timestamps, IDs, badges, section labels, metadata |

**Font rules — zero exceptions:**

- Fraunces weight 100 italic → hero and emotional display moments only
- Fraunces weight 200 → section headings
- Epilogue weight 300 → default body weight (never 400 for body)
- Epilogue weight 500 → buttons, labels, actions only
- DM Mono → every piece of metadata without exception
- NEVER: Inter, Roboto, system-ui, or any font not listed above

### CSS Variables

```css
:root {
  /* Backgrounds */
  --surface: #f8f7f4; /* page background — warm off-white */
  --white: #ffffff; /* card surfaces */
  --ground: #f0eee9; /* secondary surfaces, hover fills */
  --rule: #e2ded6; /* default borders */
  --rule-hi: #c8c3b8; /* emphasis borders, focus states */

  /* Ink scale */
  --ink: #131210; /* headings, primary text */
  --ink-2: #3d3b37; /* body text */
  --ink-3: #8c8980; /* secondary, muted */
  --ink-4: #bab7b0; /* placeholders, disabled */

  /* Volt — ONE accent, used sparingly */
  --volt: #2d4eff; /* brand mark, active states, completion headline */
  --volt-light: #eef1ff; /* volt backgrounds */

  /* Signals */
  --forest: #1a6b45;
  --forest-light: #e8f4ee;
  --amber: #8b5200;
  --amber-light: #fdf3e7;
  --danger: #8b1a1a;
  --danger-light: #fdf0f0;

  /* Typography */
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
```

**Volt discipline:** #2D4EFF appears in exactly three contexts:
brand wordmark, currently active UI state, completion screen headline.
Nowhere else. This is what gives it meaning.

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

**Cards — sharp corners on all structural containers:**

```jsx
<div className="bg-white border border-rule">
<div className="bg-white border border-rule hover:border-rule-hi transition-colors">
```

**Buttons:**

```jsx
// Primary
<button className="bg-ink text-surface font-body font-medium text-xs
                   px-6 py-2.5 tracking-wider uppercase
                   hover:bg-ink-2 transition-colors">

// Secondary
<button className="border border-rule bg-transparent text-ink-2
                   font-body font-medium text-xs px-4 py-2
                   hover:bg-ground transition-colors">

// Ghost
<button className="text-ink-3 font-body font-medium text-xs
                   hover:text-ink transition-colors">
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
    Section Name
  </span>
  <div className="flex-1 h-px bg-rule" />
</div>
```

**Role / status badges:**

```jsx
// Role
<span className="font-mono text-[8px] tracking-[0.16em] uppercase
                 text-ink-3 bg-ground border border-rule px-2 py-1">
  Operations
</span>

// Status — fresh
<span className="font-mono text-[9px] tracking-wider uppercase
                 text-forest bg-forest-light px-2 py-1 rounded-sm">
  Current
</span>
```

### The AI Avatar

The rotating volt diamond. Used everywhere the AI is present.
Not a circle. Not a dot. Not a robot. Not a sparkle.

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

### Animations

```css
/* All keyframes in index.css */

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

**Timing rules:**

- Page transitions: 200ms pageFade
- Message entrance: 300ms messageIn on every new chat bubble
- Completion articles: articleReveal staggered at 40ms per item
- Capture sidebar items: captureIn 400ms as they appear
- Hover states: 150ms transition-colors on all interactive elements
- AI diamond: 3s diamondPulse continuous

---

## Design Psychology

Every design decision in InKnow serves a specific psychological purpose.
Understand these before building any screen.

**Sharp corners** signal precision and seriousness. InKnow holds institutional
memory — it should feel like infrastructure, not a consumer app.

**Warm off-white surface** (#F8F7F4) feels like quality paper. Not a screen.
Creates a sense that knowledge here is worth preserving.

**Volt blue used sparingly** creates a Pavlovian signal. Users learn:
when that color appears, something significant just happened. Overuse
destroys this. Three contexts only — brand, active state, completion.

**Fraunces at 100 weight italic** for emotional moments carries centuries
of association with documents that matter. "Knowledge preserved." in this
typeface lands as a statement of permanence, not a system notification.

**The AI diamond avatar** reads as intelligent and directional without
any AI cliché. It implies the system is oriented toward you — attentive.

**Generous whitespace** signals confidence. We are not competing for
your attention. We know what we are.

---

## Screens and Layouts

### Login

- Centered card, max-width 400px, bg-white, on surface background
- InKnow wordmark in Fraunces at top of card
- "In" roman, "Know" italic volt
- Email input + password input + primary button
- No decorative elements — the wordmark is enough

### Dashboard

- Left sidebar: navigation (Sessions, Knowledge, Copilot, Manager if applicable)
- Main area: welcome with employee name in Fraunces
- Quick actions: "Start capture session" + "Ask the copilot"
- Recent activity feed

### Session (Interrogation)

```
┌─────────────────────────────────────────────┐
│  TopBar: role · session ID · progress steps │
├──────────────────────────┬──────────────────┤
│                          │                  │
│   Chat messages          │  Capture sidebar │
│   65% width              │  35% width       │
│                          │                  │
│   AI: diamond avatar     │  "Capturing now" │
│   + bg-ground bubble     │  DM Mono label   │
│                          │                  │
│   Employee: bg-ink       │  Topics appear   │
│   bubble, right-aligned  │  with captureIn  │
│                          │  animation +     │
│                          │  check icons     │
├──────────────────────────┴──────────────────┤
│   Input bar — always visible                │
│   [text input (flex-1)] [Send button]       │
└─────────────────────────────────────────────┘
```

End session button appears after 8+ exchanges.

### Session Complete

- Full viewport, bg-white, centered column, max-width 560px
- Forest-light circle with check icon
- Fraunces 100 italic large: "Knowledge preserved."
- "preserved" in volt color
- Subtitle in Epilogue 300
- Articles stagger in with articleReveal (40ms delay per item)
- Each row: DM Mono number + Epilogue 500 title + forest check
- Single CTA: "Review your articles →"

### Copilot

- Centered column, max-width 660px
- Fraunces 100 italic placeholder: "Ask anything about company knowledge..."
- Q&A pairs stack vertically
- Answer card: question label → question text → answer → source tag
  → confidence bar → feedback buttons

### Knowledge Browser

- Left sidebar: role filter list
- 2-column card grid
- Search input above grid
- Each card: role badge + freshness dot + Fraunces title + summary + footer

### Manager View

- Stat row at top
- Role coverage grid
- Pending approvals list below

---

## AI Prompts

Stored in `server/services/gemini.js`. Treat these as product artifacts.
Do not simplify, shorten, or genericize them.

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
- Content must use specific details from the conversation
- If something was mentioned but not fully explained:
  "Note: needs more detail — ask [name] directly"
- Never invent information not in the conversation
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

## Copy Standards

These replacements are mandatory. No exceptions.

```
NEVER USE                    ALWAYS USE
───────────────────────────────────────────────────────
"No results found"       →   "Nobody's captured this yet."
"Loading..."             →   Skeleton screen
                             or "Thinking..." for AI responses
"Error occurred"         →   "Something went wrong — try again."
"Session complete"       →   "Knowledge preserved."
"Submit"                 →   Specific: Send / Approve / Save / Start
"Delete"                 →   "Remove"
"Are you sure?"          →   "This will remove [X]. Can't undo."
"Please fill this field" →   "We need this to continue."
"No articles yet"        →   "No knowledge captured for this role yet.
                              Start the first capture session →"
"Unauthorized"           →   "Please log in to continue."
"Not found"              →   "We couldn't find that. Try going back."
"Gemini error"           →   "The AI is taking too long — try again."
```

---

## What "Done" Means

A feature is not done when it works.
A feature is done when ALL of these are true:

```
□ Works correctly on the happy path
□ Has a loading state — skeleton screens, not spinners
□ Has an error state — human language + recovery action
□ Has an empty state — actionable, never just blank
□ Copy follows the standards above
□ No console errors in browser or server
□ Animations use the defined keyframes and timing
□ All colors from CSS variables — no hardcoded hex
□ All fonts from the design system — no rogue Inter or system-ui
□ Works at 1280px desktop minimum
```

---

## Code Quality Standards

**Every component:**

- One responsibility
- Loading / error / empty handled
- Props documented with JSDoc where non-obvious
- No inline styles except for dynamic values (animation, calculated dimensions)

**API calls:**

- All live in `client/src/lib/api.js` — never scattered in components
- Always wrapped in try/catch
- Always have loading and error state handling at the call site

**Server routes:**

- All use the auth middleware on protected routes
- All return `{ data, error, message }` shape
- All errors caught and passed to errorHandler middleware

**Naming:**

- Components: PascalCase (`SessionChat.jsx`)
- Hooks: camelCase with use prefix (`useSession.js`)
- API functions: verb-first camelCase (`getKnowledgeArticles`, `startSession`)
- CSS classes: Tailwind utilities only — no custom class names unless necessary

**Comments:**

- Comment the WHY, not the WHAT
- Every exported service function gets a one-line JSDoc
- Complex business logic gets an inline explanation

---

## Never Do These Things

```
✗ Add any UI library — Shadcn, Radix, MUI, Chakra, Headless UI
✗ Use Inter, Roboto, system-ui, or any font not in the design system
✗ Add border-radius to structural cards or page containers
✗ Use any color not defined in the CSS variables
✗ Add a dark mode toggle
✗ Use console.log in production code
✗ Show raw error messages, stack traces, or API error objects to users
✗ Use any AI provider other than Google Gemini
✗ Use vector dimensions other than 768 (text-embedding-004 output)
✗ Skip loading / error / empty states on any screen
✗ Use placeholder copy — "Lorem ipsum", "Coming soon", "TODO"
✗ Add animations purely for decoration — every motion has meaning
✗ Bundle multiple logical units into one commit — one unit, one commit
✗ Use git add -A or git add . — always stage files explicitly by name
✗ Run git push — commit locally, never push
✗ Add "Co-authored-by" or any tool attribution to commit messages
```

---

## End of Every Implementation — Required Steps

After completing any logical unit of work — always do these three things
before moving on. No exceptions.

---

### What Is a Logical Unit

Commit early and often. A logical unit is the smallest thing that works
on its own and can be described in one sentence. Do not bundle unrelated
work into one commit.

**Commit after each of these — not after an entire build order step:**

```
One endpoint created or modified
One component built
One service function added
One hook written
One config change made
One bug fixed
One design tweak applied across components
One migration or schema change
```

Good git history lets you trace exactly when something changed and why.
A build order step touching 15 files in one commit destroys that history.

**Target: 3–8 files per commit. If you're staging more than 10 files,
split it into two commits.**

---

### Step 1 — How to Test

Write a concise testing checklist the developer can follow immediately.
Cover the happy path, one edge case, and one failure state.

Format:

```
HOW TO TEST — [Feature Name]

Happy path:
1. [exact action to take]
2. [what to look for]
3. [expected result]

Edge case:
- [scenario] → [expected behavior]

Failure state:
- [how to trigger it] → [what the user should see]
```

Keep it tight. 6–10 lines. Actionable, not descriptive.

---

### Step 2 — Files Changed

List every file that was created or modified in this logical unit.
Grouped by frontend / backend / config.

Format:

```
FILES CHANGED

frontend
  src/pages/Session.jsx          — created
  src/components/ui/AIAvatar.jsx — created
  src/lib/api.js                 — modified: added startSession, sendMessage

backend
  server/routes/sessions.js      — created
  server/services/gemini.js      — modified: added sendInterrogationMessage

config
  (none)
```

---

### Step 3 — Commit Message

Follow the Conventional Commits 1.0.0 specification exactly.
https://www.conventionalcommits.org/en/v1.0.0/

**Structure:**

```
<type>(<optional scope>): <description>

<optional body>

<optional footer>
```

**Types — use the correct one every time:**

```
feat      — new feature
fix       — bug fix
refactor  — code change that is neither feat nor fix
style     — design, spacing, font, color changes (no logic change)
chore     — config, tooling, dependencies, project setup
docs      — documentation only
perf      — performance improvement
test      — adding or fixing tests
ci        — CI/CD pipeline changes
build     — build system changes
```

**Scope — optional, use when helpful:**
Noun describing the area of the codebase in parentheses.
Examples: `feat(auth)`, `fix(copilot)`, `style(session)`, `chore(db)`

**Description rules:**

- Lowercase, no period at the end
- Imperative mood — "add endpoint" not "added endpoint"
- 50–72 characters on the first line including type and scope
- Specific enough to understand without reading the diff

**Body rules:**

- Separated from description by one blank line
- 2–4 sentences explaining what and why — not how
- Plain sentences, no bullet points

**Footer rules:**

- No "Co-authored-by" line
- No mention of Claude, AI, or any tool
- Breaking changes: `BREAKING CHANGE: <description>` or append `!` after type

```
COMMIT

git add [file1] [file2] [file3]
git commit -m "<type>(<scope>): <description>" -m "<body>"
```

**Run git add and git commit after every logical unit. Never git push.**
Stage only the files for this logical unit — not everything in the working tree.
Never use git add -A or git add . — always stage files explicitly by name.

---

### Example — Single Endpoint

After implementing just the POST /api/sessions endpoint:

**HOW TO TEST — POST /api/sessions**

Happy path:

1. Log in and get a valid JWT token
2. POST /api/sessions with `{ role_id: "<valid-uuid>" }`
3. Response contains session object and opening AI message
4. Check Supabase — new row in interrogation_sessions, new row in
   session_messages with role='ai'

Edge case:

- POST with invalid role_id → 400 error with readable message

Failure state:

- POST without auth header → 401 "Please log in to continue."

---

FILES CHANGED

backend
server/routes/sessions.js — created: POST /api/sessions
server/services/gemini.js — modified: added sendInterrogationMessage,
buildInterrogationSystemPrompt

---

COMMIT MESSAGE

Add POST /api/sessions endpoint with Gemini opening message

Creates a new interrogation session for the authenticated employee,
generates the AI's opening question using the role-specific system
prompt, and saves both the session and the first message to the
database. Session status defaults to active on creation.

COMMIT

git add server/routes/sessions.js server/services/gemini.js
git commit -m "feat(sessions): add POST /api/sessions with Gemini opening message" -m "Creates a new interrogation session for the authenticated employee and generates the AI's opening question using the role-specific system prompt. Both the session record and the first AI message are persisted to the database on creation."

---

### Example — Single Component

After building just the AIAvatar component:

**HOW TO TEST — AIAvatar component**

Happy path:

1. Import AIAvatar into any page
2. Render `<AIAvatar size={24} />`
3. A volt-colored diamond appears and rotates continuously

Edge case:

- Render without size prop → defaults to 24px, no errors

Failure state:

- diamondPulse keyframe missing from index.css → diamond renders
  static, no animation — check index.css keyframes

---

FILES CHANGED

frontend
src/components/ui/AIAvatar.jsx — created

---

COMMIT MESSAGE

Add AIAvatar component with diamond pulse animation

Implements the AI presence indicator used throughout the chat interface.
Renders a volt-colored rotated square that morphs continuously using
the diamondPulse keyframe, chosen to suggest intelligence and attention
without any generic AI iconography.

COMMIT

git add src/components/ui/AIAvatar.jsx
git commit -m "feat(ui): add AIAvatar component with diamond pulse animation" -m "Implements the AI presence indicator used throughout the chat interface. Renders a volt-colored diamond that morphs continuously using the diamondPulse keyframe, chosen to suggest intelligence and attention without relying on generic AI iconography."

---

## How to Use This File

**Start every session:**

```
Read CLAUDE.md fully before doing anything.
Then read PHASE_1.md.
We are on Build Order step [number]: [name].
```

**When design drifts:**

```
Stop. Re-read the design system in CLAUDE.md.
Fix the deviation before continuing.
```

**When a new feature idea appears:**

```
Noted. Adding to post-MVP list.
Staying on Build Order step [number].
```

**When the session ends:**

```
Before stopping — run the three end-of-implementation steps:
1. How to test
2. Files changed
3. Commit message
```
