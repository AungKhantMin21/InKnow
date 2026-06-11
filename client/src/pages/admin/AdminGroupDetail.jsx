import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import AdminLayout from "./AdminLayout.jsx";
import {
  getGroup,
  getGroupMembers,
  getGroupInvites,
  getAdminEmployees,
  addGroupMember,
  removeGroupMember,
  createGroupInvite,
  updateGroup,
} from "../../lib/api.js";

const AdminGroupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [group, setGroup] = useState(location.state?.group || null);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inline edit
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Add member
  const [memberSearch, setMemberSearch] = useState("");
  const [addingMember, setAddingMember] = useState(null);

  // Invite
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  const [removingMember, setRemovingMember] = useState(null);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [groupRes, membersRes, invitesRes, empRes] = await Promise.all([
          group ? Promise.resolve({ data: { data: { group } } }) : getGroup(id),
          getGroupMembers(id),
          getGroupInvites(id),
          getAdminEmployees(),
        ]);
        setGroup(groupRes.data.data.group);
        setMembers(membersRes.data.data.members || []);
        setInvites(invitesRes.data.data.invites || []);
        setAllEmployees(empRes.data.data.employees || []);
      } catch {
        setError("Something went wrong — try again.");
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [id]);

  const handleSaveGroup = async () => {
    setSaving(true);
    try {
      const { data } = await updateGroup(id, { name: editName.trim(), description: editDesc.trim() || undefined });
      setGroup(data.data.group);
      setEditingName(false);
    } catch {
      // keep editing open
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (employee) => {
    setAddingMember(employee.id);
    try {
      await addGroupMember(id, employee.id);
      setMembers((prev) => [...prev, employee].sort((a, b) => a.name.localeCompare(b.name)));
      setMemberSearch("");
    } catch {
      // fail silently
    } finally {
      setAddingMember(null);
    }
  };

  const handleRemoveMember = async (employee) => {
    setRemovingMember(employee.id);
    try {
      await removeGroupMember(id, employee.id);
      setMembers((prev) => prev.filter((m) => m.id !== employee.id));
    } catch {
      // fail silently
    } finally {
      setRemovingMember(null);
    }
  };

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const { data } = await createGroupInvite(id, { expires_in_days: 7 });
      setInvites((prev) => [data.data.invite, ...prev]);
    } catch {
      // fail silently
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCopy = (token) => {
    const url = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  const memberIds = new Set(members.map((m) => m.id));
  const searchLower = memberSearch.toLowerCase();
  const availableToAdd = allEmployees.filter(
    (e) =>
      !memberIds.has(e.id) &&
      (searchLower === "" ||
        e.name.toLowerCase().includes(searchLower) ||
        (e.email || "").toLowerCase().includes(searchLower)),
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="mb-8">
          <div className="h-4 bg-ground w-20 mb-6" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
          <div className="h-8 bg-ground w-48 mb-2" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
          <div className="h-4 bg-ground w-64" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
        </div>
      </AdminLayout>
    );
  }

  if (error || !group) {
    return (
      <AdminLayout>
        <p className="font-body font-light text-sm text-ink-2 mb-4">
          {error || "We couldn't find that. Try going back."}
        </p>
        <button
          onClick={() => navigate("/admin/groups")}
          className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
        >
          ← Back to groups
        </button>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Back */}
      <button
        onClick={() => navigate("/admin/groups")}
        className="font-body font-light text-xs text-ink-3 hover:text-ink transition-colors mb-6 block"
      >
        ← Groups
      </button>

      {/* Group header */}
      {editingName ? (
        <div className="mb-8">
          <input
            autoFocus
            className="border border-rule bg-surface font-display font-light text-2xl text-ink px-3 py-2 outline-none focus:border-rule-hi transition-colors w-full mb-2"
            style={{ letterSpacing: "-0.02em" }}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <input
            className="border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2 outline-none focus:border-rule-hi transition-colors w-full mb-3 placeholder:text-ink-4"
            placeholder="Description (optional)"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveGroup}
              disabled={saving || !editName.trim()}
              className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1
              className="font-display text-ink mb-1"
              style={{ fontWeight: 200, fontSize: 32, letterSpacing: "-0.02em" }}
            >
              {group.name}
            </h1>
            {group.description && (
              <p className="font-body font-light text-sm text-ink-3">{group.description}</p>
            )}
          </div>
          <button
            onClick={() => { setEditName(group.name); setEditDesc(group.description || ""); setEditingName(true); }}
            className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors ml-6 flex-shrink-0"
          >
            Edit
          </button>
        </div>
      )}

      {/* Members section */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
            Members
          </span>
          <div className="flex-1 h-px bg-rule" />
        </div>

        {members.length === 0 ? (
          <p className="font-body font-light text-sm text-ink-3 mb-4">No members assigned yet.</p>
        ) : (
          <div className="flex flex-col gap-0 mb-4 border border-rule">
            {members.map((member, i) => (
              <div
                key={member.id}
                className={`flex items-center px-4 py-3 gap-4 ${i > 0 ? "border-t border-rule" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-body font-light text-sm text-ink block truncate">{member.name}</span>
                  <span className="font-mono text-[9px] tracking-wider text-ink-4 block">
                    {member.job_title || "—"}
                    {member.is_manager && " · Manager"}
                    {member.is_admin && " · Admin"}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveMember(member)}
                  disabled={removingMember === member.id}
                  className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors disabled:opacity-40 flex-shrink-0"
                >
                  {removingMember === member.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add member search */}
        <div className="relative">
          <input
            className="border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors placeholder:text-ink-4 w-full"
            placeholder="Search employees to add…"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
          />
          {memberSearch && availableToAdd.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-rule border-t-0 z-10 max-h-48 overflow-y-auto">
              {availableToAdd.slice(0, 8).map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => handleAddMember(emp)}
                  disabled={addingMember === emp.id}
                  className="w-full text-left px-4 py-2.5 hover:bg-ground transition-colors flex items-center justify-between disabled:opacity-50"
                >
                  <span>
                    <span className="font-body font-light text-sm text-ink block">{emp.name}</span>
                    <span className="font-mono text-[9px] tracking-wider text-ink-4">{emp.email}</span>
                  </span>
                  <span className="font-body font-medium text-xs text-ink-3 flex-shrink-0 ml-3">
                    {addingMember === emp.id ? "Adding…" : "Add"}
                  </span>
                </button>
              ))}
            </div>
          )}
          {memberSearch && availableToAdd.length === 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-rule border-t-0 z-10 px-4 py-3">
              <span className="font-body font-light text-sm text-ink-3">No unassigned employees found.</span>
            </div>
          )}
        </div>
      </section>

      {/* Invite links section */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
            Invite links
          </span>
          <div className="flex-1 h-px bg-rule" />
        </div>

        {invites.length > 0 && (
          <div className="flex flex-col gap-0 mb-4 border border-rule">
            {invites.map((inv, i) => {
              const expires = inv.expires_at
                ? new Date(inv.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Never";
              return (
                <div
                  key={inv.id}
                  className={`flex items-center px-4 py-3 gap-4 ${i > 0 ? "border-t border-rule" : ""}`}
                >
                  <span className="font-mono text-[9px] tracking-wider text-ink-3 flex-1 truncate">
                    {inv.token.slice(0, 18)}…
                  </span>
                  <span className="font-mono text-[9px] tracking-wider text-ink-4 flex-shrink-0">
                    Expires {expires}
                  </span>
                  <button
                    onClick={() => handleCopy(inv.token)}
                    className="font-body font-medium text-xs flex-shrink-0 transition-colors"
                    style={{ color: copiedToken === inv.token ? "var(--forest)" : "var(--ink-3)" }}
                  >
                    {copiedToken === inv.token ? "Copied!" : "Copy link"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={handleGenerateInvite}
          disabled={generatingInvite}
          className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors disabled:opacity-50"
        >
          {generatingInvite ? "Generating…" : "Generate invite link"}
        </button>
      </section>
    </AdminLayout>
  );
};

export default AdminGroupDetail;
