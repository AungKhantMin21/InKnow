import { useState, useEffect } from "react";
import AdminLayout from "./AdminLayout.jsx";
import { getLLMUsage } from "../../lib/api.js";

const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-3 mb-5">
    <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
      {children}
    </span>
    <div className="flex-1 h-px bg-rule" />
  </div>
);

const formatTokens = (n) => {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const formatCost = (usd) => {
  if (!usd) return "$0.0000";
  return `$${usd.toFixed(4)}`;
};

const SkeletonRow = () => (
  <div className="flex gap-4 py-3 border-b border-rule">
    {[120, 80, 80, 80].map((w, i) => (
      <div key={i} className="bg-ground h-3 rounded-sm" style={{ width: w, animation: "skeletonPulse 1.5s ease infinite" }} />
    ))}
  </div>
);

const RANGE_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

export default function AdminUsage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getLLMUsage(days)
      .then((res) => setData(res.data.data))
      .catch(() => setError("Something went wrong — try again."))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <AdminLayout>
      <div className="max-w-4xl" style={{ animation: "pageFade 200ms ease" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-ink" style={{ fontWeight: 200, fontSize: 26, letterSpacing: "-0.01em" }}>
              LLM Usage
            </h1>
            <p className="font-body font-light text-sm text-ink-3 mt-1">
              Token usage and estimated cost across all groups.
            </p>
          </div>

          {/* Range selector */}
          <div className="flex items-center gap-1 border border-rule bg-white p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`font-mono text-[10px] tracking-wider uppercase px-3 py-1.5 transition-colors ${
                  days === opt.value
                    ? "bg-ink text-surface"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="font-body font-light text-sm text-danger">{error}</p>
        )}

        {/* Total calls stat */}
        {!loading && data && (
          <div className="bg-white border border-rule px-6 py-5 mb-8 inline-block">
            <div className="font-display text-ink" style={{ fontWeight: 200, fontSize: 38, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {data.total_calls}
            </div>
            <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-4 mt-2">
              Total AI calls · last {days} days
            </div>
          </div>
        )}

        {/* By group */}
        <div className="mb-10">
          <SectionLabel>Usage by Group</SectionLabel>

          <div className="bg-white border border-rule">
            <div className="grid border-b border-rule px-5 py-2.5" style={{ gridTemplateColumns: "1fr 80px 80px 80px 100px" }}>
              {["Group", "Calls", "Prompt", "Output", "Est. Cost"].map((h) => (
                <span key={h} className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-4">{h}</span>
              ))}
            </div>

            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-5"><SkeletonRow /></div>
                ))
              : data?.by_group?.length === 0
              ? (
                <div className="px-5 py-10 text-center">
                  <p className="font-body font-light text-sm text-ink-4">No usage data yet.</p>
                </div>
              )
              : data?.by_group?.map((g) => (
                  <div
                    key={g.group_id || "none"}
                    className="grid px-5 py-3 border-b border-rule last:border-0"
                    style={{ gridTemplateColumns: "1fr 80px 80px 80px 100px" }}
                  >
                    <span className="font-body font-light text-sm text-ink">{g.group_name}</span>
                    <span className="font-mono text-xs text-ink-2">{g.total_calls}</span>
                    <span className="font-mono text-xs text-ink-3">{formatTokens(g.total_prompt_tokens)}</span>
                    <span className="font-mono text-xs text-ink-3">{formatTokens(g.total_completion_tokens)}</span>
                    <span className="font-mono text-xs text-ink-2">{formatCost(g.estimated_cost_usd)}</span>
                  </div>
                ))
            }
          </div>
        </div>

        {/* By day */}
        <div>
          <SectionLabel>Daily Breakdown</SectionLabel>

          <div className="bg-white border border-rule">
            <div className="grid border-b border-rule px-5 py-2.5" style={{ gridTemplateColumns: "120px 80px 80px 80px 100px" }}>
              {["Date", "Calls", "Prompt", "Output", "Est. Cost"].map((h) => (
                <span key={h} className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-4">{h}</span>
              ))}
            </div>

            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5"><SkeletonRow /></div>
                ))
              : data?.by_day?.length === 0
              ? (
                <div className="px-5 py-10 text-center">
                  <p className="font-body font-light text-sm text-ink-4">No usage data yet.</p>
                </div>
              )
              : data?.by_day?.map((d) => (
                  <div
                    key={d.date}
                    className="grid px-5 py-3 border-b border-rule last:border-0"
                    style={{ gridTemplateColumns: "120px 80px 80px 80px 100px" }}
                  >
                    <span className="font-mono text-xs text-ink-2">{d.date}</span>
                    <span className="font-mono text-xs text-ink-2">{d.total_calls}</span>
                    <span className="font-mono text-xs text-ink-3">{formatTokens(d.total_prompt_tokens)}</span>
                    <span className="font-mono text-xs text-ink-3">{formatTokens(d.total_completion_tokens)}</span>
                    <span className="font-mono text-xs text-ink-2">{formatCost(d.estimated_cost_usd)}</span>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Recent agent calls */}
        <div className="mt-10">
          <SectionLabel>Recent Agent Calls</SectionLabel>

          <div className="bg-white border border-rule">
            <div className="grid border-b border-rule px-5 py-2.5" style={{ gridTemplateColumns: "130px 1fr 80px 80px 80px" }}>
              {["Time", "Type", "Steps", "Tools", "Latency"].map((h) => (
                <span key={h} className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-4">{h}</span>
              ))}
            </div>

            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5"><SkeletonRow /></div>
                ))
              : !data?.recent_calls?.length
              ? (
                <div className="px-5 py-10 text-center">
                  <p className="font-body font-light text-sm text-ink-4">No agent calls yet.</p>
                </div>
              )
              : data.recent_calls.map((c) => (
                  <div
                    key={c.id}
                    className="grid px-5 py-3 border-b border-rule last:border-0"
                    style={{ gridTemplateColumns: "130px 1fr 80px 80px 80px" }}
                  >
                    <span className="font-mono text-[10px] text-ink-4">{new Date(c.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="font-mono text-[10px] text-ink-3">{c.call_type} · {c.group_name}</span>
                    <span className="font-mono text-xs text-ink-2">{c.agent_steps}</span>
                    <span className="font-mono text-xs text-ink-2">{c.tool_calls_made}</span>
                    <span className="font-mono text-xs text-ink-3">{c.latency_ms ? `${(c.latency_ms / 1000).toFixed(1)}s` : "—"}</span>
                  </div>
                ))
            }
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
