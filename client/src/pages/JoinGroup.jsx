import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { getInvite, acceptInvite } from "../lib/api.js";

const JoinGroup = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState(null); // "invalid" | "expired"
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    getInvite(token)
      .then(({ data }) => setInvite(data.data.invite))
      .catch((err) => {
        const status = err?.response?.status;
        setLoadError(status === 410 ? "expired" : "invalid");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleJoin = async () => {
    setJoining(true);
    setJoinError(null);
    try {
      await acceptInvite(token);
      await refreshUser();
      setJoined(true);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch {
      setJoinError("Something went wrong — try again.");
      setJoining(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-8">
        <div style={{ maxWidth: 440, width: "100%" }}>
          <div className="h-6 bg-ground w-20 mb-10" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
          <div className="h-4 bg-ground w-48 mb-3" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
          <div className="h-10 bg-ground w-64 mb-8" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
          <div className="h-10 bg-ground w-36" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
        </div>
      </div>
    );
  }

  // ── Invalid / expired ────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-8" style={{ animation: "pageFade 200ms ease" }}>
        <div style={{ maxWidth: 440, width: "100%" }}>
          <div className="mb-8">
            <span className="font-display font-light text-xl text-ink">In</span>
            <span className="font-display font-light italic text-xl text-volt">Know</span>
          </div>
          <h1
            className="font-display italic text-ink leading-tight mb-3"
            style={{ fontSize: 36, fontWeight: 100 }}
          >
            {loadError === "expired" ? "Link expired." : "Link not valid."}
          </h1>
          <p className="font-body font-light text-sm text-ink-3 mb-8">
            {loadError === "expired"
              ? "This invite link has expired. Ask your team admin or manager for a new one."
              : "This invite link is not valid. It may have been removed."}
          </p>
          <button
            onClick={() => navigate("/login")}
            className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
          >
            ← Back to login
          </button>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (joined) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-8" style={{ animation: "pageFade 200ms ease" }}>
        <div style={{ maxWidth: 440, width: "100%" }}>
          <div className="w-12 h-12 rounded-full bg-forest-light flex items-center justify-center mb-8">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1
            className="font-display italic text-ink leading-tight mb-3"
            style={{ fontSize: 36, fontWeight: 100 }}
          >
            You're in.
          </h1>
          <p className="font-body font-light text-sm text-ink-3">
            Welcome to <span className="text-ink">{invite?.group?.name}</span>. Taking you to your dashboard…
          </p>
        </div>
      </div>
    );
  }

  const alreadyInDifferentGroup = user?.group_id && user.group_id !== invite?.group_id;

  // ── Invite page ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-8" style={{ animation: "pageFade 200ms ease" }}>
      <div style={{ maxWidth: 440, width: "100%" }}>
        {/* Wordmark */}
        <div className="mb-10">
          <span className="font-display font-light text-xl text-ink">In</span>
          <span className="font-display font-light italic text-xl text-volt">Know</span>
        </div>

        <p className="font-body font-light text-sm text-ink-3 mb-2">
          You've been invited to join
        </p>
        <h1
          className="font-display italic text-ink leading-tight mb-2"
          style={{ fontSize: 48, fontWeight: 100 }}
        >
          {invite?.group?.name}
        </h1>
        {invite?.group?.description && (
          <p className="font-body font-light text-sm text-ink-3 mb-8">
            {invite.group.description}
          </p>
        )}

        {!invite?.group?.description && <div className="mb-8" />}

        {user ? (
          <>
            {alreadyInDifferentGroup && (
              <p className="font-body font-light text-xs text-ink-3 mb-4 border border-rule bg-ground px-4 py-3">
                You're currently in another group. Accepting will move you to{" "}
                <span className="text-ink">{invite?.group?.name}</span>.
              </p>
            )}
            {joinError && (
              <p className="font-body font-light text-xs mb-4" style={{ color: "var(--danger)" }}>
                {joinError}
              </p>
            )}
            <button
              onClick={handleJoin}
              disabled={joining}
              className="bg-ink text-surface font-body font-medium text-xs px-8 py-3 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-50"
            >
              {joining ? "Joining…" : `Join ${invite?.group?.name} →`}
            </button>
          </>
        ) : (
          <>
            <p className="font-body font-light text-sm text-ink-3 mb-6">
              Log in to accept this invite.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="bg-ink text-surface font-body font-medium text-xs px-8 py-3 tracking-wider uppercase hover:bg-ink-2 transition-colors"
            >
              Log in to accept →
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinGroup;
