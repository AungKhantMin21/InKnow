import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import AIAvatar from "../components/ui/AIAvatar.jsx";
import { createSession, getSession, sendMessage, completeSession } from "../lib/api.js";

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

const TypingIndicator = () => (
  <div className="flex items-start gap-3">
    <AIAvatar size={28} />
    <div className="bg-ground border border-rule px-4 py-3 flex items-center gap-1.5"
      style={{ borderRadius: "0 10px 10px 10px" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block w-1.5 h-1.5 rounded-full bg-ink-3"
          style={{ animation: `typingDot 1.2s ease infinite`, animationDelay: `${i * 0.2}s` }}
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
          isAI
            ? "bg-ground border border-rule text-ink"
            : "bg-ink text-surface"
        }`}
        style={{
          borderRadius: isAI ? "0 10px 10px 10px" : "10px 0 10px 10px",
        }}
      >
        {msg.content}
      </div>
    </div>
  );
};

const Session = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Create or load session
  useEffect(() => {
    if (!id || id === "new") {
      createSession()
        .then(({ data }) => {
          navigate(`/sessions/${data.data.session.id}`, { replace: true });
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
        })
        .catch(() => setError("Something went wrong — try again."))
        .finally(() => setInitializing(false));
    }
  }, [id]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    setInput("");
    setIsTyping(true);
    setError(null);

    // Optimistic employee message
    const optimistic = { id: `opt-${Date.now()}`, role: "employee", content: text };
    setMessages((prev) => [...prev, optimistic]);

    // Check for capture
    const capture = extractCapture(text);
    if (capture) {
      setCaptures((prev) => [{ id: Date.now(), text: capture }, ...prev]);
    }

    try {
      const { data } = await sendMessage(id, text);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        data.data.employeeMessage,
        data.data.aiMessage,
      ]);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError("The AI is taking too long — try again.");
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleComplete = async () => {
    try {
      const { data } = await completeSession(id);
      navigate(`/session-complete/${id}`, {
        state: {
          articles: data.data.articles,
          roleId: session?.role_id,
        },
      });
    } catch {
      setError("Something went wrong — try again.");
    }
  };

  const employeeMessageCount = messages.filter((m) => m.role === "employee").length;
  const shortId = id ? id.slice(-8).toUpperCase() : "";
  const roleName = user?.roles?.name || "";

  if (initializing) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="font-body font-light text-sm text-ink-3">Starting session…</p>
      </div>
    );
  }

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
      {/* Top bar */}
      <div className="bg-white border-b border-rule px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <button
          onClick={() => navigate("/dashboard")}
          className="font-body font-light text-xs text-ink-3 hover:text-ink transition-colors"
        >
          ← Dashboard
        </button>
        <div className="w-px h-4 bg-rule" />
        {roleName && (
          <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-3">
            {roleName}
          </span>
        )}
        <div className="w-px h-4 bg-rule" />
        <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-4">
          {shortId}
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-4">
          {employeeMessageCount} exchange{employeeMessageCount !== 1 ? "s" : ""}
        </span>
        {employeeMessageCount >= 8 && (
          <button
            onClick={handleComplete}
            className="bg-ink text-surface font-body font-medium text-xs px-4 py-1.5 tracking-wider uppercase hover:bg-ink-2 transition-colors"
          >
            End session
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Chat area — 65% */}
        <div className="flex flex-col flex-1 min-w-0" style={{ flexBasis: "65%" }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-5">
            {messages.map((msg) => (
              <Message key={msg.id} msg={msg} />
            ))}
            {isTyping && <TypingIndicator />}
            {error && session && (
              <p className="font-body text-xs text-center" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-rule bg-white px-6 py-4 flex items-center gap-3 flex-shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your reply…"
              rows={1}
              className="flex-1 border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors placeholder:text-ink-4 resize-none"
              style={{ minHeight: 44 }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-ink text-surface font-body font-medium text-xs px-5 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-40 flex-shrink-0"
            >
              Send
            </button>
          </div>
        </div>

        {/* Capture sidebar — 35% */}
        <div
          className="border-l border-rule bg-white flex flex-col flex-shrink-0 overflow-hidden"
          style={{ flexBasis: "35%" }}
        >
          <div className="px-6 pt-5 pb-3 border-b border-rule">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
                Capturing now
              </span>
              <div className="flex-1 h-px bg-rule" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
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
                    style={{
                      width: 6,
                      height: 6,
                      clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                    }}
                  />
                  <p className="font-body font-light text-xs text-ink-2 leading-relaxed">
                    {c.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Session;
