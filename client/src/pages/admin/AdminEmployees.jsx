import { useState, useEffect } from "react";
import AdminLayout from "./AdminLayout.jsx";
import { getAdminEmployees, getGroups, updateEmployeeRole } from "../../lib/api.js";

const ROLE_BADGE = {
  admin: { label: "Admin", color: "var(--volt)", bg: "var(--volt-light)" },
  manager: { label: "Manager", color: "var(--forest)", bg: "var(--forest-light)" },
};

const RoleBadge = ({ type }) => {
  const { label, color, bg } = ROLE_BADGE[type];
  return (
    <span
      className="font-mono text-[7px] tracking-[0.14em] uppercase px-1.5 py-0.5"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  );
};

const AdminEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const loadEmployees = (q = "") => {
    setLoading(true);
    setError(null);
    const params = q.trim() ? { search: q.trim() } : {};
    getAdminEmployees(params)
      .then(({ data }) => setEmployees(data.data.employees || []))
      .catch(() => setError("Something went wrong — try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEmployees();
    getGroups()
      .then(({ data }) => setGroups(data.data.groups || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadEmployees(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const startEdit = (emp) => {
    setEditingId(emp.id);
    setEditForm({
      job_title: emp.job_title || "",
      group_id: emp.group_id || "",
      is_manager: emp.is_manager,
      is_admin: emp.is_admin,
    });
  };

  const handleSave = async (empId) => {
    setSaving(true);
    try {
      const payload = {
        job_title: editForm.job_title.trim() || null,
        group_id: editForm.group_id || null,
        is_manager: editForm.is_manager,
        is_admin: editForm.is_admin,
      };
      const { data } = await updateEmployeeRole(empId, payload);
      const updated = data.data.employee;
      const matchingGroup = groups.find((g) => g.id === updated.group_id);
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === empId
            ? { ...e, ...updated, group_name: matchingGroup?.name || null }
            : e,
        ),
      );
      setEditingId(null);
    } catch {
      // leave edit open
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display font-light text-3xl text-ink" style={{ letterSpacing: "-0.02em" }}>
            Employees
          </h1>
          <p className="font-body font-light text-sm text-ink-3 mt-1">
            Manage group assignments and role permissions.
          </p>
        </div>
        <input
          className="border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors placeholder:text-ink-4"
          style={{ width: 240 }}
          placeholder="Search employees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <div className="flex flex-col gap-0 border border-rule">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`flex items-center px-5 py-3 gap-4 ${i > 0 ? "border-t border-rule" : ""}`}>
              <div className="h-3 bg-ground w-28 flex-shrink-0" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
              <div className="h-3 bg-ground w-40" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
              <div className="h-3 bg-ground w-20 ml-auto" style={{ animation: "skeletonPulse 1.5s ease infinite" }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div>
          <p className="font-body font-light text-sm mb-2" style={{ color: "var(--danger)" }}>{error}</p>
          <button onClick={() => loadEmployees(search)} className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors">
            Try again →
          </button>
        </div>
      )}

      {!loading && !error && employees.length === 0 && (
        <div className="bg-white border border-rule px-8 py-12 text-center">
          <p className="font-body font-light text-sm text-ink-3">
            {search ? "No employees match that search." : "No employees yet."}
          </p>
        </div>
      )}

      {!loading && !error && employees.length > 0 && (
        <div className="flex flex-col gap-0 border border-rule">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-5 py-2 border-b border-rule bg-ground">
            {["Name", "Group", "Job title", ""].map((h, i) => (
              <span key={i} className="font-mono text-[8px] tracking-[0.18em] uppercase text-ink-4">{h}</span>
            ))}
          </div>

          {employees.map((emp, i) => (
            <div key={emp.id} className={i > 0 ? "border-t border-rule" : ""}>
              {editingId === emp.id ? (
                /* Edit row */
                <div className="px-5 py-4 bg-ground">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      className="border border-rule bg-white font-body font-light text-sm text-ink px-3 py-2 outline-none focus:border-rule-hi transition-colors placeholder:text-ink-4"
                      placeholder="Job title"
                      value={editForm.job_title}
                      onChange={(e) => setEditForm((f) => ({ ...f, job_title: e.target.value }))}
                    />
                    <select
                      className="border border-rule bg-white font-body font-light text-sm text-ink px-3 py-2 outline-none focus:border-rule-hi transition-colors"
                      value={editForm.group_id}
                      onChange={(e) => setEditForm((f) => ({ ...f, group_id: e.target.value }))}
                    >
                      <option value="">No group</option>
                      {groups.filter((g) => !g.archived).map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <label className="flex items-center gap-2 font-body font-light text-sm text-ink-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.is_manager}
                        onChange={(e) => setEditForm((f) => ({ ...f, is_manager: e.target.checked }))}
                      />
                      Manager
                    </label>
                    <label className="flex items-center gap-2 font-body font-light text-sm text-ink-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.is_admin}
                        onChange={(e) => setEditForm((f) => ({ ...f, is_admin: e.target.checked }))}
                      />
                      Admin
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSave(emp.id)}
                      disabled={saving}
                      className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View row */
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-5 py-3 items-center">
                  <div className="min-w-0">
                    <span className="font-body font-light text-sm text-ink block truncate">{emp.name}</span>
                    <span className="font-mono text-[9px] tracking-wider text-ink-4 block truncate">{emp.email}</span>
                  </div>
                  <span className="font-body font-light text-sm text-ink-2 truncate">
                    {emp.group_name || <span className="text-ink-4">—</span>}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {emp.is_admin && <RoleBadge type="admin" />}
                    {emp.is_manager && <RoleBadge type="manager" />}
                    {emp.job_title && (
                      <span className="font-body font-light text-sm text-ink-3 truncate">{emp.job_title}</span>
                    )}
                    {!emp.is_admin && !emp.is_manager && !emp.job_title && (
                      <span className="font-body font-light text-sm text-ink-4">—</span>
                    )}
                  </div>
                  <button
                    onClick={() => startEdit(emp)}
                    className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors flex-shrink-0"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminEmployees;
