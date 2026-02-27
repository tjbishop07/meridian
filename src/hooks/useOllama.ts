import { useState, useEffect } from 'react';

export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  hasVisionModel: boolean;
  availableModels: string[];
  platform: string;
  error?: string;
}

export function useOllama() {
  const [status, setStatus] = useState<OllamaStatus>({
    installed: false,
    running: false,
    hasVisionModel: false,
    availableModels: [],
    platform: '',
  });
  const [isChecking, setIsChecking] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<string>('');
  const [pullPercentage, setPullPercentage] = useState<number>(0);
  const [pullStatus, setPullStatus] = useState<string>('');
  const [installProgress, setInstallProgress] = useState<string>('');
  const [homebrewInstalled, setHomebrewInstalled] = useState<boolean | null>(null);
  const [wingetInstalled, setWingetInstalled] = useState<boolean | null>(null);

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const result = await window.electron.invoke('ollama:check-status');
      setStatus(result);
    } catch (error) {
      console.error('[useOllama] Failed to check status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const checkHomebrew = async () => {
    try {
      const result = await window.electron.invoke('ollama:check-homebrew');
      setHomebrewInstalled(result.installed);
      return result.installed;
    } catch (error) {
      console.error('[useOllama] Failed to check Homebrew:', error);
      setHomebrewInstalled(false);
      return false;
    }
  };

  const checkWinget = async () => {
    try {
      const result = await window.electron.invoke('ollama:check-winget');
      setWingetInstalled(result.installed);
      return result.installed;
    } catch (error) {
      console.error('[useOllama] Failed to check winget:', error);
      setWingetInstalled(false);
      return false;
    }
  };

  const openHomebrewInstall = async () => {
    await window.electron.invoke('ollama:open-homebrew-install');
  };

  const installOllama = async () => {
    setIsInstalling(true);
    setInstallProgress('Starting installation...');

    // Listen for progress updates
    const handleProgress = (data: string) => {
      setInstallProgress((prev) => prev + data);
    };

    window.electron.on('ollama:install-progress', handleProgress);

    try {
      const result = await window.electron.invoke('ollama:install');
      if (result.success) {
        setInstallProgress('✅ Installation complete!');
        await checkStatus();
      }
      return result;
    } catch (error) {
      console.error('[useOllama] Failed to install:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      window.electron.removeListener('ollama:install-progress', handleProgress);
      setIsInstalling(false);
      setTimeout(() => setInstallProgress(''), 3000);
    }
  };

  const startServer = async () => {
    try {
      const result = await window.electron.invoke('ollama:start-server');
      if (result.success) {
        await checkStatus();
      }
      return result;
    } catch (error) {
      console.error('[useOllama] Failed to start server:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  const pullModel = async (modelName: string) => {
    setIsPulling(true);
    setPullingModel(modelName);
    setPullProgress('');
    setPullPercentage(0);
    setPullStatus('Initializing...');

    // Listen for progress updates and parse them
    const handleProgress = (data: string) => {
      // Parse Ollama output for status and percentage
      const text = data.toString();

      // Extract percentage from any line that has it (more aggressive matching)
      // Format: "pulling ... 45% ▕████▏" or just "45%"
      const percentMatch = text.match(/(\d+)%/);

      if (percentMatch) {
        const percent = parseInt(percentMatch[1]);

        // Use functional update to avoid closure issues
        setPullPercentage((prev) => {
          const newPercent = Math.min(percent, 95);
          // Only update if going forward
          return newPercent > prev ? newPercent : prev;
        });

        // Determine status based on percentage
        if (percent < 10) {
          setPullStatus('Initializing download');
        } else if (percent < 95) {
          setPullStatus(`Downloading (${percent}%)`);
        } else {
          setPullStatus('Finishing download');
        }
      }

      // Check for specific status messages
      if (text.includes('pulling manifest')) {
        setPullStatus('Pulling manifest');
        setPullPercentage((prev) => Math.max(prev, 5));
      } else if (text.includes('verifying')) {
        setPullStatus('Verifying download');
        setPullPercentage(96);
      } else if (text.includes('writing manifest')) {
        setPullStatus('Writing manifest');
        setPullPercentage(98);
      } else if (text.includes('success')) {
        setPullStatus('Download complete!');
        setPullPercentage(100);
      }

      // Keep raw progress for debugging (console only)
      console.log('[Ollama Pull]', text.trim());
    };

    window.electron.on('ollama:pull-progress', handleProgress);

    try {
      const result = await window.electron.invoke('ollama:pull-model', modelName);
      if (result.success) {
        setPullStatus('✅ Download complete!');
        setPullPercentage(100);
        await checkStatus();
      }
      return result;
    } catch (error) {
      console.error('[useOllama] Failed to pull model:', error);
      setPullStatus('❌ Download failed');
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      window.electron.removeListener('ollama:pull-progress', handleProgress);
      setTimeout(() => {
        setIsPulling(false);
        setPullingModel(null);
        setPullProgress('');
        setPullPercentage(0);
        setPullStatus('');
      }, 3000);
    }
  };

  const openDownloadPage = async () => {
    await window.electron.invoke('ollama:open-download-page');
  };

  useEffect(() => {
    checkStatus();
    checkHomebrew();
    checkWinget();
  }, []);

  return {
    status,
    isChecking,
    isInstalling,
    isPulling,
    pullingModel,
    pullProgress,
    pullPercentage,
    pullStatus,
    installProgress,
    homebrewInstalled,
    wingetInstalled,
    checkStatus,
    checkHomebrew,
    checkWinget,
    installOllama,
    startServer,
    pullModel,
    openDownloadPage,
    openHomebrewInstall,
  };
}
