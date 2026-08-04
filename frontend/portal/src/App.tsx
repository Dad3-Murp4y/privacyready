import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import Settings from './pages/Settings';
import Team from './pages/Team';
import VerifyEmail from './pages/VerifyEmail';
import Blog from './pages/Blog';
import BlogPostDetail from './pages/BlogPostDetail';
import PublicDsr from './pages/PublicDsr';
import CookieConsent from './components/CookieConsent';
import { useState, useEffect } from 'react';

function MaintenanceBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      const baseUrl = import.meta.env.VITE_API_URL || 'https://api.privacyready.co.uk';
      const apiUrl = `${baseUrl}/health`;
      
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const resp = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeout);
        
        if (!resp.ok) {
          setIsOffline(true);
        } else {
          setIsOffline(false);
        }
      } catch (err) {
        setIsOffline(true);
      }
    };
    
    checkHealth();
    // Poll every 30 seconds just in case it comes back online
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!isOffline) return null;

  return (
    <div className="global-maintenance-banner">
      <span className="maintenance-icon">🛠️</span>
      <p>
        <strong>Maintenance Mode:</strong> The portal is currently offline for scheduled maintenance. Login and data access are temporarily unavailable.
      </p>
    </div>
  );
}

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
    const payload = token.split('.')[1] || token;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const decoded = JSON.parse(atob(padded));
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
      <MaintenanceBanner />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPostDetail />} />
        <Route path="/public/dsr" element={<PublicDsr />} />
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
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } 
        />
      </Routes>
      <CookieConsent />
    </>
  );
}

export default App;
