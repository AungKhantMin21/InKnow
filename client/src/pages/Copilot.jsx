import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AIAvatar from "../components/ui/AIAvatar.jsx";
import Sidebar from "../components/ui/Sidebar.jsx";
import { queryCopilot, submitFeedback } from "../lib/api.js";

const SourceTag = ({ title, name }) => (
  <span
    className="inline-flex items-center font-mono text-[9px] tracking-wider px-2 py-1 mr-2 mb-1"
    style={{ color: "var(--forest)", background: "var(--forest-light)" }}
  >
    {title} · {name}
  </span>
);

const ConfidenceBar = ({ confidence }) => {
  const pct = Math.round(confidence * 100);
  return (
    <div className="flex items-center gap-3 mt-4">
      <div className="flex-1 bg-rule" style={{ height: 1.5 }}>
        <div
          className="bg-ink h-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[9px] tracking-wider text-ink-4 flex-shrink-0">
        {pct}% confidence
      </span>
    </div>
  );
};

const FeedbackRow = ({ queryId, currentFeedback, onFeedback }) => {
  if (!queryId) return null;
  return (
    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-rule">
      <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-4">
        Was this helpful?
      </span>
      <button
        onClick={() => onFeedback(queryId, 1)}
        className={`font-body font-medium text-xs transition-colors ${
          currentFeedback === 1
            ? "text-forest"
            : "text-ink-3 hover:text-ink"
        }`}
      >
        Helpful
      </button>
      <button
        onClick={() => onFeedback(queryId, -1)}
        className={`font-body font-medium text-xs transition-colors ${
          currentFeedback === -1
            ? "text-danger"
            : "text-ink-3 hover:text-ink"
        }`}
        style={currentFeedback === -1 ? { color: "var(--danger)" } : {}}
      >
        Not quite right
      </button>
    </div>
  );
};

const AnswerCard = ({ item, onFeedback }) => {
  const date = (iso) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div
      className="bg-white border border-rule p-6 mb-5"
      style={{ animation: "pageFade 300ms ease" }}
    >
      {/* Question */}
      <span className="font-mono text-[8px] tracking-[0.22em] uppercase text-ink-4 block mb-2">
        Your question
      </span>
      <h2
        className="font-display text-ink mb-5"
        style={{ fontWeight: 200, fontSize: 20, letterSpacing: "-0.01em", lineHeight: 1.3 }}
      >
        {item.question}
      </h2>

      {item.answer ? (
        <>
          {/* Answer */}
          <p
            className="font-body font-light text-ink-2"
            style={{ fontSize: 14, lineHeight: 1.75, whiteSpace: "pre-wrap" }}
          >
            {item.answer}
          </p>

          {/* Sources */}
          {item.sources.length > 0 && (
            <div className="mt-4">
              {item.sources.map((s, i) => (
                <SourceTag
                  key={i}
                  title={s.title}
                  name={s.captured_by_name}
                />
              ))}
            </div>
          )}

          {/* Confidence */}
          <ConfidenceBar confidence={item.confidence} />

          {/* Feedback */}
          <FeedbackRow
            queryId={item.queryId}
            currentFeedback={item.feedback}
            onFeedback={onFeedback}
          />
        </>
      ) : (
        /* Gap state */
        <GapState question={item.question} />
      )}
    </div>
  );
};

const GapState = ({ question }) => {
  const navigate = useNavigate();
  return (
    <div>
      <p className="font-body font-light text-sm text-ink-3 mb-4" style={{ lineHeight: 1.7 }}>
        Nobody's captured this yet.
      </p>
      <button
        onClick={() => navigate("/sessions/new")}
        className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
      >
        Start a capture session on this topic →
      </button>
    </div>
  );
};

const ThinkingIndicator = ({ question }) => (
  <div
    className="bg-white border border-rule p-6 mb-5"
    style={{ animation: "pageFade 200ms ease" }}
  >
    <span className="font-mono text-[8px] tracking-[0.22em] uppercase text-ink-4 block mb-2">
      Your question
    </span>
    <h2
      className="font-display text-ink mb-5"
      style={{ fontWeight: 200, fontSize: 20, letterSpacing: "-0.01em", lineHeight: 1.3 }}
    >
      {question}
    </h2>
    <div className="flex items-center gap-3">
      <AIAvatar size={20} />
      <span className="font-body font-light text-sm text-ink-3">Thinking…</span>
    </div>
  </div>
);

const Copilot = () => {
  const [items, setItems] = useState([]);
  const [thinking, setThinking] = useState(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, thinking]);

  const handleAsk = async () => {
    const q = input.trim();
    if (!q || thinking) return;

    setInput("");
    setError(null);
    setThinking(q);

    try {
      const { data } = await queryCopilot(q);
      const { answer, sources, confidence, query_id } = data.data;

      setItems((prev) => [
        ...prev,
        {
          id: Date.now(),
          question: q,
          answer,
          sources: sources || [],
          confidence: confidence || 0,
          queryId: query_id,
          feedback: null,
        },
      ]);
    } catch {
      setError("The AI is taking too long — try again.");
    } finally {
      setThinking(null);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleFeedback = async (queryId, feedback) => {
    setItems((prev) =>
      prev.map((item) =>
        item.queryId === queryId ? { ...item, feedback } : item
      )
    );
    try {
      await submitFeedback(queryId, feedback);
    } catch {
      // non-fatal — feedback recorded locally at minimum
    }
  };

  return (
    <div className="h-screen bg-surface flex" style={{ animation: "pageFade 200ms ease" }}>
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Q&A scroll area */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div style={{ maxWidth: 660, margin: "0 auto" }}>

            {/* Empty state header */}
            {items.length === 0 && !thinking && (
              <div className="mb-10 mt-8">
                <div className="flex items-center gap-3 mb-3">
                  <AIAvatar size={28} />
                  <h1
                    className="font-display text-ink"
                    style={{ fontWeight: 200, fontSize: 28, letterSpacing: "-0.02em" }}
                  >
                    Inno
                  </h1>
                </div>
                <p className="font-body font-light text-sm text-ink-3" style={{ paddingLeft: 40 }}>
                  Ask anything about your company's knowledge base.
                </p>
              </div>
            )}

            {items.map((item) => (
              <AnswerCard key={item.id} item={item} onFeedback={handleFeedback} />
            ))}

            {thinking && <ThinkingIndicator question={thinking} />}

            {error && (
              <p
                className="font-body text-xs text-center mb-4"
                style={{ color: "var(--danger)" }}
              >
                {error}
              </p>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-rule bg-white px-8 py-5 flex-shrink-0">
          <div style={{ maxWidth: 660, margin: "0 auto" }}>
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!!thinking}
                placeholder="Ask anything about company knowledge…"
                className="flex-1 border border-rule bg-surface text-ink px-4 py-3 outline-none focus:border-rule-hi transition-colors placeholder:text-ink-4 disabled:opacity-50"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 200,
                  fontSize: 15,
                  fontStyle: input ? "normal" : "italic",
                  letterSpacing: "-0.01em",
                }}
              />
              <button
                onClick={handleAsk}
                disabled={!input.trim() || !!thinking}
                className="bg-ink text-surface font-body font-medium text-xs px-6 py-3 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-40 flex-shrink-0"
              >
                Ask
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Copilot;
