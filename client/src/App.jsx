import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import WorkspacePage from './pages/WorkspacePage';
import BoardPage from './pages/BoardPage';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="page-center">
        <div className="loading-block" aria-busy="true" aria-label="Loading">
          <span className="loading-spinner" />
          <span className="muted">Loading…</span>
        </div>
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="page-center">
        <div className="loading-block" aria-busy="true" aria-label="Loading">
          <span className="loading-spinner" />
          <span className="muted">Loading…</span>
        </div>
      </div>
    );
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <Register />
          </PublicOnly>
        }
      />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Home />} />
        <Route path="workspace/:id" element={<WorkspacePage />} />
        <Route path="board/:id" element={<BoardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
