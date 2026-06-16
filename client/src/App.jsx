import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Session from "./pages/Session.jsx";
import SessionsList from "./pages/SessionsList.jsx";
import SessionComplete from "./pages/SessionComplete.jsx";
import ArticleReview from "./pages/ArticleReview.jsx";
import Knowledge from "./pages/Knowledge.jsx";
import ArticleDetail from "./pages/ArticleDetail.jsx";
import Copilot from "./pages/Copilot.jsx";
import Manager from "./pages/Manager.jsx";
import AdminGroups from "./pages/admin/AdminGroups.jsx";
import AdminGroupDetail from "./pages/admin/AdminGroupDetail.jsx";
import AdminEmployees from "./pages/admin/AdminEmployees.jsx";
import AdminCoreKnowledge from "./pages/admin/AdminCoreKnowledge.jsx";
import AdminStats from "./pages/admin/AdminStats.jsx";
import AdminUsage from "./pages/admin/AdminUsage.jsx";
import AdminGaps from "./pages/admin/AdminGaps.jsx";
import JoinGroup from "./pages/JoinGroup.jsx";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
};

const ManagerRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_manager) return <Navigate to="/dashboard" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sessions"
        element={
          <ProtectedRoute>
            <SessionsList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sessions/new"
        element={
          <ProtectedRoute>
            <Session />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sessions/:id"
        element={
          <ProtectedRoute>
            <Session />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session-complete/:id"
        element={
          <ProtectedRoute>
            <SessionComplete />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session-complete/:id/review"
        element={
          <ProtectedRoute>
            <ArticleReview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge"
        element={
          <ProtectedRoute>
            <Knowledge />
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge/:id"
        element={
          <ProtectedRoute>
            <ArticleDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inno"
        element={
          <ProtectedRoute>
            <Copilot />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager"
        element={
          <ManagerRoute>
            <Manager />
          </ManagerRoute>
        }
      />
      {/* Admin portal */}
      <Route path="/admin" element={<AdminRoute><Navigate to="/admin/groups" replace /></AdminRoute>} />
      <Route path="/admin/groups" element={<AdminRoute><AdminGroups /></AdminRoute>} />
      <Route path="/admin/groups/:id" element={<AdminRoute><AdminGroupDetail /></AdminRoute>} />
      <Route path="/admin/employees" element={<AdminRoute><AdminEmployees /></AdminRoute>} />
      <Route path="/admin/core-knowledge" element={<AdminRoute><AdminCoreKnowledge /></AdminRoute>} />
      <Route path="/admin/stats" element={<AdminRoute><AdminStats /></AdminRoute>} />
      <Route path="/admin/usage" element={<AdminRoute><AdminUsage /></AdminRoute>} />
      <Route path="/admin/gaps" element={<AdminRoute><AdminGaps /></AdminRoute>} />
      <Route path="/join/:token" element={<JoinGroup />} />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
