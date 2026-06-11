import { useState, useEffect } from "react";
import AdminLayout from "./AdminLayout.jsx";
import { getAdminStats } from "../../lib/api.js";

const StatCard = ({ label, value }) => (
  <div className="bg-white border border-rule p-6">
    <p
      className="font-display text-ink mb-1"
      style={{ fontWeight: 100, fontSize: 42, letterSpacing: "-0.02em", lineHeight: 1 }}
    >
      {value}
    </p>
    <p className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4">{label}</p>
  </div>
);

const AdminStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getAdminStats()
      .then(({ data }) => setStats(data.data))
      .catch(() => setError("Something went wrong — try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="font-display font-light text-3xl text-ink" style={{ letterSpacing: "-0.02em" }}>
          Stats
        </h1>
        <p className="font-body font-light text-sm text-ink-3 mt-1">
          Platform-wide numbers. No private content.
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-rule p-6">
              <div className="h-10 bg-ground w-16 mb-2" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
              <div className="h-3 bg-ground w-24" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
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

      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatCard label="Employees" value={stats.total_employees} />
            <StatCard label="Groups" value={stats.total_groups} />
            <StatCard label="Articles" value={stats.total_articles} />
            <StatCard label="Sessions completed" value={stats.total_sessions} />
            <StatCard label="Pending approvals" value={stats.pending_approvals} />
            <div className="bg-white border border-rule p-6">
              <p
                className="font-display text-ink mb-1"
                style={{ fontWeight: 100, fontSize: 42, letterSpacing: "-0.02em", lineHeight: 1 }}
              >
                {stats.core_articles}
                <span className="font-mono text-[14px] tracking-wider text-ink-4"> / 20</span>
              </p>
              <p className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4">Core articles</p>
            </div>
          </div>

          {stats.pending_approvals > 0 && (
            <p className="font-body font-light text-xs text-ink-3">
              {stats.pending_approvals} article{stats.pending_approvals !== 1 ? "s" : ""} waiting for manager approval.
            </p>
          )}
        </>
      )}
    </AdminLayout>
  );
};

export default AdminStats;
