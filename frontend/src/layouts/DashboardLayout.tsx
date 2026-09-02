import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks';
import { logout } from '../features/auth/authSlice';
import {
  LayoutDashboard, FolderGit2, PlayCircle, Settings,
  ChevronLeft, ChevronRight, LogOut, Zap, Bell,
  ClipboardList, Brain, ListChecks, ShieldCheck, FileCode2, Sparkles, PieChart, Users
} from 'lucide-react';

const NAV = [
  { to: '/dashboard',              icon: LayoutDashboard, label: 'Dashboard',  end: true },
  { to: '/dashboard/projects',     icon: FolderGit2,      label: 'Projects' },
  { to: '/dashboard/requirements', icon: ClipboardList,   label: 'Requirements' },
  { to: '/dashboard/test-plans',   icon: Brain,           label: 'AI Test Plans' },
  { to: '/dashboard/scenarios',    icon: ListChecks,      label: 'Scenarios' },
  { to: '/dashboard/approvals',    icon: ShieldCheck,     label: 'Approvals' },
  { to: '/dashboard/generated',    icon: FileCode2,       label: 'Generated Tests' },
  { to: '/dashboard/runs',         icon: PlayCircle,      label: 'Test Runs' },
  { to: '/dashboard/healing',      icon: Sparkles,        label: 'AI Healing' },
  { to: '/dashboard/coverage',     icon: PieChart,        label: 'Coverage' },
  { to: '/dashboard/organizations',icon: Users,           label: 'Organizations' },
  { to: '/dashboard/settings',     icon: Settings,        label: 'Settings' },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector(s => s.auth.user);

  React.useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return undefined;
    const api = import.meta.env.VITE_API_URL || '';
    const url = `${String(api).replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);
    return () => socket.close();
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* ── Sidebar ── */}
      <aside
        className={`flex flex-col transition-all duration-300 border-r`}
        style={{
          width: collapsed ? '64px' : '240px',
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: 'var(--color-border)', minHeight: '64px' }}>
          <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Zap size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div>
              <span className="font-bold text-sm gradient-text">TestFlow</span>
              <div className="text-xs text-muted">AI Quality Engineering</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User / Logout */}
        <div className="p-3 border-t space-y-1" style={{ borderColor: 'var(--color-border)' }}>
          {!collapsed && user && (
            <div className="px-3 py-2 rounded-lg mb-2" style={{ background: 'var(--color-surface2)' }}>
              <div className="text-xs font-medium truncate">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-muted truncate capitalize">{user.subscriptionTier} plan</div>
            </div>
          )}
          <button onClick={handleLogout}
            className="sidebar-link w-full hover:text-red-400">
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute bottom-20 -right-3 w-6 h-6 rounded-full border flex items-center justify-center text-xs transition-colors"
          style={{ background: 'var(--color-surface2)', borderColor: 'var(--color-border)' }}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', height: '64px' }}>
          <div />
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'var(--color-surface2)' }}>
              <Bell size={16} className="text-muted" />
            </button>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
