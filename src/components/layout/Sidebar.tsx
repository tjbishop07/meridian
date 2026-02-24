import { Link, useLocation } from 'react-router-dom';
import pkg from '../../../package.json';
import {
  LayoutDashboard,
  Receipt,
  Upload,
  Wallet2,
  Target,
  FileText,
  Settings,
  BarChart3,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Tags', href: '/tags', icon: Tag },
  { name: 'Import', href: '/import', icon: Upload },
  { name: 'Budgets', href: '/budgets', icon: Wallet2 },
  { name: 'Goals', href: '/goals', icon: Target },
  { name: 'Bills', href: '/bills', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="w-64 bg-card border-r border-border/30 flex flex-col">
      {/* Logo */}
      <div className="py-8 flex flex-col items-center justify-center gap-2 border-b border-border">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          className="text-primary logo-meridian"
          style={{ width: '48px', height: '48px' }}
        >
          <line x1="2" y1="19.5" x2="22" y2="19.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.35"/>
          <path d="M3 19.5 Q12 3 21 19.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
          <circle cx="12" cy="5.5" r="1.8" fill="currentColor"/>
        </svg>
        <span className="text-4xl font-bold text-primary lowercase tracking-widest">meridian</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/70 hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Version */}
      <div className="pb-4 text-center">
        <span className="text-xs text-muted-foreground/40 tracking-widest">v{pkg.version}</span>
      </div>
    </div>
  );
}
