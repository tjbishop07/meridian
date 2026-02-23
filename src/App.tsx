import { useEffect, useRef } from 'react';
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
import Browser from './pages/Browser';
import Tags from './pages/Tags';
import Toaster from './components/ui/Toaster';
import { useAutomationStore } from './store/automationStore';
import { toast } from 'sonner';

function App() {
  const welcomeShown = useRef(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const theme = await window.electron.invoke('settings:get', 'theme');
        const selectedTheme = theme || 'dark';
        document.documentElement.setAttribute('data-theme', selectedTheme);
        // Add .dark class so shadcn dark: variants activate
        const darkThemes = new Set([
          'dark', 'ghibli-studio', 'marvel', 'clean-slate', 'spotify',
          'neo-brutalism', 'marshmallow', 'art-deco', 'claude',
          'material-design', 'summer', 'vs-code',
        ]);
        if (darkThemes.has(selectedTheme)) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }

        // Save default theme if none exists
        if (!theme) {
          await window.electron.invoke('settings:set', { key: 'theme', value: 'dark' });
        }
      } catch (err) {
        console.error('Failed to load theme:', err);
        // Fallback to dark theme if loading fails
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
      }
    };
    loadTheme();

    // Show welcome message only once
    if (!welcomeShown.current) {
      welcomeShown.current = true;

      const DEFAULT_WELCOME_PROMPT =
        'Generate a single witty and funny welcome message for a personal finance app called Sprout. ' +
        'Make it money or finance related and humorous. Keep it under 120 characters. ' +
        'Return only the message text — no quotes, no explanation, no markdown.';

      const generateWelcome = async () => {
        try {
          const allSettings = await window.electron.invoke('automation-settings:get-all');
          const prompt = allSettings.prompt_welcome || DEFAULT_WELCOME_PROMPT;

          const result = await window.electron.invoke('ollama:generate', {
            model: 'llama3.2',
            prompt,
          });

          if (result.success && result.response?.trim()) {
            toast.success(result.response.trim());
            return;
          }
        } catch {
          // Fall through to fallback
        }

        // Fallback: plain date/time message
        const now = new Date();
        toast.success('Welcome to Sprout', {
          description: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
            ' · ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        });
      };

      generateWelcome();
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
          <Route path="tags" element={<Tags />} />
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
