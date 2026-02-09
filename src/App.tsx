import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Import from './pages/Import';
import Budgets from './pages/Budgets';
import Goals from './pages/Goals';
import Bills from './pages/Bills';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { Automation } from './pages/Automation';
import Browser from './pages/Browser';
import Toaster from './components/ui/Toaster';

function App() {
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const theme = await window.electron.invoke('settings:get', 'theme');
        const selectedTheme = theme || 'dark';
        document.documentElement.setAttribute('data-theme', selectedTheme);

        // Save default theme if none exists
        if (!theme) {
          await window.electron.invoke('settings:set', { key: 'theme', value: 'dark' });
        }
      } catch (err) {
        console.error('Failed to load theme:', err);
        // Fallback to dark theme if loading fails
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    };
    loadTheme();
  }, []);

  return (
    <HashRouter>
      <Toaster />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="import" element={<Import />} />
          <Route path="automation" element={<Automation />} />
          <Route path="browser" element={<Browser />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="goals" element={<Goals />} />
          <Route path="bills" element={<Bills />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
