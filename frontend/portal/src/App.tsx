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
import MarketingHomepage from './pages/MarketingHomepage';
import PortalLayout from './components/layout/PortalLayout';
import Scans from './pages/Scans';
import ScanDetail from './pages/ScanDetail';
import Findings from './pages/Findings';
import DataRequests from './pages/DataRequests';
import Policies from './pages/Policies';
import Vendors from './pages/Vendors';
import Breaches from './pages/Breaches';
import Consent from './pages/Consent';
import Training from './pages/Training';
import Integrations from './pages/Integrations';
import Certificate from './pages/Certificate';
import NotFound from './pages/NotFound';
import CookieConsent from './components/CookieConsent';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useState, useEffect } from 'react';
import { Wrench } from 'lucide-react';

function MaintenanceBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      const baseUrl = import.meta.env.VITE_API_URL || 'https://api.privacyready.co.uk';
      const apiUrl = `${baseUrl}/health`;
      
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const resp = await fetch(apiUrl, {
      credentials: 'include', signal: controller.signal });
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
      <Wrench className="maintenance-icon" aria-hidden="true" />
      <p>
        <strong>Maintenance Mode:</strong> The portal is currently offline for scheduled maintenance. Login and data access are temporarily unavailable.
      </p>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="route-loading" role="status">Loading customer workspace…</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;

  return children;
}

function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { isLoading, isSuperAdmin } = useAuth();

  if (isLoading) return <div className="route-loading" role="status">Loading administration…</div>;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return children;
}

function UnknownRoute() {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <div className="route-loading" role="status">Loading page…</div>;
  return isAuthenticated ? <PortalLayout><NotFound /></PortalLayout> : <NotFound publicPage />;
}

function App() {
  return (
    <AuthProvider>
      <MaintenanceBanner />
      <Routes>
        <Route path="/" element={<MarketingHomepage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPostDetail />} />
        <Route path="/public/dsr" element={<PublicDsr />} />
        <Route element={<ProtectedRoute><PortalLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scans" element={<Scans />} />
          <Route path="/scans/:id" element={<ScanDetail />} />
          <Route path="/findings" element={<Findings />} />
          <Route path="/data-requests" element={<DataRequests />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/breaches" element={<Breaches />} />
          <Route path="/consent" element={<Consent />} />
          <Route path="/training" element={<Training />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/certificate" element={<Certificate />} />
          <Route path="/team" element={<Team />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route 
          path="/admin" 
          element={
            <RequireSuperAdmin>
              <AdminDashboard />
            </RequireSuperAdmin>
          } 
        />
        <Route path="*" element={<UnknownRoute />} />
      </Routes>
      <CookieConsent />
    </AuthProvider>
  );
}

export default App;
