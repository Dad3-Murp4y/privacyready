import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import Team from './pages/Team';
import VerifyEmail from './pages/VerifyEmail';
import Blog from './pages/Blog';
import BlogPostDetail from './pages/BlogPostDetail';
import CookieConsent from './components/CookieConsent';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('token');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// Reads the role claim out of the JWT payload purely for client-side
// routing/UX -- this is NOT a security boundary (a JWT payload is only
// base64-encoded, not encrypted, and this never verifies the signature).
// The actual access control is admin.ts's server-side SUPERADMIN check on
// every /admin/* API call; this only decides whether to bother rendering
// the admin shell at all.
function getJwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('token');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (getJwtRole(token) !== 'SUPERADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPostDetail />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <RequireSuperAdmin>
              <AdminDashboard />
            </RequireSuperAdmin>
          } 
        />
        <Route 
          path="/team" 
          element={
            <ProtectedRoute>
              <Team />
            </ProtectedRoute>
          } 
        />
      </Routes>
      <CookieConsent />
    </>
  );
}

export default App;
