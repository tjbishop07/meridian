import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Ticker from '../ui/Ticker';

export default function Layout() {
  return (
    <div className="flex h-screen bg-base-200 relative">
      <Sidebar />
      <main className="flex-1 overflow-hidden pb-14">
        <Outlet />
      </main>
      <Ticker />
    </div>
  );
}
