import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/ui/Sidebar.jsx";
import { getArticles, getRoles } from "../lib/api.js";

const getFreshness = (createdAt) => {
  const days = (Date.now() - new Date(createdAt)) / 86400000;
  if (days < 30) return "fresh";
  if (days < 90) return "recent";
  return null;
};

const SkeletonCard = () => (
  <div className="bg-white border border-rule p-5">
    <div className="flex items-center justify-between mb-3">
      <div className="h-5 bg-ground w-20" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
    </div>
    <div className="h-4 bg-ground w-3/4 mb-2" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
    <div className="h-3 bg-ground w-full mb-1" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
    <div className="h-3 bg-ground w-2/3 mb-6" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
    <div className="border-t border-rule pt-3 flex justify-between">
      <div className="h-3 bg-ground w-20" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
      <div className="h-3 bg-ground w-16" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
    </div>
  </div>
);

const ArticleCard = ({ article, onClick }) => {
  const freshness = getFreshness(article.created_at);
  const date = new Date(article.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <button
      onClick={onClick}
      className="bg-white border border-rule hover:border-rule-hi transition-colors p-5 text-left flex flex-col"
      style={{ animation: "pageFade 200ms ease" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[8px] tracking-[0.16em] uppercase text-ink-3 bg-ground border border-rule px-2 py-1">
          {article.roles?.name || "Unknown role"}
        </span>
        {freshness && (
          <span
            className="font-mono text-[8px] tracking-[0.12em] uppercase px-2 py-1 rounded-sm"
            style={{
              color: freshness === "fresh" ? "var(--forest)" : "var(--amber)",
              background: freshness === "fresh" ? "var(--forest-light)" : "var(--amber-light)",
            }}
          >
            {freshness === "fresh" ? "New" : "Recent"}
          </span>
        )}
      </div>

      <h2
        className="font-display text-ink mb-2 flex-1"
        style={{ fontWeight: 200, fontSize: 16, letterSpacing: "-0.01em", lineHeight: 1.3 }}
      >
        {article.title}
      </h2>

      {article.summary && (
        <p className="font-body font-light text-xs text-ink-3 mb-4" style={{ lineHeight: 1.65 }}>
          {article.summary.length > 110 ? article.summary.slice(0, 110) + "…" : article.summary}
        </p>
      )}

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-rule">
        <span className="font-mono text-[9px] tracking-wider text-ink-4">
          {article.capturer?.name || "Unknown"}
        </span>
        <div className="flex items-center gap-3">
          {(article.view_count || 0) > 0 && (
            <span className="font-mono text-[9px] tracking-wider text-ink-4">
              {article.view_count} view{article.view_count !== 1 ? "s" : ""}
            </span>
          )}
          <span className="font-mono text-[9px] tracking-wider text-ink-4">{date}</span>
        </div>
      </div>
    </button>
  );
};

const Knowledge = () => {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getRoles()
      .then(({ data }) => setRoles(data.data.roles))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = {};
    if (selectedRole) params.role_id = selectedRole;
    if (search.trim()) params.search = search.trim();

    getArticles(params)
      .then(({ data }) => setArticles(data.data.articles))
      .catch(() => setError("Something went wrong — try again."))
      .finally(() => setLoading(false));
  }, [selectedRole, search]);

  return (
    <div className="min-h-screen bg-surface flex" style={{ animation: "pageFade 200ms ease" }}>
      <Sidebar />

      {/* Role filter panel */}
      <aside className="w-48 bg-white border-r border-rule flex-shrink-0 flex flex-col">
        <div className="px-5 pt-6 pb-3 border-b border-rule">
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4">
            Filter by role
          </span>
        </div>
        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
          <button
            onClick={() => setSelectedRole(null)}
            className={`w-full text-left px-3 py-2 font-body font-light text-sm transition-colors ${
              selectedRole === null
                ? "bg-ground text-ink"
                : "text-ink-2 hover:bg-ground hover:text-ink"
            }`}
          >
            All roles
          </button>
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`w-full text-left px-3 py-2 font-body font-light text-sm transition-colors ${
                selectedRole === role.id
                  ? "bg-ground text-ink"
                  : "text-ink-2 hover:bg-ground hover:text-ink"
              }`}
            >
              {role.name}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 px-10 py-10 min-w-0">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1
              className="font-display font-light text-3xl text-ink"
              style={{ letterSpacing: "-0.02em" }}
            >
              Knowledge
            </h1>
            <p className="font-body font-light text-sm text-ink-3 mt-1">
              Institutional knowledge, preserved.
            </p>
          </div>
          <input
            className="border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors placeholder:text-ink-4"
            style={{ width: 260 }}
            placeholder="Search articles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && (
          <div className="mb-6">
            <p className="font-body font-light text-sm mb-2" style={{ color: "var(--danger)" }}>
              {error}
            </p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                const params = {};
                if (selectedRole) params.role_id = selectedRole;
                if (search.trim()) params.search = search.trim();
                getArticles(params)
                  .then(({ data }) => setArticles(data.data.articles))
                  .catch(() => setError("Something went wrong — try again."))
                  .finally(() => setLoading(false));
              }}
              className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
            >
              Try again →
            </button>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!loading && !error && articles.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onClick={() => navigate(`/knowledge/${article.id}`)}
              />
            ))}
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <div className="bg-white border border-rule px-8 py-12 text-center">
            <p className="font-body font-light text-sm text-ink-3 mb-4">
              No knowledge captured for this role yet.
            </p>
            <button
              onClick={() => navigate("/sessions/new")}
              className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
            >
              Start the first capture session →
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Knowledge;
