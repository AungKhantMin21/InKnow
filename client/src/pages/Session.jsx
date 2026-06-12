import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../hooks/useAuth.jsx";
import AIAvatar from "../components/ui/AIAvatar.jsx";
import {
  createSession,
  getSession,
  sendMessage,
  completeSession,
  listSessions,
  getSessionArticles,
} from "../lib/api.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CAPTURE_TRIGGERS = [
  "step", "first", "then", "after", "before", "always", "never",
  "call", "email", "contact", "ask", "talk to",
  "issue", "problem", "error", "workaround", "fix",
  "every", "monthly", "weekly", "daily",
  "tip", "important", "remember", "key",
];

const extractCapture = (text) => {
  const lower = text.toLowerCase();
  if (!CAPTURE_TRIGGERS.some((t) => lower.includes(t))) return null;
  return text.length > 72 ? text.slice(0, 72).trim() + "…" : text;
};

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ── Sub-components ────────────────────────────────────────────────────────────

const TypingIndicator = () => (
  <div className="flex items-start gap-3">
    <AIAvatar size={28} />
    <div className="bg-ground border border-rule px-4 py-3 flex items-center gap-1.5"
      style={{ borderRadius: "0 10px 10px 10px" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block w-1.5 h-1.5 rounded-full bg-ink-3"
          style={{ animation: "typingDot 1.2s ease infinite", animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  </div>
);

const Message = ({ msg }) => {
  const isAI = msg.role === "ai";
  return (
    <div
      className={`flex items-start gap-3 ${isAI ? "" : "flex-row-reverse"}`}
      style={{ animation: "messageIn 300ms ease both" }}
    >
      {isAI && <AIAvatar size={28} />}
      <div
        className={`max-w-[75%] px-4 py-3 font-body font-light text-sm leading-relaxed ${
          isAI ? "bg-ground border border-rule text-ink" : "bg-ink text-surface"
        }`}
        style={{ borderRadius: isAI ? "0 10px 10px 10px" : "10px 0 10px 10px" }}
      >
        {msg.content}
      </div>
    </div>
  );
};

const NewConversationDivider = () => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-rule" />
    <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-4 whitespace-nowrap">
      New conversation
    </span>
    <div className="flex-1 h-px bg-rule" />
  </div>
);

const ArticleSidebarCard = ({ article, isExpanded, onToggle }) => (
  <div className="border-b border-rule last:border-0">
    <button
      className="w-full px-4 py-3 hover:bg-ground transition-colors text-left"
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-display text-ink leading-tight" style={{ fontWeight: 200, fontSize: 13 }}>
          {article.title}
        </span>
        {(article.version || 1) > 1 && (
          <span
            className="font-mono text-[8px] tracking-wider uppercase px-1.5 py-0.5 flex-shrink-0"
            style={{ color: "var(--amber)", background: "var(--amber-light)" }}
          >
            v{article.version}
          </span>
        )}
      </div>
      <div className="font-mono text-[9px] text-ink-4 tracking-[0.04em]">
        {article.approved ? "Approved" : "Pending"}
        {" · "}
        {formatDate(article.created_at)}
      </div>
    </button>
    {isExpanded && (
      <div className="px-4 pb-4 bg-surface border-t border-rule">
        <div className="pt-3" style={{ fontSize: 12 }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => (
                <p style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.65, marginBottom: 10 }}>{children}</p>
              ),
              h2: ({ children }) => (
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 200, fontSize: 13, color: "var(--ink)", marginBottom: 6, marginTop: 12 }}>{children}</p>
              ),
              li: ({ children }) => (
                <li style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 4 }}>{children}</li>
              ),
              ul: ({ children }) => <ul style={{ paddingLeft: 14, marginBottom: 10 }}>{children}</ul>,
              strong: ({ children }) => <strong style={{ fontWeight: 500, color: "var(--ink)" }}>{children}</strong>,
            }}
          >
            {article.summary || ""}
          </ReactMarkdown>
        </div>
      </div>
    )}
  </div>
);

// ── Session Guard ─────────────────────────────────────────────────────────────

const SessionGuard = ({ existing, onResume, onCreateNew, loading }) => (
  <div className="min-h-screen bg-surface flex items-center justify-center px-8" style={{ animation: "pageFade 200ms ease" }}>
    <div style={{ maxWidth: 480, width: "100%" }}>
      <div
        className="border px-5 py-4 mb-6"
        style={{ background: "var(--amber-light)", borderColor: "rgba(139,82,0,0.2)" }}
      >
        <p className="font-body font-light text-sm mb-3" style={{ color: "var(--amber)" }}>
          You have an unfinished session on this role:
        </p>
        <p className="font-display text-ink mb-4" style={{ fontWeight: 200, fontSize: 15 }}>
          {existing.title || existing.groups?.name || "Capture session"}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onResume}
            className="bg-ink text-surface font-body font-medium text-xs px-4 py-2 tracking-wider uppercase hover:bg-ink-2 transition-colors"
          >
            Resume existing
          </button>
          <button
            onClick={onCreateNew}
            disabled={loading}
            className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors disabled:opacity-50"
          >
            {loading ? "Starting…" : "Start fresh anyway"}
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const Session = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sessionArticles, setSessionArticles] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [expandedArticleId, setExpandedArticleId] = useState(null);

  const [input, setInput] = useState("");
  const [bannerInput, setBannerInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);
  const [nothingNew, setNothingNew] = useState(location.state?.nothingNew || false);
  const [initializing, setInitializing] = useState(true);
  const [guardSession, setGuardSession] = useState(null);
  const [guardLoading, setGuardLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Auto-dismiss nothing_new banner
  useEffect(() => {
    if (!nothingNew) return;
    const t = setTimeout(() => setNothingNew(false), 5000);
    return () => clearTimeout(t);
  }, [nothingNew]);

  // Load session articles whenever session changes to completed/re-opened
  const loadSessionArticles = (sessionId) => {
    getSessionArticles(sessionId)
      .then(({ data }) => setSessionArticles(data.data.articles || []))
      .catch(() => {});
  };

  // Create or load session
  useEffect(() => {
    if (!id || id === "new") {
      // Check for existing active/re-opened sessions before creating
      listSessions()
        .then(({ data }) => {
          const existing = data.data.sessions.find(
            (s) => s.status === "active" || s.status === "re-opened",
          );
          if (existing) {
            setGuardSession(existing);
            setInitializing(false);
          } else {
            return createSession().then(({ data: d }) => {
              navigate(`/sessions/${d.data.session.id}`, { replace: true });
            });
          }
        })
        .catch(() => {
          setError("Something went wrong — try again.");
          setInitializing(false);
        });
    } else {
      getSession(id)
        .then(({ data }) => {
          setSession(data.data.session);
          setMessages(data.data.messages);
          if (
            data.data.session.status === "completed" ||
            data.data.session.status === "re-opened"
          ) {
            loadSessionArticles(id);
          }
        })
        .catch(() => setError("Something went wrong — try again."))
        .finally(() => setInitializing(false));
    }
  }, [id]);

  const handleCreateNew = () => {
    setGuardLoading(true);
    setGuardSession(null);
    setInitializing(true);
    createSession()
      .then(({ data }) => {
        navigate(`/sessions/${data.data.session.id}`, { replace: true });
      })
      .catch(() => {
        setError("Something went wrong — try again.");
        setGuardLoading(false);
        setInitializing(false);
      });
  };

  const handleSendMessage = async (text) => {
    if (!text?.trim() || isTyping) return;
    setIsTyping(true);
    setError(null);

    const optimistic = { id: `opt-${Date.now()}`, role: "employee", content: text };
    setMessages((prev) => [...prev, optimistic]);

    if (session?.status === "active") {
      const capture = extractCapture(text);
      if (capture) setCaptures((prev) => [{ id: Date.now(), text: capture }, ...prev]);
    }

    try {
      const { data } = await sendMessage(id, text);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        data.data.employeeMessage,
        data.data.aiMessage,
      ]);

      // If backend flipped to re-opened, update session state
      if (data.data.sessionStatus && data.data.sessionStatus !== session?.status) {
        setSession((prev) => ({ ...prev, status: data.data.sessionStatus }));
        loadSessionArticles(id);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError("The AI is taking too long — try again.");
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = () => {
    const text = input.trim();
    setInput("");
    handleSendMessage(text);
  };

  const handleBannerSend = () => {
    const text = bannerInput.trim();
    if (!text) return;
    setBannerInput("");
    handleSendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    setError(null);
    try {
      const { data } = await completeSession(id);
      const result = data.data;

      if (result.type === "nothing_new") {
        // Stay on page, show banner, refetch session
        setNothingNew(true);
        setCompleting(false);
        getSession(id).then(({ data: d }) => {
          setSession(d.data.session);
          setMessages(d.data.messages);
          loadSessionArticles(id);
        });
        return;
      }

      navigate(`/session-complete/${id}`, {
        state: {
          type: result.type,
          articles: result.articles || [],
          new_articles: result.new_articles || [],
          updated_articles: result.updated_articles || [],
          title: result.title,
          generationFailed: result.generationFailed || false,
          generationEmpty: result.type === "generation_empty",
          jobTitle: user?.job_title,
          sessionId: id,
        },
      });
    } catch {
      setError("Something went wrong — try again.");
      setCompleting(false);
    }
  };

  const employeeMessageCount = messages.filter((m) => m.role === "employee").length;
  const shortId = id ? id.slice(-8).toUpperCase() : "";
  const jobTitle = user?.job_title || "";
  const status = session?.status || "active";

  // ── Guard screen ─────────────────────────────────────────────────────────
  if (!initializing && guardSession) {
    return (
      <SessionGuard
        existing={guardSession}
        onResume={() => navigate(`/sessions/${guardSession.id}`)}
        onCreateNew={handleCreateNew}
        loading={guardLoading}
      />
    );
  }

  // ── Initializing ─────────────────────────────────────────────────────────
  if (initializing) {
    return (
      <div className="h-screen bg-surface flex flex-col" style={{ animation: "pageFade 200ms ease" }}>
        <div className="bg-white border-b border-rule px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <div className="h-3 bg-ground w-16" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
          <div className="w-px h-4 bg-rule" />
          <div className="h-3 bg-ground w-36" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col flex-1 px-8 py-6 gap-5" style={{ flexBasis: "65%" }}>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-ground flex-shrink-0" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
              <div className="flex flex-col gap-2">
                <div className="h-3 bg-ground w-64" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
                <div className="h-3 bg-ground w-48" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
              </div>
            </div>
          </div>
          <div className="border-l border-rule bg-white flex-shrink-0" style={{ flexBasis: "35%" }} />
        </div>
      </div>
    );
  }

  // ── Fatal error ──────────────────────────────────────────────────────────
  if (error && !session) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="font-body font-light text-sm text-ink-2 mb-4">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
          >
            ← Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-surface flex flex-col" style={{ animation: "pageFade 200ms ease" }}>

      {/* Nothing new banner */}
      {nothingNew && (
        <div
          className="flex items-center gap-3 px-6 py-3 flex-shrink-0"
          style={{ background: "var(--forest-light)", borderBottom: "1px solid rgba(26,107,69,0.2)" }}
        >
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--forest)" }} />
          <p className="font-body font-light text-sm" style={{ color: "var(--forest)" }}>
            Nothing new to capture — your articles are already up to date.
          </p>
        </div>
      )}

      {/* Top bar */}
      <div className="bg-white border-b border-rule px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <button
          onClick={() => navigate("/sessions")}
          className="font-body font-light text-xs text-ink-3 hover:text-ink transition-colors"
        >
          ← Sessions
        </button>
        <div className="w-px h-4 bg-rule" />
        <span
          className="font-display text-ink truncate"
          style={{ fontWeight: 200, fontSize: 13, maxWidth: 240 }}
        >
          {session?.title || jobTitle || "Session"}
        </span>
        {jobTitle && session?.title && (
          <>
            <div className="w-px h-4 bg-rule" />
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-3">
              {jobTitle}
            </span>
          </>
        )}
        <div className="flex-1" />
        <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-4">
          {shortId}
        </span>
        {status !== "completed" && (
          <>
            <div className="w-px h-4 bg-rule" />
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-4">
              {employeeMessageCount} exchange{employeeMessageCount !== 1 ? "s" : ""}
            </span>
          </>
        )}
        {(status === "active" || status === "re-opened") && employeeMessageCount >= 8 && (
          <button
            onClick={handleComplete}
            disabled={completing || isTyping}
            className="bg-ink text-surface font-body font-medium text-xs px-4 py-1.5 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-50"
          >
            {completing ? "Generating…" : "End session"}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* Chat area — 65% */}
        <div className="flex flex-col flex-1 min-w-0" style={{ flexBasis: "65%" }}>
          <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-5">
            {messages.map((msg) => (
              <>
                <Message key={msg.id} msg={msg} />
                {status === "re-opened" &&
                  session?.last_completion_message_id === msg.id && (
                    <NewConversationDivider key={`divider-${msg.id}`} />
                  )}
              </>
            ))}
            {isTyping && <TypingIndicator />}
            {error && session && (
              <p className="font-body text-xs text-center" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar (active / re-opened) */}
          {status !== "completed" && (
            <div className="border-t border-rule bg-white px-6 py-4 flex items-center gap-3 flex-shrink-0">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={completing ? "Generating your articles…" : "Type your reply…"}
                rows={1}
                disabled={completing}
                className="flex-1 border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors placeholder:text-ink-4 resize-none disabled:opacity-50"
                style={{ minHeight: 44 }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping || completing}
                className="bg-ink text-surface font-body font-medium text-xs px-5 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-40 flex-shrink-0"
              >
                Send
              </button>
            </div>
          )}

          {/* Completed banner */}
          {status === "completed" && (
            <div className="border-t border-rule bg-white px-6 py-4 flex items-center gap-4 flex-shrink-0">
              <div className="flex-shrink-0">
                <p className="font-body font-light text-sm text-ink-2">
                  This session is complete.
                  {sessionArticles.length > 0 && (
                    <> {sessionArticles.length} article{sessionArticles.length !== 1 ? "s" : ""} captured.</>
                  )}
                </p>
                <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-4 mt-1">
                  Continue the conversation to add or update knowledge
                </p>
              </div>
              <div className="w-px h-8 bg-rule flex-shrink-0" />
              <input
                className="flex-1 border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors placeholder:text-ink-4"
                placeholder="Add more to this conversation…"
                value={bannerInput}
                onChange={(e) => setBannerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && bannerInput.trim()) {
                    e.preventDefault();
                    handleBannerSend();
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Right sidebar — 35% */}
        <div
          className="border-l border-rule bg-white flex flex-col flex-shrink-0 overflow-hidden"
          style={{ flexBasis: "35%" }}
        >
          {/* Sidebar header */}
          <div className="px-4 pt-5 pb-3 border-b border-rule flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
                {status === "active" ? "Capturing now" : "Captured knowledge"}
              </span>
              <div className="flex-1 h-px bg-rule" />
            </div>
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto">
            {/* Active: keyword captures */}
            {status === "active" && (
              <div className="px-4 py-4 flex flex-col gap-3">
                {captures.length === 0 ? (
                  <p className="font-body font-light text-xs text-ink-4 mt-2">
                    Key insights will appear here as you share them.
                  </p>
                ) : (
                  captures.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-2.5"
                      style={{ animation: "captureIn 400ms ease both" }}
                    >
                      <div
                        className="mt-1 flex-shrink-0 bg-volt"
                        style={{ width: 6, height: 6, clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
                      />
                      <p className="font-body font-light text-xs text-ink-2 leading-relaxed">
                        {c.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Completed / Re-opened: article cards */}
            {(status === "completed" || status === "re-opened") && (
              <>
                {sessionArticles.length === 0 ? (
                  <div className="px-4 py-4">
                    <p className="font-body font-light text-xs text-ink-4">
                      No articles yet.
                    </p>
                  </div>
                ) : (
                  sessionArticles.map((article) => (
                    <ArticleSidebarCard
                      key={article.id}
                      article={article}
                      isExpanded={expandedArticleId === article.id}
                      onToggle={() =>
                        setExpandedArticleId((prev) =>
                          prev === article.id ? null : article.id,
                        )
                      }
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Session;
