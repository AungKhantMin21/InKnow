import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import Sidebar from "../components/ui/Sidebar.jsx";
import { listSessions } from "../lib/api.js";

const formatDate = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const SkeletonRow = () => (
  <div className="flex items-center gap-4 px-6 py-4 border-b border-rule last:border-0">
    <div className="h-4 bg-ground w-24 flex-shrink-0" />
    <div className="h-3 bg-ground flex-1" />
    <div className="h-3 bg-ground w-16" />
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    listSessions()
      .then(({ data }) => setSessions(data.data.sessions.slice(0, 5)))
      .catch(() => setError("Something went wrong — try again."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="min-h-screen bg-surface flex"
      style={{ animation: "pageFade 200ms ease" }}
    >
      <Sidebar />

      <main className="flex-1 px-12 py-12">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="font-display font-light text-4xl text-ink leading-tight">
            {greeting},{" "}
            <span className="font-display" style={{ fontStyle: "italic" }}>
              {user?.name?.split(" ")[0]}.
            </span>
          </h1>
          <p className="font-body font-light text-sm text-ink-3 mt-2">
            What would you like to do today?
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-4 mb-12">
          <button
            onClick={() => navigate("/sessions/new")}
            className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors"
          >
            Start a capture session
          </button>
          <button
            onClick={() => navigate("/inno")}
            className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors"
          >
            Ask Inno
          </button>
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
              Recent activity
            </span>
            <div className="flex-1 h-px bg-rule" />
          </div>

          {/* Error state */}
          {!loading && error && (
            <div className="bg-white border border-rule px-8 py-10 text-center">
              <p className="font-body font-light text-sm mb-4" style={{ color: "var(--danger)" }}>
                {error}
              </p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  listSessions()
                    .then(({ data }) => setSessions(data.data.sessions.slice(0, 5)))
                    .catch(() => setError("Something went wrong — try again."))
                    .finally(() => setLoading(false));
                }}
                className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
              >
                Try again →
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="bg-white border border-rule overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          )}

          {/* Sessions list */}
          {!loading && !error && sessions.length > 0 && (
            <div className="bg-white border border-rule overflow-hidden">
              {sessions.map((session) => {
                const isActive = session.status === "active";
                const exchanges = Math.floor((session.message_count || 0) / 2);
                const date = isActive ? session.started_at : session.completed_at;

                return (
                  <button
                    key={session.id}
                    onClick={() =>
                      isActive
                        ? navigate(`/sessions/${session.id}`)
                        : navigate("/knowledge")
                    }
                    className="w-full flex items-center gap-4 px-6 py-4 border-b border-rule last:border-0 hover:bg-ground transition-colors text-left"
                  >
                    {/* Status indicator */}
                    <div className="flex items-center gap-2 flex-shrink-0 w-28">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          background: isActive ? "var(--amber)" : "var(--forest)",
                        }}
                      />
                      <span
                        className="font-mono text-[9px] tracking-wider uppercase"
                        style={{ color: isActive ? "var(--amber)" : "var(--forest)" }}
                      >
                        {isActive ? "In progress" : "Complete"}
                      </span>
                    </div>

                    {/* Role name */}
                    <span className="font-body font-light text-sm text-ink flex-1 truncate">
                      {session.roles?.name || "Capture session"}
                    </span>

                    {/* Exchanges */}
                    <span className="font-mono text-[9px] tracking-wider text-ink-4 flex-shrink-0">
                      {exchanges} exchange{exchanges !== 1 ? "s" : ""}
                    </span>

                    {/* Date */}
                    <span className="font-mono text-[9px] tracking-wider text-ink-4 flex-shrink-0 w-20 text-right">
                      {date ? formatDate(date) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && sessions.length === 0 && (
            <div className="bg-white border border-rule px-8 py-10 text-center">
              <p className="font-body font-light text-sm text-ink-3">
                You haven't captured any knowledge yet.
              </p>
              <button
                onClick={() => navigate("/sessions/new")}
                className="mt-4 font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
              >
                Start your first capture session →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
