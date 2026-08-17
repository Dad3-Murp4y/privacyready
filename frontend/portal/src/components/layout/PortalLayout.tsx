import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Activity, Award, Clock, FileCheck, GraduationCap, LayoutGrid, Layers, Settings, ShieldAlert, Sliders, Users, Webhook } from 'lucide-react';
import { AppShell } from './AppShell';
import { useAuth } from '../../contexts/AuthContext';
import type { PortalContextValue } from '../../contexts/PortalContext';

const navItems = [
  { id: '/dashboard', label: 'Overview', icon: <LayoutGrid size={18} /> },
  { id: '/scans', label: 'Website scans', icon: <Activity size={18} /> },
  { id: '/findings', label: 'Findings', icon: <ShieldAlert size={18} />, premium: true },
  { id: '/data-requests', label: 'Data requests', icon: <Clock size={18} />, premium: true },
  { id: '/policies', label: 'Policies', icon: <FileCheck size={18} />, premium: true },
  { id: '/vendors', label: 'Vendors', icon: <Layers size={18} />, premium: true },
  { id: '/breaches', label: 'Breaches', icon: <ShieldAlert size={18} />, premium: true },
  { id: '/consent', label: 'Consent', icon: <Sliders size={18} />, premium: true },
  { id: '/training', label: 'Training', icon: <GraduationCap size={18} />, premium: true },
  { id: '/integrations', label: 'Integrations', icon: <Webhook size={18} />, premium: true },
  { id: '/certificate', label: 'Certificate', icon: <Award size={18} />, premium: true },
  { id: '/team', label: 'Team', icon: <Users size={18} /> },
  { id: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

export default function PortalLayout({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState('');
  const previousPath = useRef(location.pathname);

  const refreshSubscription = useCallback(async (showLoading = false) => {
    if (showLoading) setSubscriptionLoading(true);
    setSubscriptionError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/subscription-status`, { credentials: 'include' });
      if (!response.ok) throw new Error('Subscription status could not be verified.');
      const data = await response.json();
      setIsPremium(data.subscriptionStatus === 'active' || data.isPremium === true);
    } catch (caught) {
      setIsPremium(false);
      setSubscriptionError(caught instanceof Error ? caught.message : 'Subscription status could not be verified.');
    } finally { setSubscriptionLoading(false); }
  }, []);

  const invalidatePremium = useCallback(() => {
    setIsPremium(false);
    setSubscriptionError('');
  }, []);

  useEffect(() => {
    const verifyReturn = async () => {
      const sessionId = new URLSearchParams(window.location.search).get('session_id');
      if (sessionId) {
        await fetch(`${import.meta.env.VITE_API_URL}/api/billing/verify-session`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      await refreshSubscription(true);
    };
    void verifyReturn();
  }, [refreshSubscription]);

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      void refreshSubscription();
    }
  }, [location.pathname, refreshSubscription]);

  useEffect(() => {
    const onFocus = () => { void refreshSubscription(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshSubscription]);

  useEffect(() => {
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.app-shell__content .route-heading')?.focus());
  }, [location.pathname]);

  const startCheckout = async (plan: 'starter' | 'growth' = 'starter') => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/create-checkout-session`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, returnUrl: window.location.origin + location.pathname }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) throw new Error(data.error || 'Checkout could not be started.');
    window.location.assign(data.url);
  };

  const active = navItems.find((item) => location.pathname === item.id || (item.id !== '/dashboard' && location.pathname.startsWith(`${item.id}/`)))?.id ?? '';
  return <AppShell navItems={navItems} activeNav={active} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} onNavigate={navigate} onNotifications={() => setNotificationsOpen((open) => !open)} userName={user?.fullName || 'Account user'} organisation={user?.organizationName || 'Your organisation'} isPremium={isPremium} onUpgrade={() => { void startCheckout(); }} onLogout={() => { void logout().then(() => navigate('/login')); }}>
    {notificationsOpen && <section className="notification-panel" aria-label="Notifications"><p className="notification-panel__empty">You have no notifications.</p></section>}
    {children ?? <Outlet context={{ isPremium, subscriptionLoading, subscriptionError, startCheckout, invalidatePremium } satisfies PortalContextValue} />}
  </AppShell>;
}
