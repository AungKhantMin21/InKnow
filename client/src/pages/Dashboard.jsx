import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";

const NAV_ITEMS = [
  { label: "Sessions", path: "/sessions" },
  { label: "Knowledge", path: "/knowledge" },
  { label: "Copilot", path: "/copilot" },
];

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-surface flex" style={{ animation: "pageFade 200ms ease" }}>
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-rule flex flex-col flex-shrink-0">
        {/* Wordmark */}
        <div className="px-6 py-6 border-b border-rule">
          <span className="font-display font-light text-xl text-ink">In</span>
          <span className="font-display font-light italic text-xl text-volt">Know</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full text-left px-3 py-2 font-body font-light text-sm text-ink-2 hover:bg-ground hover:text-ink transition-colors"
            >
              {item.label}
            </button>
          ))}
          {user?.is_manager && (
            <button
              onClick={() => navigate("/manager")}
              className="w-full text-left px-3 py-2 font-body font-light text-sm text-ink-2 hover:bg-ground hover:text-ink transition-colors"
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

      {/* Main */}
      <main className="flex-1 px-12 py-12">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="font-display font-light text-4xl text-ink leading-tight">
            {greeting},{" "}
            <span className="font-display" style={{ fontStyle: "italic" }}>
              {user?.name?.split(" ")[0]}.
            </span>
          </h1>
          <p className="font-body font-light text-sm text-ink-3 mt-2">
            What would you like to do today?
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-4 mb-12">
          <button
            onClick={() => navigate("/sessions")}
            className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors"
          >
            Start a capture session
          </button>
          <button
            onClick={() => navigate("/copilot")}
            className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors"
          >
            Ask the copilot
          </button>
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4 whitespace-nowrap">
              Recent activity
            </span>
            <div className="flex-1 h-px bg-rule" />
          </div>

          <div className="bg-white border border-rule px-8 py-10 text-center">
            <p className="font-body font-light text-sm text-ink-3">
              No knowledge captured yet.
            </p>
            <button
              onClick={() => navigate("/sessions")}
              className="mt-4 font-body font-medium text-xs text-volt hover:underline"
            >
              Start your first capture session →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
