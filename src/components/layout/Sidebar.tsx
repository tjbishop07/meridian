import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Upload,
  Wallet2,
  Target,
  FileText,
  Settings,
  Wallet,
  BarChart3,
  Code2,
} from 'lucide-react';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Import', href: '/import', icon: Upload },
  { name: 'Bookmarklet Builder', href: '/bookmarklet-builder', icon: Code2 },
  { name: 'Budgets', href: '/budgets', icon: Wallet2 },
  { name: 'Goals', href: '/goals', icon: Target },
  { name: 'Bills', href: '/bills', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
];

const secondaryNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="w-64 bg-base-100 border-r border-base-300 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-base-300">
        <Wallet className="w-8 h-8 text-primary" />
        <span className="ml-3 text-xl font-bold text-base-content">Finance</span>
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

      {/* Secondary Navigation */}
      <div className="px-3 py-4 border-t border-base-300">
        {secondaryNavigation.map((item) => {
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
      </div>
    </div>
  );
}
