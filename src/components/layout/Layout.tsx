import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Ticker from '../ui/Ticker';

export default function Layout() {
  return (
    <div className="flex h-screen bg-base-200">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
        <Ticker />
      </div>
    </div>
  );
}
