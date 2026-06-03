import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listSessions } from "../lib/api.js";
import Sidebar from "../components/ui/Sidebar.jsx";

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const StatusBadge = ({ status }) => {
  const map = {
    "re-opened": { label: "In progress", color: "var(--amber)", bg: "var(--amber-light)" },
    completed: { label: "Completed", color: "var(--forest)", bg: "var(--forest-light)" },
  };
  const style = map[status];
  if (!style) return null;
  return (
    <span
      className="font-mono text-[8px] tracking-[0.16em] uppercase px-2 py-1 flex-shrink-0"
      style={{ color: style.color, background: style.bg }}
    >
      {style.label}
    </span>
  );
};

const SessionCard = ({ session, onNavigate }) => {
  const exchanges = Math.floor((session.message_count || 0) / 2);
  const isInProgress = session.status === "active" || session.status === "re-opened";
  const date = isInProgress ? session.started_at : (session.last_completed_at || session.completed_at);

  return (
    <div
      className="bg-white border border-rule hover:border-rule-hi transition-colors p-5 cursor-pointer"
      onClick={() => onNavigate(`/sessions/${session.id}`)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p
            className="font-display text-ink leading-tight mb-1 truncate"
            style={{ fontWeight: 200, fontSize: 15 }}
          >
            {session.title || session.roles?.name || "Capture session"}
          </p>
          <p className="font-mono text-[9px] text-ink-4 tracking-[0.04em]">
            {session.roles?.name}
            {" · "}
            {formatDate(date)}
            {" · "}
            {exchanges} exchange{exchanges !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusBadge status={session.status} />
          {isInProgress && (
            <button
              className="bg-ink text-surface font-body font-medium text-xs px-4 py-2 tracking-wider uppercase hover:bg-ink-2 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(`/sessions/${session.id}`);
              }}
            >
              Resume
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const SectionLabel = ({ label }) => (
  <div className="flex items-center gap-3 mb-4">
    <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
      {label}
    </span>
    <div className="flex-1 h-px bg-rule" />
  </div>
);

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

  const inProgress = sessions.filter(
    (s) => s.status === "active" || s.status === "re-opened",
  );
  const completed = sessions.filter((s) => s.status === "completed");

  return (
    <div className="min-h-screen bg-surface flex" style={{ animation: "pageFade 200ms ease" }}>
      <Sidebar />

      <main className="flex-1 px-12 py-12">
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

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-rule p-5">
                <div className="h-4 bg-ground w-1/2 mb-2" />
                <div className="h-3 bg-ground w-1/3" />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <p className="font-body font-light text-sm text-ink-2">{error}</p>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="bg-white border border-rule px-8 py-12 text-center">
            <p className="font-body font-light text-sm text-ink-3">
              You haven't captured any knowledge yet.
            </p>
            <button
              onClick={() => navigate("/sessions/new")}
              className="mt-4 font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
            >
              Start your first session →
            </button>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <div className="flex flex-col gap-8">
            {inProgress.length > 0 && (
              <div>
                <SectionLabel label="In progress" />
                <div className="flex flex-col gap-2">
                  {inProgress.map((s) => (
                    <SessionCard key={s.id} session={s} onNavigate={navigate} />
                  ))}
                </div>
              </div>
            )}

            {completed.length > 0 && (
              <div>
                <SectionLabel label="Completed" />
                <div className="flex flex-col gap-2">
                  {completed.map((s) => (
                    <SessionCard key={s.id} session={s} onNavigate={navigate} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default SessionsList;
