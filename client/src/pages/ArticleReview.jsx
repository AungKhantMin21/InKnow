import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { saveArticle } from "../lib/api.js";

const ArticleReview = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { articles: initial = [], roleId, sessionId } = location.state || {};

  const [articles, setArticles] = useState(initial.map((a) => ({ ...a })));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!articles.length) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="font-body font-light text-sm text-ink-2 mb-4">
            No articles to review.
          </p>
          <button
            onClick={() => navigate("/sessions")}
            className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
          >
            ← Back to sessions
          </button>
        </div>
      </div>
    );
  }

  const current = articles[currentIndex];
  const total = articles.length;
  const isLast = currentIndex === total - 1;

  const updateField = (field, value) => {
    setArticles((prev) =>
      prev.map((a, i) => (i === currentIndex ? { ...a, [field]: value } : a))
    );
  };

  const advance = () => {
    if (!isLast) {
      setCurrentIndex((i) => i + 1);
      setError(null);
    } else {
      navigate("/sessions");
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveArticle({
        role_id: roleId,
        session_id: sessionId,
        title: current.title,
        summary: current.summary,
        content: current.content,
        tags: current.tags,
      });
      advance();
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setSaving(false);
    }
  };

  const progressPct = Math.round((currentIndex / total) * 100);

  return (
    <div className="min-h-screen bg-surface flex flex-col" style={{ animation: "pageFade 200ms ease" }}>
      {/* Top bar */}
      <div className="bg-white border-b border-rule px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <button
          onClick={() => navigate("/sessions")}
          className="font-body font-light text-xs text-ink-3 hover:text-ink transition-colors"
        >
          ← Sessions
        </button>
        <div className="w-px h-4 bg-rule" />
        <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-3">
          Review articles
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[9px] tracking-wider text-ink-4">
          {currentIndex + 1} of {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-px bg-rule">
        <div
          className="h-full bg-ink transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Content */}
      <main className="flex-1 flex justify-center px-8 py-10">
        <div style={{ maxWidth: 680, width: "100%" }}>
          {/* Section label */}
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
              Article {currentIndex + 1}
            </span>
            <div className="flex-1 h-px bg-rule" />
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="font-mono text-[9px] tracking-wider uppercase text-ink-4 block mb-2">
              Title
            </label>
            <input
              className="w-full border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors"
              value={current.title}
              onChange={(e) => updateField("title", e.target.value)}
            />
          </div>

          {/* Summary */}
          {current.summary !== undefined && (
            <div className="mb-4">
              <label className="font-mono text-[9px] tracking-wider uppercase text-ink-4 block mb-2">
                Summary
              </label>
              <input
                className="w-full border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors"
                value={current.summary || ""}
                onChange={(e) => updateField("summary", e.target.value)}
              />
            </div>
          )}

          {/* Content */}
          <div className="mb-6">
            <label className="font-mono text-[9px] tracking-wider uppercase text-ink-4 block mb-2">
              Content
            </label>
            <textarea
              className="w-full border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-3 outline-none focus:border-rule-hi transition-colors resize-none"
              style={{ minHeight: 320 }}
              value={current.content}
              onChange={(e) => updateField("content", e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="font-body text-xs mb-4" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleApprove}
              disabled={saving || !current.title?.trim()}
              className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-40"
            >
              {saving ? "Saving…" : "Approve & save"}
            </button>
            <button
              onClick={advance}
              disabled={saving}
              className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors disabled:opacity-40"
            >
              {isLast ? "Skip & finish" : "Skip"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ArticleReview;
