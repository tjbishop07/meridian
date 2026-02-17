import { useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Import from './pages/Import';
import Budgets from './pages/Budgets';
import Goals from './pages/Goals';
import Bills from './pages/Bills';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Browser from './pages/Browser';
import Toaster from './components/ui/Toaster';
import { useTickerStore } from './store/tickerStore';
import { useAutomationStore } from './store/automationStore';

function App() {
  const welcomeShown = useRef(false);

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

    // Show welcome message only once
    if (!welcomeShown.current) {
      welcomeShown.current = true;

      const now = new Date();
      const dayName = format(now, 'EEEE');        // "Monday"
      const dateStr = format(now, 'MMMM d, yyyy'); // "February 15, 2026"
      const timeStr = format(now, 'h:mm a');       // "3:45 PM"

      const welcomeMsg = `Welcome! Today is ${dayName}, ${dateStr} at ${timeStr}`;

      useTickerStore.getState().addMessage({
        content: welcomeMsg,
        type: 'info',
        duration: 0, // Persistent - never auto-dismiss
      });
    }

    // Set up global automation progress listener
    const handleAutomationProgress = (data: any) => {
      console.log('[App] ========== AUTOMATION PROGRESS EVENT ==========');
      console.log('[App] Recipe ID:', data.recipeId, '(type:', typeof data.recipeId, ')');
      console.log('[App] Current Step:', data.currentStep);
      console.log('[App] Total Steps:', data.totalSteps);
      console.log('[App] Status:', data.status);
      console.log('[App] Color:', data.color);

      // Convert recipeId to string to ensure consistency
      const recipeIdStr = String(data.recipeId);
      console.log('[App] Normalized Recipe ID:', recipeIdStr, '(type:', typeof recipeIdStr, ')');

      useAutomationStore.getState().updateProgress(recipeIdStr, {
        currentStep: data.currentStep,
        totalSteps: data.totalSteps,
        status: data.status,
        color: data.color
      });

      const currentProgress = useAutomationStore.getState().progress;
      console.log('[App] Store updated. Progress keys:', Object.keys(currentProgress));
      console.log('[App] Store updated. Full progress:', currentProgress);
      console.log('[App] ================================================');
    };

    const handlePlaybackComplete = () => {
      console.log('[App] Playback complete event received');
      // Don't clear progress - scraping still needs to happen
    };

    console.log('[App] ===== SETTING UP GLOBAL AUTOMATION EVENT LISTENERS =====');
    window.electron.on('automation:progress', handleAutomationProgress);
    window.electron.on('automation:playback-complete', handlePlaybackComplete);
    console.log('[App] Event listeners registered successfully');

    return () => {
      console.log('[App] Cleaning up global automation event listeners');
      window.electron.removeListener('automation:progress', handleAutomationProgress);
      window.electron.removeListener('automation:playback-complete', handlePlaybackComplete);
    };
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
          <Route path="automation" element={<Navigate to="/import" replace />} />
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
