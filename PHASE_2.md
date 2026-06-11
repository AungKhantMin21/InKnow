# PHASE_2.md — InKnow V1.1.0 Build Context

## Feed this file to Claude Code at the start of every Phase 2 session.

---

## What Phase 2 Is

Phase 1 built the core product for a single team.
Phase 2 makes it ready for an entire company.

Four headline additions:

**1. Groups & Permissions** — knowledge is partitioned by department/team.
Private knowledge stays private. Public knowledge flows company-wide.
Admin manages the structure. Managers control their group's content.
Employees work within their group without knowing anything has changed.

**2. Inno Gets Smarter** — Inno enters every session already informed.
It knows what the team has captured. It knows what the company has published.
Employees stop re-explaining basics. Sessions go straight to new knowledge.

**3. Roles Simplified** — no more fixed role taxonomy (IT Administrator,
Finance Officer etc.). Users have a freeform job_title and one of three
platform permission levels: employee, manager, or admin. These stack.

**4. Token Cost Architecture** — context caching reduces interrogation
session costs by ~75%. System prompt cached explicitly at session start.
Conversation history benefits from implicit caching automatically.

Everything in Phase 1 continues to work. Phase 2 adds layers on top.

---

## What Is NOT Changing

- Tech stack: React + Vite + Express + Supabase + Gemini — unchanged
- Design system: Fraunces + Epilogue + DM Mono + all CSS variables — unchanged
- Core flows: sessions, articles, knowledge browser, Inno copilot — unchanged
- No UI libraries, no ORM, no state management libraries — same rules apply
- Dependency philosophy: question every npm install — same rules apply

---

## Role Model

Phase 1 used `is_manager boolean` and a `roles` table with fixed job roles.
Phase 2 removes the roles table entirely and replaces it with a simpler model.

Roles are **additive permission sets**, not exclusive labels.
A person can hold any combination simultaneously.
Job titles are freeform text — not from a predefined list.

```
is_admin    boolean DEFAULT false  — platform structure management
is_manager  boolean DEFAULT false  — group content management
group_id    uuid (nullable)        — group membership for employee experience
job_title   text                   — freeform: "Senior IT Engineer", "HR Lead"
```

**Role combinations:**

```
is_admin=false  is_manager=false  group_id=X    → employee
is_admin=false  is_manager=true   group_id=X    → manager
is_admin=true   is_manager=false  group_id=null → pure admin (no group)
is_admin=true   is_manager=false  group_id=X    → admin + employee
is_admin=true   is_manager=true   group_id=X    → admin + manager + employee
```

**What each permission level can do:**

```
ADMIN:
  Create / rename / archive groups
  Assign employees to groups
  Assign manager role to employees
  Set is_admin on other accounts
  Mark articles as core (max 20)
  View platform-wide stats (numbers only, no private content)
  Cannot read private articles from other groups
  Cannot approve/reject articles (that belongs to managers)

MANAGER (scoped to their group):
  Approve / reject articles in their group
  Toggle article visibility: private → public
  View all articles in group including pending/rejected
  View group coverage and pending queue
  Generate group invite links

EMPLOYEE (scoped to their group):
  Create sessions and capture knowledge
  Query Inno (own group + public articles)
  View approved articles in own group + public
  Cannot manage anything

A person with group_id participates as employee in that group
regardless of whether they are also admin or manager.
One person, one group at a time.
Admins do not get multi-group access.
If admin needs to work in a different group — reassign group_id.
```

**Admin creation — manual only, no UI:**

```sql
-- Set directly in Supabase, never via application UI
UPDATE employees SET is_admin = true WHERE email = 'admin@company.com';
```

No automatic promotion. No first-user-becomes-admin logic.

---

## Removing the Roles Table

The `roles` table and `role_id` foreign keys are removed entirely.

**What replaces them:**

```
BEFORE (Phase 1)               AFTER (Phase 2)
─────────────────────────────────────────────────────
roles table (seeded list)   →  REMOVED
role_id on employees        →  REMOVED (use job_title + group_id)
role_id on sessions         →  REMOVED (use group_id)
role_id on articles         →  REMOVED (use group_id)
GET /api/roles              →  REMOVED (no longer needed)
Role filter in KB browser   →  Group filter (filter by group_id)
"IT Administrator" label    →  employee.job_title (freeform)
```

**Inno interrogation prompt — role reference updated:**

```js
// Before
`conducting a session with ${employeeName}, who works as a ${roleName}`
// After
`conducting a session with ${employeeName},
 whose job is ${jobTitle} in the ${groupName} team`;
```

**Knowledge browser — filter updated:**

```
Before: filter by role (IT Administrator, Finance Officer...)
After:  filter by group (HR Team, IT Department, Finance...)
```

Articles are organised by group membership, not by a predefined role taxonomy.

---

## Article Type Model

Three article types. Each has different injection and retrieval behaviour.

```
TYPE             SET BY    HOW INNO USES IT           SCOPE
────────────────────────────────────────────────────────────────
private          default   RAG within own group only  Own group
public           manager   RAG on demand, cross-group Company-wide
public + core    admin     Always injected in prompts Company-wide
```

**Private (default):**
Every new article starts as private. Visible only to own group members.
Own group's Inno retrieves it via RAG. No other group can access it.

**Public:**
Manager toggles visibility. Visible to all employees company-wide.
Every group's Inno can retrieve it via RAG when relevant.
Still owned by originating group — updates propagate everywhere.
Examples: company policies, shared system guides, onboarding materials.

**Public + Core:**
Admin marks a public article as core. Hard cap: 20 core articles.
Core articles are injected into every session system prompt — always present.
For foundational company knowledge Inno should always know.
Examples: "What is the Point Portal", "Company Values", "How We Work".
A private article cannot be marked core. Core implies public.
Core articles are cached — injecting them costs near-zero per message.

**Visibility state machine:**

```
private  →  [manager toggles]  →  public
public   →  [admin marks]      →  public + core (is_core=true)
public + core  →  [admin unmarks]  →  public
public   →  [manager toggles]  →  private
  (toggling back to private auto-removes core if set)
```

---

## Sidebar Navigation Model

One unified sidebar. No portal switching. No redirects on login.
Sections reveal based on what roles the person holds.
Sections are separated by a labelled divider.
Never show a section header with no items under it.

**Employee only:**

```
InKnow (wordmark)

MY WORK
  Dashboard
  · New session
  Sessions
  Knowledge
  Inno
──────────────────
[name]
[job title]
Sign out
```

**Manager (has group_id + is_manager):**

```
InKnow (wordmark)

MY WORK
  Dashboard
  · New session
  Sessions
  Knowledge
  Inno

MY GROUP
  Manager
──────────────────
[name]
Manager · [job title]
Sign out
```

**Admin without group (is_admin, no group_id):**

```
InKnow (wordmark)

ADMIN
  Admin Portal
──────────────────
[name]
Admin
Sign out
```

**Admin + employee (is_admin + group_id):**

```
InKnow (wordmark)

MY WORK
  Dashboard
  · New session
  Sessions
  Knowledge
  Inno

ADMIN
  Admin Portal
──────────────────
[name]
Admin · [job title]
Sign out
```

**Admin + manager + employee (full access):**

```
InKnow (wordmark)

MY WORK
  Dashboard
  · New session
  Sessions
  Knowledge
  Inno

MY GROUP
  Manager

ADMIN
  Admin Portal
──────────────────
[name]
Admin · Manager · [job title]
Sign out
```

**Section label component:**

```jsx
const SidebarSection = ({ label, children }) => (
  <div className="mt-4">
    <div className="flex items-center gap-2 px-4 pb-1">
      <span
        className="font-mono text-[8px] tracking-[0.28em]
                       uppercase text-ink-4 whitespace-nowrap"
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-rule" />
    </div>
    {children}
  </div>
);

// Usage
{
  hasGroup && (
    <SidebarSection label="My Work">
      <NavItem to="/dashboard">Dashboard</NavItem>
      <NavItem to="/sessions/new" accent>
        · New session
      </NavItem>
      <NavItem to="/sessions">Sessions</NavItem>
      <NavItem to="/knowledge">Knowledge</NavItem>
      <NavItem to="/inno">Inno</NavItem>
    </SidebarSection>
  );
}

{
  isManager && hasGroup && (
    <SidebarSection label="My Group">
      <NavItem to="/manager">Manager</NavItem>
    </SidebarSection>
  );
}

{
  isAdmin && (
    <SidebarSection label="Admin">
      <NavItem to="/admin">Admin Portal</NavItem>
    </SidebarSection>
  );
}
```

**Role label under user name (bottom of sidebar):**

```
Admin + Manager + employee  → "Admin · Manager · [job title]"
Admin + Manager             → "Admin · Manager"
Admin + employee            → "Admin · [job title]"
Admin only                  → "Admin"
Manager + employee          → "Manager · [job title]"
Employee only               → "[job title]"
```

---

## Schema Changes

Run all migrations in this exact order in Supabase SQL editor.
Do not write any application code until all migrations are complete.

```sql
-- ══════════════════════════════════════════════════════════════
-- STEP 1: Groups table
-- ══════════════════════════════════════════════════════════════
CREATE TABLE groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  archived    boolean DEFAULT false,
  created_by  uuid,   -- set after employees table is updated
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- STEP 2: Update employees table
-- ══════════════════════════════════════════════════════════════
ALTER TABLE employees
  ADD COLUMN is_admin   boolean DEFAULT false,
  ADD COLUMN group_id   uuid REFERENCES groups(id),
  ADD COLUMN job_title  text;

-- Migrate existing is_manager boolean — keep it, no change needed
-- is_manager already exists from Phase 1

-- ══════════════════════════════════════════════════════════════
-- STEP 3: Update interrogation_sessions
-- ══════════════════════════════════════════════════════════════
ALTER TABLE interrogation_sessions
  ADD COLUMN group_id        uuid REFERENCES groups(id),
  ADD COLUMN gemini_cache_id text;   -- stores Gemini cache.name

-- Remove role_id from sessions (after migrating data below)
-- ALTER TABLE interrogation_sessions DROP COLUMN role_id;
-- Run this AFTER backfilling group_id

-- ══════════════════════════════════════════════════════════════
-- STEP 4: Update knowledge_articles
-- ══════════════════════════════════════════════════════════════
ALTER TABLE knowledge_articles
  ADD COLUMN group_id    uuid REFERENCES groups(id),
  ADD COLUMN visibility  text CHECK (visibility IN ('private','public'))
             DEFAULT 'private',
  ADD COLUMN is_core     boolean DEFAULT false;

-- Remove role_id from articles (after migrating data below)
-- ALTER TABLE knowledge_articles DROP COLUMN role_id;
-- Run this AFTER backfilling group_id

-- ══════════════════════════════════════════════════════════════
-- STEP 5: Group invite tokens
-- ══════════════════════════════════════════════════════════════
CREATE TABLE group_invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid REFERENCES groups(id) ON DELETE CASCADE,
  token      text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_by uuid REFERENCES employees(id),
  expires_at timestamptz,   -- null = never expires
  created_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- STEP 6: Backfill existing Phase 1 data
-- ══════════════════════════════════════════════════════════════
-- Create a default group for all existing data
INSERT INTO groups (name, description)
VALUES ('Default Group', 'Migrated from Phase 1');

-- Copy the new group id, then run:
-- UPDATE employees SET group_id = '<new-group-uuid>';
-- UPDATE interrogation_sessions SET group_id = '<new-group-uuid>';
-- UPDATE knowledge_articles
--   SET group_id = '<new-group-uuid>', visibility = 'private';

-- Set job_title from the old role name for existing employees:
-- UPDATE employees e
--   SET job_title = r.name
--   FROM roles r
--   WHERE e.role_id = r.id;

-- After backfill is verified, drop old role columns:
-- ALTER TABLE interrogation_sessions DROP COLUMN role_id;
-- ALTER TABLE knowledge_articles DROP COLUMN role_id;
-- ALTER TABLE employees DROP COLUMN role_id;
-- DROP TABLE roles;

-- ══════════════════════════════════════════════════════════════
-- STEP 7: Update match_articles — group-aware scoping
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION match_articles (
  query_embedding   vector(768),
  match_threshold   float DEFAULT 0.4,
  match_count       int   DEFAULT 3,
  requesting_group  uuid  DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  title        text,
  summary      text,
  content      text,
  group_id     uuid,
  visibility   text,
  is_core      boolean,
  captured_by  uuid,
  created_at   timestamptz,
  similarity   float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, title, summary, content, group_id, visibility,
    is_core, captured_by, created_at,
    1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_articles
  WHERE approved = true
    AND rejected = false
    AND (
      (requesting_group IS NOT NULL AND group_id = requesting_group)
      OR visibility = 'public'
    )
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

## Context Caching Architecture

This is the core cost-control mechanism for Phase 2.
Two layers working together cut interrogation session costs by ~75%.

### Why This Matters

Without caching, every message in a session re-sends:

- The full system prompt (800+ tokens with knowledge context)
- The entire conversation history so far

By message 10 of a session, you're paying for 10× the system prompt tokens.
With explicit caching, the system prompt is paid for once per session.

### Layer 1 — Explicit Cache: System Prompt

The system prompt (persona + core articles + group context) is static
for the duration of a session. Cache it at session creation.

```
Discount: 75% on gemini-2.0-flash, 90% on gemini-2.5+
TTL: 2 hours (covers a full session with margin)
Cache name stored in: interrogation_sessions.gemini_cache_id
```

**Implementation in POST /api/sessions:**

```js
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Build full system prompt with tiered knowledge context
const systemPrompt = buildInterrogationSystemPrompt(
  employeeName,
  jobTitle,
  groupName,
  context, // { coreArticles, groupArticles, publicArticles, otherTopics }
);

// Create explicit cache for the static system prompt
const cache = await genAI.caches.create({
  model: "gemini-2.0-flash",
  config: {
    systemInstruction: systemPrompt,
    ttl: "7200s", // 2 hours
  },
});

// Store cache reference in session
await supabase
  .from("interrogation_sessions")
  .update({ gemini_cache_id: cache.name })
  .eq("id", sessionId);

// Use cache for opening message
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  cachedContent: cache.name,
});
const chat = model.startChat({ history: [] });
const result = await chat.sendMessage(openingPrompt);
```

**Implementation in POST /api/sessions/:id/message:**

```js
// Load existing session with cache id
const { data: session } = await supabase
  .from("interrogation_sessions")
  .select("gemini_cache_id, message_count")
  .eq("id", sessionId)
  .single();

// Load conversation history
const { data: messages } = await supabase
  .from("session_messages")
  .select("role, content")
  .eq("session_id", sessionId)
  .order("created_at", { ascending: true });

// Use cached system prompt — no re-injection needed
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  cachedContent: session.gemini_cache_id,
});

const chat = model.startChat({
  history: messages.map((m) => ({
    role: m.role === "ai" ? "model" : "user",
    parts: [{ text: m.content }],
  })),
});

const result = await chat.sendMessage(newMessage);
const aiResponse = result.response.text();
```

### Layer 2 — Implicit Cache: Conversation History

Gemini 2.5+ models automatically cache requests that share a common prefix.
By keeping the conversation history at the start and new message at the end,
Gemini can cache growing conversation turns automatically.

This requires no code change — just the correct message ordering:

```
[CACHED: system prompt]     ← explicit cache, ~75-90% discount
[history turn 1]            ← implicit cache candidate
[history turn 2]            ← implicit cache candidate
...
[history turn N-1]          ← implicit cache candidate
[new message]               ← always new, always last
```

### Cache Lifecycle

```
Session created   → create cache (TTL: 2 hours)
Session active    → all messages reference cache_id
Session completed → cache expires naturally (no manual deletion)
Session re-opened → check if cache still valid (not expired)
                    if expired → create new cache from current system prompt
                    if valid   → reuse existing cache_id
```

**Cache expiry check on re-opened session:**

```js
const isCacheValid = async (cacheId) => {
  if (!cacheId) return false;
  try {
    await genAI.caches.get(cacheId);
    return true;
  } catch {
    return false; // expired or not found
  }
};

// In POST /api/sessions/:id/message when session is re-opened:
const cacheValid = await isCacheValid(session.gemini_cache_id);
if (!cacheValid) {
  // Rebuild system prompt with current knowledge context
  // and create a new cache
  const newCache = await createSessionCache(session);
  await supabase
    .from("interrogation_sessions")
    .update({ gemini_cache_id: newCache.name })
    .eq("id", sessionId);
}
```

### Cost Comparison

```
15-message session, without caching:
  Total input tokens across all calls: ~14,000
  Cost at $0.10/M: ~$0.0014 per session

15-message session, with caching:
  System prompt: cached at 75% discount
  History: implicit cache hits on Gemini 2.5+
  Effective cost: ~$0.00035 per session
  Saving: ~75%

At 50 sessions/day, 30 days:
  Without caching: $2.10/month
  With caching:    $0.53/month
  Scales linearly — cost stays proportional as users grow
```

---

## Tiered Context Injection for Inno

Inno enters every interrogation session already informed.
Cost is bounded regardless of knowledge base size.
Core articles are cached — their token cost is near-zero per message.

```
TIER 1 — Core articles (admin-marked, always injected, cached)
  Load: is_core=true AND approved=true
  Max: 20 articles hard cap
  Tokens: ~600 — paid once per session via explicit cache

TIER 2 — Own group articles (semantic RAG)
  Embed: job_title + group_name + "knowledge"
  Retrieve: top 8 most similar from own group
  Tokens: ~240 per session start

TIER 3 — Public articles from other groups (semantic RAG)
  Same embedding as Tier 2
  Retrieve: top 5 most similar public articles from other groups
  Tokens: ~150 per session start

TIER 4 — Structural awareness (titles only, no content)
  Load: public article titles from other groups
  Limit: 30 titles
  Format: comma-separated list
  Tokens: ~100 — tells Inno topics exist without revealing content

TOTAL: ~1,100 tokens per session — bounded forever
All injected once into the system prompt, then cached.
```

**buildSessionContext function:**

```js
export const buildSessionContext = async (
  employeeGroupId,
  jobTitle,
  groupName,
) => {
  // Tier 1 — Core articles (hard cap 20)
  const { data: coreArticles } = await supabase
    .from("knowledge_articles")
    .select("title, summary")
    .eq("is_core", true)
    .eq("approved", true)
    .eq("rejected", false)
    .limit(20);

  // Tier 2 — Own group semantic retrieval
  const roleEmbedding = await generateEmbedding(
    `${jobTitle} ${groupName} knowledge processes`,
  );
  const { data: groupMatches } = await supabase.rpc("match_articles", {
    query_embedding: roleEmbedding,
    match_threshold: 0.35,
    match_count: 8,
    requesting_group: employeeGroupId,
  });
  const coreIds = new Set((coreArticles || []).map((a) => a.id));
  const groupArticles = (groupMatches || []).filter(
    (a) => a.group_id === employeeGroupId && !coreIds.has(a.id),
  );

  // Tier 3 — Public articles from other groups
  const publicArticles = (groupMatches || [])
    .filter(
      (a) =>
        a.group_id !== employeeGroupId &&
        a.visibility === "public" &&
        !coreIds.has(a.id),
    )
    .slice(0, 5);

  // Tier 4 — Other groups' public topic titles only
  const injectedIds = new Set([
    ...coreIds,
    ...groupArticles.map((a) => a.id),
    ...publicArticles.map((a) => a.id),
  ]);
  const { data: otherTitles } = await supabase
    .from("knowledge_articles")
    .select("title")
    .eq("approved", true)
    .eq("rejected", false)
    .eq("visibility", "public")
    .neq("group_id", employeeGroupId)
    .not("id", "in", `(${[...injectedIds].join(",")})`)
    .order("view_count", { ascending: false })
    .limit(30);

  return {
    coreArticles: coreArticles || [],
    groupArticles,
    publicArticles,
    otherTopics: (otherTitles || []).map((a) => a.title),
  };
};
```

**Updated buildInterrogationSystemPrompt:**

```js
export const buildInterrogationSystemPrompt = (
  employeeName,
  jobTitle,
  groupName,
  context = {
    coreArticles: [],
    groupArticles: [],
    publicArticles: [],
    otherTopics: [],
  },
) =>
  `
You are a warm, deeply curious colleague conducting a knowledge capture
session with ${employeeName}, whose job is ${jobTitle} in the
${groupName} team.

Your purpose: extract knowledge that lives in their head —
the things not written down anywhere yet — and preserve it for the team.

${
  context.coreArticles.length > 0
    ? `
COMPANY FUNDAMENTALS (always know these):
${context.coreArticles.map((a) => `- ${a.title}: ${a.summary}`).join("\n")}
`
    : ""
}

${
  context.groupArticles.length > 0
    ? `
WHAT YOUR TEAM HAS ALREADY CAPTURED:
${context.groupArticles.map((a) => `- ${a.title}: ${a.summary}`).join("\n")}
`
    : ""
}

${
  context.publicArticles.length > 0
    ? `
WHAT OTHER TEAMS HAVE SHARED COMPANY-WIDE:
${context.publicArticles.map((a) => `- ${a.title}: ${a.summary}`).join("\n")}
`
    : ""
}

${
  context.otherTopics.length > 0
    ? `
OTHER TEAMS HAVE ALSO CAPTURED KNOWLEDGE ABOUT:
${context.otherTopics.join(", ")}
(You know these topics exist but not the details. If ${employeeName}
mentions one, acknowledge you have heard of it and focus on what is
new from their perspective.)
`
    : ""
}

USE THIS KNOWLEDGE NATURALLY:
- When ${employeeName} references something you already know above,
  confirm it and move forward: "Right — that handles promotions.
  Tell me about the banner upload specifically."
- Do not ask them to re-explain what is already captured above
- Focus only on what is genuinely new or different
- If they add nuance to something you know, capture that nuance

${
  context.coreArticles.length + context.groupArticles.length > 0
    ? `OPENING: Acknowledge what you know and ask what is missing:
     "I have been learning about [relevant topic from what you know].
     What parts of your work have not been captured yet — things
     you would not know from talking to others?"`
    : `OPENING: "What is the one thing in your role that took you the
     longest to figure out? The thing nobody told you when you started?"`
}

CONVERSATION STYLE:
- Sound like a colleague who has done their homework
- One question at a time, always
- 1-3 sentences per message maximum
- Focus on what you do NOT know yet

NEVER:
- Ask about things already captured above
- Ask two questions in one message
- Sound like a form or an interview
`.trim();
```

---

## Session Title Feature (Full Implementation)

Column exists from Phase 1 schema. This is the full generation logic.

**Provisional title — after 3 exchanges (message_count = 6):**

```js
// In POST /api/sessions/:id/message
// After saving messages and incrementing message_count:

if (newMessageCount === 6 && !session.title) {
  const messages = await getSessionMessages(sessionId);
  const conversation = formatConversation(messages);
  // Fire and forget — never await
  generateProvisionalTitle(conversation)
    .then((title) =>
      supabase
        .from("interrogation_sessions")
        .update({ title, title_generated_at: new Date() })
        .eq("id", sessionId),
    )
    .catch(() => {});
}
```

**Final title — on session completion (parallel with articles):**

```js
const [articles, finalTitle] = await Promise.all([
  generateArticles(buildArticleGenerationPrompt(conversation, jobTitle)),
  generateSessionTitle(conversation),
]);

await supabase
  .from("interrogation_sessions")
  .update({
    title: finalTitle,
    title_generated_at: new Date(),
    status: "completed",
    completed_at: new Date(),
    last_completed_at: new Date(),
    last_completion_message_id: lastMessage.id,
  })
  .eq("id", sessionId);
```

**Display in sessions list:**

```jsx
const displayTitle = session.title || session.job_title || 'Session'

<p className="font-display font-[200] text-[15px]
              text-ink leading-tight mb-1">
  {displayTitle}
</p>
<p className="font-mono text-[9px] text-ink-4 tracking-[0.04em]">
  {session.group_name} · {formatDate(session.started_at)}
  {' · '}
  {Math.floor(session.message_count / 2)} exchanges
</p>
```

**Fallback chain:**

```
1. session.title (Gemini-generated)
2. session.job_title (always exists)
Never show null. Never show "Untitled Session".
```

---

## Session End Intelligence

Replaces hardcoded 8-exchange minimum.
Content richness determines when "End session" becomes available.
Employee always makes the final call — we nudge, never block.

```js
// client/src/lib/session.js
export const isSessionRichEnough = (messages) => {
  const employeeMessages = messages.filter((m) => m.role === "employee");

  const totalWords = employeeMessages.reduce(
    (sum, m) => sum + m.content.trim().split(/\s+/).length,
    0,
  );

  const messageCount = employeeMessages.length;

  // Rich enough if: 150 words (two solid paragraphs) OR 4 exchanges
  // Whichever comes first
  return totalWords >= 150 || messageCount >= 4;
};
```

**UI behaviour:**

```
Below threshold:
  Button visible, secondary styling
  Tooltip on hover: "More detail means richer articles —
                     but you can end now if you're ready."

Above threshold:
  Button visible, primary styling
  No tooltip

Always:
  Button is never disabled — employee can always end
  We nudge, we never block
```

---

## New API Endpoints

All existing Phase 1 endpoints remain unchanged.
These are additions and updates only.

```
── GROUPS ──────────────────────────────────────────────────────
GET    /api/groups                    admin only
POST   /api/groups                    admin only — { name, description }
PATCH  /api/groups/:id                admin only — { name, description }
PATCH  /api/groups/:id/archive        admin only

── GROUP MEMBERS ───────────────────────────────────────────────
GET    /api/groups/:id/members        admin or group manager
POST   /api/groups/:id/members        admin only — { employee_id }
DELETE /api/groups/:id/members/:eid   admin only

── GROUP INVITES ────────────────────────────────────────────────
POST   /api/groups/:id/invites        admin or manager — generates token
GET    /api/invites/:token            public — validate, return group info
POST   /api/invites/:token/accept     authenticated — join group via token

── ADMIN ───────────────────────────────────────────────────────
GET    /api/admin/stats               admin only
GET    /api/admin/employees           admin only
PATCH  /api/admin/employees/:id/role  admin only
  body: { is_manager, is_admin, group_id, job_title }

── ARTICLE VISIBILITY ──────────────────────────────────────────
PATCH  /api/knowledge/:id/visibility  manager only
  body: { visibility: 'private' | 'public' }

PATCH  /api/knowledge/:id/core        admin only
  body: { is_core: true | false }
  validation: article must be public before marking core
              reject if core count would exceed 20
              auto-unset if visibility toggled back to private

── UPDATED EXISTING ────────────────────────────────────────────
POST   /api/sessions        stores group_id from employee.group_id
                            creates Gemini cache, stores cache_id
POST   /api/sessions/:id/message  references gemini_cache_id
                                  refreshes expired cache if needed
POST   /api/knowledge       stores group_id, visibility='private'
GET    /api/knowledge       scopes to own group + public articles
GET    /api/manager/pending scopes to manager's group only
POST   /api/copilot/query   passes requesting_group to match_articles

── REMOVED ─────────────────────────────────────────────────────
GET    /api/roles            removed — roles table no longer exists
```

---

## Admin Portal

Accessible at /admin when is_admin=true.
Shown in sidebar as "Admin Portal" under ADMIN section.
Full-page layout, additional to employee/manager experience.

**Pages:**

```
/admin                    → redirect to /admin/groups
/admin/groups             → group list + create group
/admin/groups/:id         → group detail: members, managers, invites
/admin/employees          → all employees + role + group assignment
/admin/core-knowledge     → manage core articles (20 max)
/admin/stats              → platform-wide numbers (no content)
```

**Groups page — card layout:**

```
[Create group] button top right

Group card:
  Name (Fraunces 200)
  Description (Epilogue 300 ink-3)
  X members · X articles · Last active [date] (DM Mono 9px)
  Manager: [name] or "No manager assigned"
  [View] [Archive] actions
```

**Group detail page:**

```
Group name (inline editable)
Description (inline editable)

MANAGER SECTION
  Current manager name + [Remove manager]
  [Assign manager] — search from group members

MEMBERS SECTION
  Employee list: name · job title · [Remove]
  [Add member] — search unassigned employees

INVITE LINKS SECTION
  Active links: token preview · created by · expires
  [Generate new link] — copies to clipboard automatically
  [Revoke] per link

DANGER ZONE
  [Archive group] — with confirmation
```

**Employees page:**

```
Search input
Employee list:
  Name · Email · Group name · Role badges · Job title
  [Edit] inline: group_id, is_manager, is_admin, job_title
```

**Core knowledge page:**

```
X of 20 core articles used (progress indicator)

Core article list:
  Title · Group · [Remove core] per article
  Warning at 18/20: "Approaching limit"
  Add button disabled at 20/20

Add core article:
  Search approved public articles
  [Mark as core]
```

---

## Knowledge Visibility Controls

**Visibility toggle in ArticleDetail (manager only):**

```jsx
{
  isManager && (
    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-rule">
      <span
        className="font-mono text-[9px] tracking-[0.14em]
                     uppercase text-ink-4"
      >
        Visibility
      </span>
      <button
        onClick={handleToggleVisibility}
        className={`font-mono text-[8px] tracking-[0.14em] uppercase
                  px-3 py-1.5 border transition-colors
                  ${
                    article.visibility === "public"
                      ? "bg-forest-light text-forest border-forest/20"
                      : "bg-ground text-ink-3 border-rule"
                  }`}
      >
        {article.visibility === "public" ? "Public" : "Private"}
      </button>
      <span className="font-body font-light text-xs text-ink-3">
        {article.visibility === "public"
          ? "Visible to everyone in the company"
          : "Visible to your group only"}
      </span>
    </div>
  );
}
```

**Badges on knowledge cards:**

```jsx
<div className="flex items-center gap-1.5">
  {article.is_core && (
    <span
      className="font-mono text-[7px] tracking-[0.14em] uppercase
                     text-volt bg-volt-light border border-volt/20
                     px-1.5 py-0.5"
    >
      Core
    </span>
  )}
  {article.visibility === "public" && !article.is_core && (
    <span
      className="font-mono text-[7px] tracking-[0.14em] uppercase
                     text-forest bg-forest-light border border-forest/20
                     px-1.5 py-0.5"
    >
      Public
    </span>
  )}
</div>
```

---

## Copilot Scoping

**Group-scoped retrieval:**

```js
// Pass employee's group_id to all match_articles calls
supabase.rpc("match_articles", {
  query_embedding: embedding,
  match_threshold: matchThreshold,
  match_count: matchCount,
  requesting_group: req.employee.group_id,
});
```

**Privacy boundary in copilot prompt:**

Add to buildCopilotPrompt:

```
"If you cannot answer because the knowledge belongs to another
team's private information, respond with exactly:
'That knowledge is managed by [team area] and I don't have
access to their private information. You would need to speak
with someone from that team directly.'

Never pretend the knowledge does not exist.
Acknowledge the boundary honestly and redirect."
```

---

## Build Order — Phase 2

Steps 01–04 are interdependent and must ship together.
Steps 05+ are independent and can ship in any order after 01–04.

---

### 01 — Schema Migration

```
□ Run all schema steps 1–7 in Supabase SQL editor in order
□ Create default group for existing Phase 1 data
□ Backfill group_id on employees, sessions, articles
□ Backfill job_title from old role names on employees
□ Backfill visibility = 'private' on all existing articles
□ Drop old role_id columns after backfill verified
□ Drop roles table after backfill verified
□ Update match_articles function with group scoping
□ Set is_admin=true for admin account manually
□ Verify all columns in Supabase dashboard
```

**Done when:** All tables migrated. Existing data intact.
Admin account has is_admin=true. Old roles table gone.

---

### 02 — RBAC Middleware & Auth Updates

```
□ Update auth middleware to load is_admin, group_id, job_title
□ Update GET /api/auth/me to return is_admin, group_id, job_title
□ Update useAuth hook to expose isAdmin, groupId, jobTitle
□ Add requireAdmin middleware for /api/admin/* routes
□ Update existing manager guard to check is_manager + group_id
□ Remove GET /api/roles endpoint
□ All existing routes scope queries by group_id where relevant
□ Sessions list scoped to employee's group_id
□ Knowledge browser scoped to own group + public
□ Manager endpoints scoped to manager's own group
```

**Done when:** Auth returns full role info. All routes
correctly scoped. Existing employee flows still work.

---

### 03 — Groups API

```
□ GET/POST/PATCH /api/groups
□ PATCH /api/groups/:id/archive
□ GET/POST/DELETE /api/groups/:id/members
□ POST /api/groups/:id/invites
□ GET /api/invites/:token (public)
□ POST /api/invites/:token/accept
□ GET/PATCH /api/admin/employees
□ PATCH /api/admin/employees/:id/role
□ GET /api/admin/stats
□ PATCH /api/knowledge/:id/visibility
□ PATCH /api/knowledge/:id/core (with 20-article cap validation)
```

**Done when:** All group management endpoints work.
Invite flow works end-to-end. Visibility + core toggles work.

---

### 04 — Updated Sidebar + Admin Portal UI

```
□ Sidebar: three sections MY WORK / MY GROUP / ADMIN
□ Sections render only when user has that role
□ Section labels: DM Mono 8px uppercase with rule line
□ Role label under user name at bottom
□ Admin portal pages: groups, group detail, employees,
  core knowledge, stats
□ Visibility toggle in ArticleDetail (manager only)
□ Core + Public badges on knowledge cards
□ Knowledge browser: filter by group instead of role
□ Group filter sidebar in knowledge browser
```

**Done when:** Sidebar correct per role combination.
Admin can manage groups and employees.
Manager can toggle article visibility.
Knowledge browser filters by group.

---

### 05 — Context Caching

```
□ Add gemini_cache_id column to interrogation_sessions (in migration)
□ POST /api/sessions: create Gemini cache, store cache_id
□ POST /api/sessions/:id/message: reference cache_id
□ isCacheValid helper: check if cache is still alive
□ Cache refresh: rebuild and re-cache if expired (re-opened sessions)
□ buildSessionContext: all four tiers implemented
□ buildInterrogationSystemPrompt: updated signature with context
□ Test: verify cached tokens appear in usage_metadata
□ Test: 15-message session costs ~75% less than without caching
```

**Done when:** Sessions reference cached system prompts.
Cost reduction visible in Gemini usage dashboard.

---

### 06 — Knowledge Scoping

```
□ match_articles RPC passes requesting_group on all copilot queries
□ Interrogation sessions load tiered context on creation
□ Knowledge browser shows own group + public only
□ Privacy boundary response in copilot prompt
□ Article detail: enforce group scoping for non-managers
□ Gap state updated: "Nobody in your group has captured this yet."
□ Test: employee cannot see other group's private articles
□ Test: public articles appear across groups
□ Test: Inno acknowledges privacy boundary honestly
```

**Done when:** Group isolation works correctly.
Public articles cross boundaries. Private articles do not.

---

### 07 — Session Titles

```
□ Provisional title after message_count = 6 (fire and forget)
□ Final title on completion parallel with article generation
□ Sessions list shows title with job_title fallback
□ Session page topbar shows title
□ Test: varied session topics produce relevant titles
□ Test: fallback works when Gemini fails silently
```

**Done when:** Sessions list shows meaningful titles.
No session shows null or "Untitled".

---

### 08 — Session End Intelligence

```
□ isSessionRichEnough in client/src/lib/session.js
□ End session button: secondary style below threshold
□ End session button: primary style above threshold
□ Hover tooltip when below threshold
□ Remove 8-exchange minimum from all session logic
□ Test: rich first message → button available immediately
□ Test: short answers → button subdued until threshold met
□ Test: button never disabled — always clickable
```

**Done when:** Employee with structured content in first message
can end immediately. Gradual sessions still guided naturally.

---

### 09 — Polish Pass (Phase 2 specific)

```
□ Admin portal full design audit — matches design system exactly
□ Sidebar section label spacing consistent
□ All empty states for admin portal
  "No groups yet → Create your first group"
  "No employees → Invite your first team member"
  "No core articles → Mark foundational articles as core"
□ Loading skeletons for all new admin endpoints
□ Error states for all new endpoints
□ Invite link copy: button state change confirms copy
□ Group archive: confirmation before action
□ Core article cap: clear warning UI at 18/20 and 20/20
□ Visibility toggle: optimistic UI update before API responds
```

---

### 10 — Deploy V1.1.0

```
□ Run all schema migrations on production Supabase in order
□ Backfill production data into default group
□ Set admin account manually in production Supabase
□ Deploy client to Vercel
□ Deploy server to Railway
□ Smoke test: employee scoped knowledge and Inno
□ Smoke test: manager visibility toggle + approval
□ Smoke test: admin group creation + employee assignment
□ Smoke test: invite link flow end-to-end
□ Smoke test: public articles visible across groups
□ Smoke test: private articles invisible to other groups
□ Smoke test: context cache working (check usage_metadata)
□ Smoke test: session titles generating correctly
□ Smoke test: session end intelligence (rich first message)
```

---

## Definition of Phase 2 Complete

```
□ roles table removed — job_title is freeform text
□ Groups exist and employees are assigned to them
□ Admin created manually via Supabase (no UI)
□ Sidebar shows role-appropriate sections without portal switching
□ Admin can create groups, assign managers and employees
□ Managers can toggle article visibility (private/public)
□ Public articles visible to all groups via Inno and knowledge browser
□ Private articles visible to own group only
□ Admin can mark up to 20 public articles as core
□ Core articles always injected into every session prompt
□ Session system prompt cached explicitly (75% token discount)
□ Conversation history structured for implicit cache hits
□ Inno enters sessions knowing own group + public + topic awareness
□ Inno confirms known concepts without asking for re-explanation
□ Inno acknowledges privacy boundaries honestly
□ Sessions have AI-generated titles (not role names)
□ Session end based on content richness (150 words OR 4 exchanges)
□ Session end never blocks — nudges only
□ Invite links work end-to-end
□ All screens have loading / error / empty states
□ V1.1.0 deployed and smoke tested on production
```

---

## Never Do These Things (Phase 2 additions)

```
✗ Create admin via UI — manual Supabase only
✗ Use the old roles table or role_id — it is gone
✗ Hard-delete groups — always archive
✗ Allow is_core=true on private articles
✗ Exceed 20 core articles — hard cap enforced at application level
✗ Show other groups' private content to any employee — ever
✗ Show portal-switching UI — one sidebar, one login, one experience
✗ Show a section header in sidebar with no items under it
✗ Block session end — always allow, tooltip only
✗ Inject full article content in tiers 2/3/4 — titles + summaries only
✗ Await provisional title generation inside the message endpoint
✗ Re-send system prompt on every message — always reference cache_id
✗ All Phase 1 rules still apply in full
```

---

## How to Use This File

Phase 2 builds on top of a fully working Phase 1 product.
Do not modify Phase 1 core flows unless explicitly instructed.
