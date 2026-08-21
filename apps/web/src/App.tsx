import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { homeFor, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { SubmitForm } from './pages/SubmitForm';
import { Queue } from './pages/Queue';
import { Approved } from './pages/Approved';
import { Notifications } from './pages/Notifications';
import { Loader2Icon } from 'lucide-react';

function RequireRole({ role, children }: { role: 'reviewer' | 'viewer'; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-label="Loading session">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={homeFor(user)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* The public submission form works with or without a session. */}
      <Route path="/submit" element={<SubmitForm />} />
      <Route element={<Layout />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route
          path="/queue"
          element={
            <RequireRole role="reviewer">
              <Queue />
            </RequireRole>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireRole role="reviewer">
              <Notifications />
            </RequireRole>
          }
        />
        <Route
          path="/approved"
          element={
            <RequireRole role="viewer">
              <Approved />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
