import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Bell, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { Button, StatusBadge } from '../ui';

export type ShellNavItem = { id: string; label: string; icon: ReactNode; premium?: boolean };

const focusable = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sidebar({ items, active, open, onClose, onNavigate, drawerRef }: { items: ShellNavItem[]; active: string; open: boolean; onClose: () => void; onNavigate: (id: string) => void; drawerRef: React.RefObject<HTMLElement | null> }) {
  return <aside id="workspace-navigation" ref={drawerRef} className={`app-sidebar ${open ? 'is-open' : ''}`} aria-label="Workspace navigation" aria-modal={open || undefined} role={open ? 'dialog' : undefined}><div className="app-sidebar__brand"><ShieldCheck size={25} /><span>PrivacyReady</span></div><nav aria-label="Compliance workspace">{items.map((item) => <button type="button" key={item.id} className={active === item.id ? 'is-active' : ''} aria-current={active === item.id ? 'page' : undefined} onClick={() => { onNavigate(item.id); onClose(); }}><span>{item.icon}</span>{item.label}{item.premium && <StatusBadge>Pro</StatusBadge>}</button>)}</nav><p className="app-sidebar__note">UK GDPR workspace</p></aside>;
}

export function Topbar({ onMenu, menuRef, mobileOpen, onNotifications, userName, organisation, isPremium, onUpgrade, onLogout, actions }: { onMenu: () => void; menuRef: React.RefObject<HTMLButtonElement | null>; mobileOpen: boolean; onNotifications: () => void; userName: string; organisation: string; isPremium: boolean; onUpgrade: () => void; onLogout: () => void; actions?: ReactNode }) {
  return <header className="app-topbar"><Button ref={menuRef} variant="ghost" className="app-topbar__menu" onClick={onMenu} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="workspace-navigation"><Menu size={20} /></Button><div className="app-topbar__context"><strong title={organisation}>{organisation}</strong><span>Compliance workspace</span></div><div className="app-topbar__actions">{actions}<button type="button" className="icon-button" aria-label="Notifications" onClick={onNotifications}><Bell size={18} /></button>{isPremium ? <StatusBadge tone="success">Pro active</StatusBadge> : <Button variant="secondary" onClick={onUpgrade}>Upgrade</Button>}<div className="app-topbar__user"><span>{userName.slice(0, 1).toUpperCase()}</span><div><strong>{userName}</strong><small title={organisation}>{organisation}</small></div></div><Button variant="ghost" onClick={onLogout} aria-label="Log out"><LogOut size={18} /></Button></div></header>;
}

export function AppShell({ children, navItems, activeNav, mobileOpen, onMobileOpenChange, onNavigate, onNotifications, userName, organisation, isPremium, onUpgrade, onLogout, actions }: { children: ReactNode; navItems: ShellNavItem[]; activeNav: string; mobileOpen: boolean; onMobileOpenChange: (open: boolean) => void; onNavigate: (id: string) => void; onNotifications: () => void; userName: string; organisation: string; isPremium: boolean; onUpgrade: () => void; onLogout: () => void; actions?: ReactNode }) {
  const drawerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const drawer = drawerRef.current;
    const menuButton = menuRef.current;
    drawer?.querySelector<HTMLElement>(focusable)?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onMobileOpenChange(false);
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;
      const elements = Array.from(drawer.querySelectorAll<HTMLElement>(focusable));
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      menuButton?.focus();
    };
  }, [mobileOpen, onMobileOpenChange]);

  return <div className="app-shell"><Sidebar drawerRef={drawerRef} items={navItems} active={activeNav} open={mobileOpen} onClose={() => onMobileOpenChange(false)} onNavigate={onNavigate} />{mobileOpen && <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => onMobileOpenChange(false)}><X /></button>}<div className="app-shell__body" aria-hidden={mobileOpen || undefined}><Topbar menuRef={menuRef} mobileOpen={mobileOpen} onMenu={() => onMobileOpenChange(true)} onNotifications={onNotifications} userName={userName} organisation={organisation} isPremium={isPremium} onUpgrade={onUpgrade} onLogout={onLogout} actions={actions} /><main className="app-shell__content">{children}</main></div></div>;
}
