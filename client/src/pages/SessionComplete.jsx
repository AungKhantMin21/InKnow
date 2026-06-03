import { useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { retryArticleGeneration } from "../lib/api.js";

const CheckIcon = ({ size = 24, color = "var(--forest)" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ArticleRow = ({ article, index }) => (
  <div
    className="flex items-center gap-4"
    style={{ animation: "articleReveal 300ms ease both", animationDelay: `${index * 40}ms` }}
  >
    <span className="font-mono text-[9px] tracking-wider text-ink-4 w-6 text-right flex-shrink-0">
      {String(index + 1).padStart(2, "0")}
    </span>
    <span className="font-body font-medium text-sm text-ink flex-1">{article.title}</span>
    <CheckIcon size={14} />
  </div>
);

const UpdateRow = ({ article, index }) => (
  <div
    className="flex items-start gap-4"
    style={{ animation: "articleReveal 300ms ease both", animationDelay: `${index * 40}ms` }}
  >
    <span className="font-mono text-[9px] tracking-wider text-ink-4 w-6 text-right flex-shrink-0 mt-0.5">
      {String(index + 1).padStart(2, "0")}
    </span>
    <div className="flex-1">
      <span className="font-body font-medium text-sm text-ink block">{article.title}</span>
      {article.update_reason && (
        <span className="font-mono text-[9px] tracking-wider text-ink-3 italic block mt-0.5">
          {article.update_reason}
        </span>
      )}
    </div>
    <span
      className="font-mono text-[8px] tracking-wider uppercase px-2 py-0.5 flex-shrink-0 mt-0.5"
      style={{ color: "var(--amber)", background: "var(--amber-light)" }}
    >
      Update
    </span>
  </div>
);

const SessionComplete = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    type,
    articles: initialArticles = [],
    new_articles: initialNewArticles = [],
    updated_articles: initialUpdatedArticles = [],
    title,
    roleId,
    roleName,
    generationFailed,
    generationEmpty,
  } = location.state || {};

  const sessionId = location.state?.sessionId || id;

  const [articles, setArticles] = useState(initialArticles);
  const [newArticles] = useState(initialNewArticles);
  const [updatedArticles] = useState(initialUpdatedArticles);
  const [failed, setFailed] = useState(generationFailed || false);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const { data } = await retryArticleGeneration(id);
      setArticles(data.data.articles);
      setFailed(false);
    } catch {
      // leave failed=true
    } finally {
      setRetrying(false);
    }
  };

  const handleReview = () => {
    navigate(`/session-complete/${id}/review`, {
      state: {
        type,
        articles,
        new_articles: newArticles,
        updated_articles: updatedArticles,
        roleId,
        roleName,
        sessionId,
      },
    });
  };

  // ── Generation failed ────────────────────────────────────────────────────
  if (failed || generationEmpty) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-8" style={{ animation: "pageFade 200ms ease" }}>
        <div style={{ maxWidth: 560, width: "100%" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-8" style={{ background: "var(--danger-light)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <h1 className="font-display italic text-ink leading-tight mb-3" style={{ fontSize: 40, fontWeight: 100 }}>
            Session saved.
          </h1>
          <p className="font-body font-light text-sm text-ink-3 mb-8">
            {generationEmpty
              ? "No articles could be generated. Continue the conversation and try again."
              : "Something went wrong generating your articles — try again."}
          </p>
          <div className="flex items-center gap-3">
            {!generationEmpty && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="bg-ink text-surface font-body font-medium text-xs px-8 py-3 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-50"
              >
                {retrying ? "Generating articles…" : "Try again"}
              </button>
            )}
            <button
              onClick={() => navigate(`/sessions/${id}`)}
              className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors"
            >
              Back to session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Re-opened completion ─────────────────────────────────────────────────
  if (type === "re_opened_completion") {
    const hasNew = newArticles.length > 0;
    const hasUpdates = updatedArticles.length > 0;

    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-8" style={{ animation: "pageFade 200ms ease" }}>
        <div style={{ maxWidth: 560, width: "100%" }}>
          <div className="w-16 h-16 rounded-full bg-forest-light flex items-center justify-center mb-8">
            <CheckIcon size={28} />
          </div>
          <h1 className="font-display italic text-ink leading-tight mb-3" style={{ fontSize: 48, fontWeight: 100 }}>
            Knowledge{" "}
            <span className="text-volt">updated</span>.
          </h1>
          <p className="font-body font-light text-sm text-ink-3 mb-10">
            {hasNew && hasUpdates
              ? `${newArticles.length} new article${newArticles.length !== 1 ? "s" : ""} and ${updatedArticles.length} update${updatedArticles.length !== 1 ? "s" : ""} ready for review.`
              : hasNew
              ? `${newArticles.length} new article${newArticles.length !== 1 ? "s" : ""} ready for review.`
              : `${updatedArticles.length} article${updatedArticles.length !== 1 ? "s" : ""} to update ready for review.`}
          </p>

          <div className="flex flex-col gap-6 mb-10">
            {hasNew && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">New articles</span>
                  <div className="flex-1 h-px bg-rule" />
                </div>
                <div className="flex flex-col gap-3">
                  {newArticles.map((a, i) => <ArticleRow key={i} article={a} index={i} />)}
                </div>
              </div>
            )}

            {hasUpdates && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">Articles to update</span>
                  <div className="flex-1 h-px bg-rule" />
                </div>
                <div className="flex flex-col gap-3">
                  {updatedArticles.map((a, i) => <UpdateRow key={i} article={a} index={i} />)}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleReview}
            className="bg-ink text-surface font-body font-medium text-xs px-8 py-3 tracking-wider uppercase hover:bg-ink-2 transition-colors"
          >
            Review updates →
          </button>
        </div>
      </div>
    );
  }

  // ── First completion (default) ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-8" style={{ animation: "pageFade 200ms ease" }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div className="w-16 h-16 rounded-full bg-forest-light flex items-center justify-center mb-8">
          <CheckIcon size={28} />
        </div>
        <h1 className="font-display italic text-ink leading-tight mb-3" style={{ fontSize: 48, fontWeight: 100 }}>
          Knowledge{" "}
          <span className="text-volt">preserved</span>.
        </h1>
        <p className="font-body font-light text-sm text-ink-3 mb-10">
          {articles.length > 0
            ? `${articles.length} article${articles.length !== 1 ? "s" : ""} captured and ready for review.`
            : "Your session has been saved."}
        </p>

        {articles.length > 0 && (
          <div className="flex flex-col gap-3 mb-10">
            {articles.map((article, i) => (
              <ArticleRow key={i} article={article} index={i} />
            ))}
          </div>
        )}

        {articles.length > 0 ? (
          <button
            onClick={handleReview}
            className="bg-ink text-surface font-body font-medium text-xs px-8 py-3 tracking-wider uppercase hover:bg-ink-2 transition-colors"
          >
            Review your articles →
          </button>
        ) : (
          <button
            onClick={() => navigate("/sessions")}
            className="bg-ink text-surface font-body font-medium text-xs px-8 py-3 tracking-wider uppercase hover:bg-ink-2 transition-colors"
          >
            Back to sessions →
          </button>
        )}
      </div>
    </div>
  );
};

export default SessionComplete;
