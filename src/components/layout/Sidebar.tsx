import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Upload,
  Wallet2,
  Target,
  FileText,
  Settings,
  BarChart3,
} from 'lucide-react';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
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
    <div className="w-64 bg-base-100 border-r border-base-300 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-base-300">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="w-12 h-12 text-primary logo-sprout">
          <path d="M12 21 C11.5 18 12.5 14 12 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M12 15 C9.5 14 7 11.5 8 8.5 C10.5 8.5 12.5 11.5 12 15Z" fill="currentColor" opacity="0.7"/>
          <path d="M12 11 C14.5 9.5 17 7 15.5 4.5 C13 4.5 11 7.5 12 11Z" fill="currentColor"/>
        </svg>
        <span className="ml-3 text-3xl font-bold text-primary lowercase">Sprout</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={clsx(
                'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-base-content/80 hover:bg-base-200'
              )}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
