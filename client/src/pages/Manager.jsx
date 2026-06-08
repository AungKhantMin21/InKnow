import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import Sidebar from "../components/ui/Sidebar.jsx";
import {
  getManagerStats,
  getManagerCoverage,
  getPendingArticles,
  approveArticle,
  rejectArticle,
} from "../lib/api.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const freshnessStyle = (dateStr) => {
  if (!dateStr) return { label: "No captures", color: "var(--ink-4)", bg: "var(--ground)" };
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days < 90)  return { label: "Current",         color: "var(--forest)", bg: "var(--forest-light)" };
  if (days < 270) return { label: "Verify soon",     color: "var(--amber)",  bg: "var(--amber-light)"  };
  return              { label: "May be outdated", color: "var(--danger)", bg: "var(--danger-light)" };
};

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Never";

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ value, label }) => (
  <div className="bg-white border border-rule px-6 py-5">
    <div
      className="font-display text-ink"
      style={{ fontWeight: 200, fontSize: 38, letterSpacing: "-0.02em", lineHeight: 1 }}
    >
      {value}
    </div>
    <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-4 mt-2">
      {label}
    </div>
  </div>
);

const StatSkeleton = () => (
  <div className="bg-white border border-rule px-6 py-5">
    <div className="bg-ground h-9 w-14 mb-2" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
    <div className="bg-ground h-2.5 w-28" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
  </div>
);

const CoverageCard = ({ role, maxArticles }) => {
  const { label, color, bg } = freshnessStyle(role.last_capture);
  const fillPct = maxArticles > 0 ? Math.round((role.article_count / maxArticles) * 100) : 0;

  const handleInvite = () => {
    navigator.clipboard.writeText(`${window.location.origin}/sessions/new`);
  };

  return (
    <div className="bg-white border border-rule p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3
          className="font-display text-ink leading-tight"
          style={{ fontWeight: 200, fontSize: 15 }}
        >
          {role.name}
        </h3>
        <span
          className="font-mono text-[8px] tracking-[0.12em] uppercase flex-shrink-0 px-2 py-0.5"
          style={{ color, background: bg }}
        >
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mb-2">
        <span
          className="font-display text-ink"
          style={{ fontWeight: 200, fontSize: 28, letterSpacing: "-0.02em", lineHeight: 1 }}
        >
          {role.article_count}
        </span>
        <span className="font-mono text-[9px] tracking-wider text-ink-4">
          {role.article_count === 1 ? "article" : "articles"}
        </span>
      </div>

      {/* Coverage bar */}
      <div className="bg-rule mb-4" style={{ height: 2 }}>
        <div
          className="bg-ink h-full transition-all duration-700"
          style={{ width: `${fillPct}%`, maxWidth: "100%" }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] tracking-wider text-ink-4">
          {formatDate(role.last_capture)}
        </span>
        <button
          onClick={handleInvite}
          className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3 hover:text-ink transition-colors"
        >
          Copy invite link
        </button>
      </div>
    </div>
  );
};

const CoverageSkeleton = () => (
  <div className="bg-white border border-rule p-5">
    <div className="bg-ground h-4 w-36 mb-4" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
    <div className="bg-ground h-7 w-8 mb-2" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
    <div className="bg-ground w-full mb-4" style={{ height: 2, animation: "skeletonPulse 1.5s ease infinite" }} />
    <div className="bg-ground h-2.5 w-24" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
  </div>
);

const PendingRow = ({ article, onView, onApprove, onReject, approving, rejecting }) => (
  <div className="flex items-center gap-4 py-4 border-b border-rule last:border-0">
    <div className="flex-1 min-w-0">
      <button
        onClick={onView}
        className="font-body font-light text-sm text-ink hover:text-volt transition-colors truncate block text-left w-full"
      >
        {article.title}
      </button>
      <p className="font-mono text-[9px] tracking-wider text-ink-4 mt-1">
        {article.capturer?.name ?? "Unknown"}
        {article.roles?.name ? ` · ${article.roles.name}` : ""}
        {" · "}{formatDate(article.created_at)}
      </p>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={onApprove}
        disabled={approving || rejecting}
        className="font-body font-medium text-xs px-4 py-2 transition-opacity disabled:opacity-40"
        style={{ background: "var(--forest)", color: "var(--white)" }}
      >
        {approving ? "Approving…" : "Approve"}
      </button>
      <button
        onClick={onReject}
        disabled={approving || rejecting}
        className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors disabled:opacity-40"
      >
        {rejecting ? "Removing…" : "Reject"}
      </button>
    </div>
  </div>
);

const PendingSkeleton = () => (
  <div className="flex items-center justify-between py-4 border-b border-rule last:border-0">
    <div>
      <div className="bg-ground h-4 w-60 mb-2" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
      <div className="bg-ground h-2.5 w-40" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
    </div>
    <div className="flex gap-2">
      <div className="bg-ground h-8 w-20" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
      <div className="bg-ground h-8 w-16" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
    </div>
  </div>
);

const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-3 mb-5">
    <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
      {children}
    </span>
    <div className="flex-1 h-px bg-rule" />
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const Manager = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats]     = useState(null);
  const [coverage, setCoverage] = useState([]);
  const [pending, setPending]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [actioning, setActioning] = useState({});

  useEffect(() => {
    if (user && !user.is_manager) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (user) load();
  }, [user]); // eslint-disable-line

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, coverageRes, pendingRes] = await Promise.all([
        getManagerStats(),
        getManagerCoverage(),
        getPendingArticles(),
      ]);
      setStats(statsRes.data.data);
      setCoverage(coverageRes.data.data.coverage);
      setPending(pendingRes.data.data.articles);
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    setActioning((prev) => ({ ...prev, [id]: "approving" }));
    try {
      await approveArticle(id);
      setPending((prev) => prev.filter((a) => a.id !== id));
      setStats((prev) =>
        prev
          ? { ...prev, pending_approvals: prev.pending_approvals - 1, total_articles: prev.total_articles + 1 }
          : prev,
      );
    } catch {
      load();
    } finally {
      setActioning((prev) => ({ ...prev, [id]: undefined }));
    }
  };

  const handleReject = async (id) => {
    setActioning((prev) => ({ ...prev, [id]: "rejecting" }));
    try {
      await rejectArticle(id);
      setPending((prev) => prev.filter((a) => a.id !== id));
      setStats((prev) =>
        prev ? { ...prev, pending_approvals: prev.pending_approvals - 1 } : prev,
      );
    } catch {
      load();
    } finally {
      setActioning((prev) => ({ ...prev, [id]: undefined }));
    }
  };

  const maxArticles = Math.max(...coverage.map((r) => r.article_count), 1);

  return (
    <div className="h-screen bg-surface flex" style={{ animation: "pageFade 200ms ease" }}>
      <Sidebar />

      <div className="flex-1 overflow-y-auto">
        <div className="px-10 py-10" style={{ maxWidth: 960, margin: "0 auto" }}>

          {/* Header */}
          <div className="mb-10">
            <h1
              className="font-display text-ink"
              style={{ fontWeight: 200, fontSize: 28, letterSpacing: "-0.02em" }}
            >
              Manager
            </h1>
            <p className="font-body font-light text-sm text-ink-3 mt-1">
              Knowledge coverage and pending approvals for your team.
            </p>
          </div>

          {error && (
            <div className="mb-6">
              <p className="font-body font-light text-sm mb-2" style={{ color: "var(--danger)" }}>
                {error}
              </p>
              <button
                onClick={load}
                className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
              >
                Try again →
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-12">
            {loading ? (
              [0, 1, 2].map((i) => <StatSkeleton key={i} />)
            ) : stats ? (
              <>
                <StatCard value={stats.total_articles}     label="Approved articles"    />
                <StatCard value={stats.sessions_this_month} label="Sessions this month" />
                <StatCard value={stats.pending_approvals}  label="Pending approvals"    />
              </>
            ) : null}
          </div>

          {/* Role coverage */}
          <SectionLabel>Role coverage</SectionLabel>
          <div className="grid grid-cols-3 gap-4 mb-12">
            {loading
              ? [0, 1, 2, 3, 4].map((i) => <CoverageSkeleton key={i} />)
              : coverage.map((role) => (
                  <CoverageCard key={role.id} role={role} maxArticles={maxArticles} />
                ))}
          </div>

          {/* Pending approvals */}
          <SectionLabel>Pending approvals</SectionLabel>
          {loading ? (
            <div className="bg-white border border-rule px-6">
              {[0, 1, 2].map((i) => <PendingSkeleton key={i} />)}
            </div>
          ) : pending.length === 0 ? (
            <div className="bg-white border border-rule px-6 py-10 text-center">
              <p className="font-body font-light text-sm text-ink-3">Everything is up to date.</p>
            </div>
          ) : (
            <div className="bg-white border border-rule px-6">
              {pending.map((article) => (
                <PendingRow
                  key={article.id}
                  article={article}
                  onView={() => navigate(`/knowledge/${article.id}`, { state: { from: "manager" } })}
                  onApprove={() => handleApprove(article.id)}
                  onReject={() => handleReject(article.id)}
                  approving={actioning[article.id] === "approving"}
                  rejecting={actioning[article.id] === "rejecting"}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Manager;
