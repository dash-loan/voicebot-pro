import { Outlet, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useState } from 'react';
import { LayoutDashboard, Users, FileText, Phone, Megaphone, BarChart3, LogOut, Menu, Activity, TrendingUp, Settings, Flame, PhoneCall, CalendarDays, Bot, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BlockedUserScreen from '@/components/BlockedUserScreen';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';

const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'דשבורד' },
  { to: '/admin/clients', icon: Users, label: 'ניהול לקוחות' },
  { to: '/campaigns', icon: Megaphone, label: 'קמפיינים' },
  { to: '/calendar', icon: CalendarDays, label: 'לוח תכנון' },
  { to: '/admin/scripts', icon: FileText, label: 'תסריטים' },
  { to: '/admin/numbers', icon: Phone, label: 'מספרים' },
  { to: '/admin/profitability', icon: TrendingUp, label: 'רווחיות' },
  { to: '/admin/vapi-events', icon: Activity, label: 'לוג מערכת' },
  { to: '/results', icon: BarChart3, label: 'כל השיחות' },
  { to: '/admin/quick-dial', icon: PhoneCall, label: 'Quick Dial' },
  { to: '/admin/settings', icon: Settings, label: 'הגדרות' },
];

const clientLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'דשבורד' },
  { to: '/campaigns', icon: Megaphone, label: 'קמפיינים' },
  { to: '/calendar', icon: CalendarDays, label: 'לוח תכנון' },
  { to: '/quality-leads', icon: Flame, label: 'לידים איכותיים 🔥' },
  { to: '/results', icon: PhoneCall, label: 'כל השיחות' },
  { to: '/analytics', icon: BarChart3, label: 'אנליטיקה' },
];

export default function Layout() {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  
  if (user?.status === 'blocked') return <BlockedUserScreen />;

  const links = user?.role === 'admin' ? adminLinks : clientLinks;
  const isActive = (path) => location.pathname === path;
  const handleLogout = () => base44.auth.logout();

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      
      <aside className={`fixed lg:static inset-y-0 right-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform lg:transform-none ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'} flex flex-col`}>
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
              <Bot className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white">VoiceBot Pro</h1>
              <p className="text-xs text-sidebar-foreground/60">{user?.role === 'admin' ? 'ממשק ניהול' : 'ממשק לקוח'}</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
                isActive(link.to) ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              <link.icon className="w-5 h-5" />
              {link.label}
            </Link>
          ))}
        </nav>
        
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-sm text-sidebar-foreground/60 mb-2 px-4 truncate">{user?.full_name || user?.email}</div>
          {user?.role !== 'admin' && (
            <button onClick={() => setChangePasswordOpen(true)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all w-full">
              <KeyRound className="w-5 h-5" />
              שינוי סיסמה
            </button>
          )}
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-red-400 transition-all w-full">
            <LogOut className="w-5 h-5" />
            התנתקות
          </button>
        </div>
        <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
      </aside>
      
      <main className="flex-1 overflow-auto">
        <div className="lg:hidden p-4 border-b border-border bg-card sticky top-0 z-30 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold">VoiceBot Pro</span>
        </div>
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}