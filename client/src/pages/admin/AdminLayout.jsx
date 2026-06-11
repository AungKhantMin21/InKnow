import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../../components/ui/Sidebar.jsx";

const ADMIN_NAV = [
  { label: "Groups", path: "/admin/groups" },
  { label: "Employees", path: "/admin/employees" },
  { label: "Core Knowledge", path: "/admin/core-knowledge" },
  { label: "Stats", path: "/admin/stats" },
];

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-surface flex" style={{ animation: "pageFade 200ms ease" }}>
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Admin sub-nav */}
        <div
          className="bg-white border-b border-rule flex items-center px-8 gap-6 flex-shrink-0"
          style={{ height: 48 }}
        >
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4">
            Admin
          </span>
          <div className="w-px h-4 bg-rule" />
          {ADMIN_NAV.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`font-body font-light text-sm transition-colors ${
                location.pathname.startsWith(item.path)
                  ? "text-ink"
                  : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <main className="flex-1 px-10 py-10 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
