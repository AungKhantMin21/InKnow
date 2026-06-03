import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Sessions", path: "/sessions" },
  { label: "Knowledge", path: "/knowledge" },
  { label: "Inno", path: "/inno" },
];

const isActive = (path, location) => {
  if (path === "/sessions") {
    return (
      location.pathname === "/sessions" ||
      (location.pathname.startsWith("/sessions/") &&
        location.pathname !== "/sessions/new")
    );
  }
  if (path === "/knowledge") {
    return location.pathname.startsWith("/knowledge");
  }
  return location.pathname === path;
};

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

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
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {/* New session — action item, always first after Dashboard */}
        {NAV_ITEMS.slice(0, 1).map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`w-full text-left px-3 py-2 font-body font-light text-sm transition-colors ${
              isActive(item.path, location)
                ? "bg-ground text-ink"
                : "text-ink-2 hover:bg-ground hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}

        {/* New session — highlighted action */}
        <button
          onClick={() => navigate("/sessions/new")}
          className={`w-full text-left px-3 py-2 font-body font-light text-sm transition-colors flex items-center gap-2 ${
            location.pathname === "/sessions/new"
              ? "bg-ground text-ink"
              : "text-ink-2 hover:bg-ground hover:text-ink"
          }`}
        >
          <div
            className="bg-volt flex-shrink-0"
            style={{
              width: 5,
              height: 5,
              clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
            }}
          />
          New session
        </button>

        {/* Remaining nav items */}
        {NAV_ITEMS.slice(1).map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`w-full text-left px-3 py-2 font-body font-light text-sm transition-colors ${
              isActive(item.path, location)
                ? "bg-ground text-ink"
                : "text-ink-2 hover:bg-ground hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}

        {user?.is_manager && (
          <button
            onClick={() => navigate("/manager")}
            className={`w-full text-left px-3 py-2 font-body font-light text-sm transition-colors ${
              location.pathname === "/manager"
                ? "bg-ground text-ink"
                : "text-ink-2 hover:bg-ground hover:text-ink"
            }`}
          >
            Manager
          </button>
        )}
      </nav>

      {/* User footer */}
      <div className="px-6 py-4 border-t border-rule">
        <p className="font-body font-light text-xs text-ink-2 truncate">{user?.name}</p>
        <p className="font-mono text-[9px] tracking-wider text-ink-4 truncate mt-0.5">
          {user?.roles?.name || ""}
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
