import { useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { retryArticleGeneration } from "../lib/api.js";

const CheckIcon = ({ size = 24, color = "var(--forest)" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SessionComplete = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const roleId = location.state?.roleId;
  const roleName = location.state?.roleName;

  const [articles, setArticles] = useState(location.state?.articles || []);
  const [failed, setFailed] = useState(location.state?.generationFailed || false);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const { data } = await retryArticleGeneration(id);
      setArticles(data.data.articles);
      setFailed(false);
    } catch {
      // still failed — leave failed=true so the error state stays visible
    } finally {
      setRetrying(false);
    }
  };

  const handleReview = () => {
    navigate(`/session-complete/${id}/review`, {
      state: { articles, roleId, roleName, sessionId: id },
    });
  };

  // ── Error state ────────────────────────────────────────────────────────────
  if (failed) {
    return (
      <div
        className="min-h-screen bg-white flex items-center justify-center px-8"
        style={{ animation: "pageFade 200ms ease" }}
      >
        <div style={{ maxWidth: 560, width: "100%" }}>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-8"
            style={{ background: "var(--danger-light)" }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--danger)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>

          <h1
            className="font-display italic text-ink leading-tight mb-3"
            style={{ fontSize: 40, fontWeight: 100 }}
          >
            Session saved.
          </h1>

          <p className="font-body font-light text-sm text-ink-3 mb-8">
            Something went wrong generating your articles — try again.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="bg-ink text-surface font-body font-medium text-xs px-8 py-3 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-50"
            >
              {retrying ? "Generating articles…" : "Try again"}
            </button>
            <button
              onClick={() => navigate("/sessions")}
              className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors"
            >
              Back to sessions
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-white flex items-center justify-center px-8"
      style={{ animation: "pageFade 200ms ease" }}
    >
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div className="w-16 h-16 rounded-full bg-forest-light flex items-center justify-center mb-8">
          <CheckIcon size={28} />
        </div>

        <h1
          className="font-display italic text-ink leading-tight mb-3"
          style={{ fontSize: 48, fontWeight: 100 }}
        >
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
              <div
                key={i}
                className="flex items-center gap-4"
                style={{
                  animation: "articleReveal 300ms ease both",
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <span className="font-mono text-[9px] tracking-wider text-ink-4 w-6 text-right flex-shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-body font-medium text-sm text-ink flex-1">
                  {article.title}
                </span>
                <CheckIcon size={14} />
              </div>
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
