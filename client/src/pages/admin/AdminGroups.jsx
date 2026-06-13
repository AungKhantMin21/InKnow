import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "./AdminLayout.jsx";
import { getGroups, createGroup, archiveGroup } from "../../lib/api.js";

const AdminGroups = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getGroups()
      .then(({ data }) => setGroups(data.data.groups || []))
      .catch(() => setError("Something went wrong — try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const { data } = await createGroup({ name: newName.trim(), description: newDesc.trim() || undefined });
      setGroups((prev) => [...prev, { ...data.data.group, member_count: 0, article_count: 0 }]);
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
    } catch {
      setCreateError("Something went wrong — try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (group) => {
    setArchiveConfirmId(null);
    setArchiving(group.id);
    try {
      await archiveGroup(group.id);
      setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, archived: true } : g));
    } catch {
      // leave unchanged
    } finally {
      setArchiving(null);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display font-light text-3xl text-ink" style={{ letterSpacing: "-0.02em" }}>
            Groups
          </h1>
          <p className="font-body font-light text-sm text-ink-3 mt-1">
            Manage team groups and membership.
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateError(null); }}
          className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors"
        >
          Create group
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-rule p-6 mb-6"
          style={{ animation: "pageFade 150ms ease" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">New group</span>
            <div className="flex-1 h-px bg-rule" />
          </div>
          <div className="flex flex-col gap-3 mb-4">
            <input
              autoFocus
              className="border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors placeholder:text-ink-4"
              placeholder="Group name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <input
              className="border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors placeholder:text-ink-4"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          {createError && (
            <p className="font-body text-xs mb-3" style={{ color: "var(--danger)" }}>{createError}</p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setCreateError(null); }}
              className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-rule p-5">
              <div className="h-4 bg-ground w-32 mb-2" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
              <div className="h-3 bg-ground w-56 mb-4" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
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

      {!loading && !error && groups.length === 0 && (
        <div className="bg-white border border-rule px-8 py-12 text-center">
          <p className="font-body font-light text-sm text-ink-3 mb-4">No groups yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
          >
            Create your first group →
          </button>
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-white border border-rule p-5 flex items-start justify-between"
              style={{ opacity: group.archived ? 0.5 : 1 }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2
                    className="font-display text-ink"
                    style={{ fontWeight: 200, fontSize: 16, letterSpacing: "-0.01em" }}
                  >
                    {group.name}
                  </h2>
                  {group.archived && (
                    <span className="font-mono text-[8px] tracking-[0.14em] uppercase px-2 py-0.5"
                      style={{ color: "var(--ink-4)", background: "var(--ground)", border: "1px solid var(--rule)" }}>
                      Archived
                    </span>
                  )}
                </div>
                {group.description && (
                  <p className="font-body font-light text-sm text-ink-3 mb-2">{group.description}</p>
                )}
                <p className="font-mono text-[9px] tracking-wider text-ink-4">
                  {group.member_count} member{group.member_count !== 1 ? "s" : ""} · {group.article_count} article{group.article_count !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex items-center gap-2 ml-6 flex-shrink-0">
                {archiveConfirmId === group.id ? (
                  <div className="flex items-center gap-3">
                    <span className="font-body font-light text-xs text-ink-3">
                      This will archive {group.name}. Can't undo.
                    </span>
                    <button
                      onClick={() => handleArchive(group)}
                      disabled={archiving === group.id}
                      className="font-body font-medium text-xs px-3 py-1.5 tracking-wider uppercase transition-colors disabled:opacity-50"
                      style={{ background: "var(--danger-light)", color: "var(--danger)" }}
                    >
                      {archiving === group.id ? "Archiving…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setArchiveConfirmId(null)}
                      className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => navigate(`/admin/groups/${group.id}`, { state: { group } })}
                      className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors"
                    >
                      View
                    </button>
                    {!group.archived && (
                      <button
                        onClick={() => setArchiveConfirmId(group.id)}
                        className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
                      >
                        Archive
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminGroups;
