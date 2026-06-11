import { useState, useEffect } from "react";
import AdminLayout from "./AdminLayout.jsx";
import { getArticles, setArticleCore } from "../../lib/api.js";

const CORE_CAP = 20;

const AdminCoreKnowledge = () => {
  const [allPublic, setAllPublic] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getArticles()
      .then(({ data }) => setAllPublic(data.data.articles || []))
      .catch(() => setError("Something went wrong — try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const coreArticles = allPublic.filter((a) => a.is_core);
  const nonCorePublic = allPublic.filter(
    (a) =>
      !a.is_core &&
      a.visibility === "public" &&
      (search.trim() === "" || a.title.toLowerCase().includes(search.toLowerCase())),
  );
  const coreCount = coreArticles.length;
  const atCap = coreCount >= CORE_CAP;
  const nearCap = coreCount >= CORE_CAP - 2;

  const handleToggleCore = async (article, makingCore) => {
    setTogglingId(article.id);
    try {
      await setArticleCore(article.id, makingCore);
      setAllPublic((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, is_core: makingCore } : a)),
      );
    } catch {
      // leave unchanged
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="font-display font-light text-3xl text-ink" style={{ letterSpacing: "-0.02em" }}>
          Core Knowledge
        </h1>
        <p className="font-body font-light text-sm text-ink-3 mt-1">
          Core articles are injected into every session — always present.
        </p>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-rule p-4 flex items-center gap-4">
              <div className="h-3 bg-ground flex-1" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
              <div className="h-3 bg-ground w-20" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div>
          <p className="font-body font-light text-sm mb-2" style={{ color: "var(--danger)" }}>{error}</p>
          <button onClick={load} className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors">
            Try again →
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Usage indicator */}
          <div className="bg-white border border-rule p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4">
                Core article usage
              </span>
              <span
                className="font-mono text-[9px] tracking-wider"
                style={{ color: atCap ? "var(--danger)" : nearCap ? "var(--amber)" : "var(--forest)" }}
              >
                {coreCount} / {CORE_CAP}
              </span>
            </div>
            <div className="h-1.5 bg-ground w-full">
              <div
                className="h-full transition-all"
                style={{
                  width: `${(coreCount / CORE_CAP) * 100}%`,
                  background: atCap ? "var(--danger)" : nearCap ? "var(--amber)" : "var(--forest)",
                }}
              />
            </div>
            {nearCap && !atCap && (
              <p className="font-body font-light text-xs mt-2" style={{ color: "var(--amber)" }}>
                Approaching limit — {CORE_CAP - coreCount} slot{CORE_CAP - coreCount !== 1 ? "s" : ""} remaining.
              </p>
            )}
            {atCap && (
              <p className="font-body font-light text-xs mt-2" style={{ color: "var(--danger)" }}>
                Limit reached. Remove a core article before adding another.
              </p>
            )}
          </div>

          {/* Current core articles */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
                Current core articles
              </span>
              <div className="flex-1 h-px bg-rule" />
            </div>

            {coreArticles.length === 0 ? (
              <p className="font-body font-light text-sm text-ink-3">
                No core articles yet. Mark foundational articles as core below.
              </p>
            ) : (
              <div className="flex flex-col gap-0 border border-rule">
                {coreArticles.map((article, i) => (
                  <div
                    key={article.id}
                    className={`flex items-center px-5 py-3 gap-4 ${i > 0 ? "border-t border-rule" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-body font-light text-sm text-ink block truncate">
                        {article.title}
                      </span>
                      <span className="font-mono text-[9px] tracking-wider text-ink-4">
                        {article.groups?.name || ""}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleCore(article, false)}
                      disabled={togglingId === article.id}
                      className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors disabled:opacity-40 flex-shrink-0"
                    >
                      {togglingId === article.id ? "Removing…" : "Remove core"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Add core article */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
                Add core article
              </span>
              <div className="flex-1 h-px bg-rule" />
            </div>

            <input
              className="border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors placeholder:text-ink-4 w-full mb-4"
              style={{ maxWidth: 400 }}
              placeholder="Search public articles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={atCap}
            />

            {nonCorePublic.length === 0 && search && (
              <p className="font-body font-light text-sm text-ink-3">
                No public articles match that search.
              </p>
            )}

            {nonCorePublic.length === 0 && !search && (
              <p className="font-body font-light text-sm text-ink-3">
                {atCap
                  ? "Remove a core article before adding another."
                  : "All public articles are already marked as core."}
              </p>
            )}

            {nonCorePublic.length > 0 && (
              <div className="flex flex-col gap-0 border border-rule">
                {nonCorePublic.map((article, i) => (
                  <div
                    key={article.id}
                    className={`flex items-center px-5 py-3 gap-4 ${i > 0 ? "border-t border-rule" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-body font-light text-sm text-ink block truncate">
                        {article.title}
                      </span>
                      <span className="font-mono text-[9px] tracking-wider text-ink-4">
                        {article.groups?.name || ""}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleCore(article, true)}
                      disabled={atCap || togglingId === article.id}
                      className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors disabled:opacity-40 flex-shrink-0"
                    >
                      {togglingId === article.id ? "Marking…" : "Mark as core"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminCoreKnowledge;
