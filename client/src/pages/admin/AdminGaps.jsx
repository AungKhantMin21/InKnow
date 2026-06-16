import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "./AdminLayout.jsx";
import { getAdminGaps } from "../../lib/api.js";

const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-3 mb-5">
    <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
      {children}
    </span>
    <div className="flex-1 h-px bg-rule" />
  </div>
);

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const SkeletonGap = () => (
  <div className="bg-white border border-rule px-5 py-4 space-y-2">
    <div className="bg-ground h-3 w-48 rounded-sm" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
    <div className="bg-ground h-2.5 w-full rounded-sm" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
    <div className="bg-ground h-2.5 w-32 rounded-sm" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
  </div>
);

export default function AdminGaps() {
  const [gaps, setGaps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getAdminGaps()
      .then((res) => setGaps(res.data.data.gaps))
      .catch(() => setError("Something went wrong — try again."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <div className="max-w-3xl" style={{ animation: "pageFade 200ms ease" }}>
        <div className="mb-8">
          <h1 className="font-display text-ink" style={{ fontWeight: 200, fontSize: 26, letterSpacing: "-0.01em" }}>
            Knowledge Gaps
          </h1>
          <p className="font-body font-light text-sm text-ink-3 mt-1">
            Questions the copilot couldn't answer from the knowledge base.
          </p>
        </div>

        {error && (
          <p className="font-body font-light text-sm text-danger">{error}</p>
        )}

        <SectionLabel>Open Gaps</SectionLabel>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonGap key={i} />)}
          </div>
        ) : gaps?.length === 0 ? (
          <div className="bg-white border border-rule px-8 py-16 text-center">
            <p className="font-display text-ink-3" style={{ fontWeight: 200, fontSize: 20 }}>
              No open gaps
            </p>
            <p className="font-body font-light text-sm text-ink-4 mt-2">
              Knowledge base is complete — the copilot answered every question.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {gaps?.map((gap) => (
              <div
                key={gap.id}
                className="bg-white border border-rule px-5 py-4"
                style={{ animation: "articleReveal 300ms ease both" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {/* Topic */}
                    <p className="font-body font-medium text-sm text-ink truncate">{gap.topic}</p>

                    {/* Original question */}
                    {gap.original_question && (
                      <p className="font-body font-light text-sm text-ink-3 mt-1 line-clamp-2">
                        "{gap.original_question}"
                      </p>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-2.5">
                      <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-4">
                        {gap.employee_name}
                      </span>
                      <span className="w-px h-3 bg-rule" />
                      <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-4">
                        {gap.group_name}
                      </span>
                      <span className="w-px h-3 bg-rule" />
                      <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-4">
                        {formatDate(gap.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Schedule capture action */}
                  <button
                    onClick={() => navigate("/admin/groups")}
                    className="font-body font-medium text-xs text-ink-3 border border-rule bg-transparent px-3 py-1.5 hover:bg-ground hover:text-ink transition-colors flex-shrink-0"
                  >
                    Schedule capture
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
