import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, ClipboardCheck, BarChart3,
  AlertTriangle, FileText, Settings, ChevronLeft, ChevronRight, Menu, X, LogOut, Shield, UserPlus
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import cesLogo from '@/assets/ces-logo.png';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/audit', icon: ClipboardCheck, label: 'Audit Capture' },
  { to: '/findings', icon: AlertTriangle, label: 'Findings & Actions' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/templates', icon: Settings, label: 'Templates' },
  { to: '/users', icon: Shield, label: 'Users' },
  { to: '/onboarding', icon: UserPlus, label: 'Client Onboarding', adminOnly: true },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { profile, roles, signOut } = useAuth();

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const roleLabel = roles.length > 0
    ? roles[0].replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'User';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img src={cesLogo} alt="CES" className="h-8 w-auto" />
              <div>
                <p className="text-sm font-semibold font-display leading-tight">ECO Monitor</p>
                <p className="text-[10px] text-sidebar-foreground/60">Environmental Compliance</p>
              </div>
            </div>
          )}
          {collapsed && (
            <img src={cesLogo} alt="CES" className="h-7 w-auto mx-auto" />
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex text-sidebar-foreground/60 hover:text-sidebar-foreground p-1">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground p-1">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems
            .filter(item => !('adminOnly' in item && item.adminOnly) || roles.includes('admin'))
            .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors
                ${isActive
                  ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer with user info */}
        {!collapsed && (
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-xs font-medium">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{profile?.display_name || 'User'}</p>
                <p className="text-[10px] text-sidebar-foreground/60">{roleLabel}</p>
              </div>
              <button
                onClick={signOut}
                className="text-sidebar-foreground/40 hover:text-sidebar-foreground p-1 transition-colors"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b bg-card flex items-center px-4 gap-4 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-medium text-foreground">
              {navItems.find(n => n.to === location.pathname)?.label || 'ECO Monitor'}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Zonnebloem 132kV Project</span>
            <span className="w-2 h-2 rounded-full bg-success" />
            <span className="hidden sm:inline">Active</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
