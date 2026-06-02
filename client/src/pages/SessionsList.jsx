import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listSessions } from "../lib/api.js";
import Sidebar from "../components/ui/Sidebar.jsx";

const STATUS_STYLE = {
  active: { color: "var(--amber)", bg: "var(--amber-light)", label: "Active" },
  completed: { color: "var(--forest)", bg: "var(--forest-light)", label: "Completed" },
  abandoned: { color: "var(--ink-4)", bg: "var(--ground)", label: "Abandoned" },
};

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const SessionsList = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    listSessions()
      .then(({ data }) => setSessions(data.data.sessions))
      .catch(() => setError("Something went wrong — try again."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-surface flex" style={{ animation: "pageFade 200ms ease" }}>
      <Sidebar />

      {/* Main */}
      <main className="flex-1 px-12 py-12">
        {/* Header row */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="font-display font-light text-3xl text-ink">Sessions</h1>
            <p className="font-body font-light text-sm text-ink-3 mt-1">
              Your knowledge capture history
            </p>
          </div>
          <button
            onClick={() => navigate("/sessions/new")}
            className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors"
          >
            New session
          </button>
        </div>

        {/* Section label */}
        <div className="flex items-center gap-3 mb-6">
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
            All sessions
          </span>
          <div className="flex-1 h-px bg-rule" />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-rule px-6 py-4 flex items-center gap-4">
                <div className="w-16 h-4 bg-ground" />
                <div className="flex-1 h-4 bg-ground" />
                <div className="w-24 h-4 bg-ground" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <p className="font-body font-light text-sm text-ink-2">{error}</p>
        )}

        {/* Empty */}
        {!loading && !error && sessions.length === 0 && (
          <div className="bg-white border border-rule px-8 py-12 text-center">
            <p className="font-body font-light text-sm text-ink-3">
              You haven't captured any knowledge yet.
            </p>
            <button
              onClick={() => navigate("/sessions/new")}
              className="mt-4 font-body font-medium text-xs text-volt hover:underline"
            >
              Start your first session →
            </button>
          </div>
        )}

        {/* Session list */}
        {!loading && !error && sessions.length > 0 && (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => {
              const style = STATUS_STYLE[session.status] || STATUS_STYLE.abandoned;
              const shortId = session.id.slice(-8).toUpperCase();
              const employeeMessages = Math.max(0, Math.floor((session.message_count - 1) / 2));
              return (
                <button
                  key={session.id}
                  onClick={() => navigate(`/sessions/${session.id}`)}
                  className="w-full bg-white border border-rule hover:border-rule-hi transition-colors px-6 py-4 flex items-center gap-5 text-left"
                >
                  {/* Status badge */}
                  <span
                    className="font-mono text-[8px] tracking-[0.16em] uppercase px-2 py-1 flex-shrink-0"
                    style={{ color: style.color, background: style.bg }}
                  >
                    {style.label}
                  </span>

                  {/* Role name */}
                  <span className="font-body font-light text-sm text-ink flex-1">
                    {session.roles?.name || "Unknown role"}
                  </span>

                  {/* Exchange count */}
                  <span className="font-mono text-[9px] tracking-wider text-ink-4">
                    {employeeMessages} exchange{employeeMessages !== 1 ? "s" : ""}
                  </span>

                  {/* Date */}
                  <span className="font-mono text-[9px] tracking-wider text-ink-4 w-28 text-right">
                    {formatDate(session.started_at)}
                  </span>

                  {/* Short ID */}
                  <span className="font-mono text-[9px] tracking-wider text-ink-4 w-20 text-right">
                    {shortId}
                  </span>

                  <span className="text-ink-4 font-body text-xs ml-1">→</span>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default SessionsList;
