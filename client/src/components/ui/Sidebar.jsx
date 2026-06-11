import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";

const isActive = (path, location) => {
  if (path === "/sessions") {
    return (
      location.pathname === "/sessions" ||
      (location.pathname.startsWith("/sessions/") &&
        location.pathname !== "/sessions/new")
    );
  }
  if (path === "/knowledge") return location.pathname.startsWith("/knowledge");
  if (path === "/admin") return location.pathname.startsWith("/admin");
  return location.pathname === path;
};

const SidebarSection = ({ label, children }) => (
  <div className="mt-4">
    <div className="flex items-center gap-2 px-4 pb-1">
      <span className="font-mono text-[8px] tracking-[0.28em] uppercase text-ink-4 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-rule" />
    </div>
    {children}
  </div>
);

const NavItem = ({ path, children, accent = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const active = isActive(path, location);

  return (
    <button
      onClick={() => navigate(path)}
      className={`w-full text-left px-3 py-2 font-body font-light text-sm transition-colors flex items-center gap-2 ${
        active ? "bg-ground text-ink" : "text-ink-2 hover:bg-ground hover:text-ink"
      }`}
    >
      {accent && (
        <div
          className="bg-volt flex-shrink-0"
          style={{
            width: 5,
            height: 5,
            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          }}
        />
      )}
      {children}
    </button>
  );
};

const buildRoleLabel = (user) => {
  if (!user) return "";
  const parts = [];
  if (user.is_admin) parts.push("Admin");
  if (user.is_manager && user.group_id) parts.push("Manager");
  if (user.group_id && user.job_title) parts.push(user.job_title);
  return parts.join(" · ");
};

const Sidebar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const hasGroup = !!user?.group_id;
  const isManager = !!(user?.is_manager && user?.group_id);
  const isAdmin = !!user?.is_admin;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="w-56 bg-white border-r border-rule flex flex-col flex-shrink-0">
      {/* Wordmark */}
      <div className="px-6 py-6 border-b border-rule">
        <span className="font-display font-light text-xl text-ink">In</span>
        <span className="font-display font-light italic text-xl text-volt">Know</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col overflow-y-auto">
        {hasGroup && (
          <SidebarSection label="My Work">
            <NavItem path="/dashboard">Dashboard</NavItem>
            <NavItem path="/sessions/new" accent>New session</NavItem>
            <NavItem path="/sessions">Sessions</NavItem>
            <NavItem path="/knowledge">Knowledge</NavItem>
            <NavItem path="/inno">Inno</NavItem>
          </SidebarSection>
        )}

        {isManager && (
          <SidebarSection label="My Group">
            <NavItem path="/manager">Manager</NavItem>
          </SidebarSection>
        )}

        {isAdmin && (
          <SidebarSection label="Admin">
            <NavItem path="/admin">Admin Portal</NavItem>
          </SidebarSection>
        )}
      </nav>

      {/* User footer */}
      <div className="px-6 py-4 border-t border-rule">
        <p className="font-body font-light text-xs text-ink-2 truncate">{user?.name}</p>
        <p className="font-mono text-[9px] tracking-wider text-ink-4 truncate mt-0.5">
          {buildRoleLabel(user)}
        </p>
        <button
          onClick={handleLogout}
          className="mt-3 font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
