import { useState, useEffect } from 'react';

export interface PuppeteerStatus {
  browserOpen: boolean;
  recording: boolean;
  chromeFound: boolean;
  chromePath?: string;
  error?: string;
}

export function usePuppeteerScraper() {
  const [status, setStatus] = useState<PuppeteerStatus>({
    browserOpen: false,
    recording: false,
    chromeFound: false,
  });
  const [isStarting, setIsStarting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState<any[]>([]);
  const [recordingUrl, setRecordingUrl] = useState<string>('');

  // Check for Chrome on mount
  useEffect(() => {
    checkChrome();
  }, []);

  const checkChrome = async () => {
    try {
      const result = await window.electron.invoke('puppeteer:find-chrome');
      setStatus(prev => ({
        ...prev,
        chromeFound: result.found,
        chromePath: result.path,
        error: result.error,
      }));
      return result;
    } catch (error) {
      console.error('[usePuppeteerScraper] Failed to check Chrome:', error);
      setStatus(prev => ({
        ...prev,
        chromeFound: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      return { found: false, error: 'Failed to check Chrome' };
    }
  };

  const startBrowser = async (startUrl: string, chromePath?: string, useUserProfile?: boolean) => {
    setIsStarting(true);
    try {
      const result = await window.electron.invoke('puppeteer:start-browser', {
        startUrl,
        chromePath,
        useUserProfile,
      });

      if (result.success) {
        setStatus(prev => ({ ...prev, browserOpen: true, error: undefined }));
      } else {
        setStatus(prev => ({ ...prev, error: result.error }));
      }

      return result;
    } catch (error) {
      console.error('[usePuppeteerScraper] Failed to start browser:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setStatus(prev => ({ ...prev, error: errorMsg }));
      return { success: false, error: errorMsg };
    } finally {
      setIsStarting(false);
    }
  };

  const startRecording = async () => {
    try {
      const result = await window.electron.invoke('puppeteer:start-recording');

      if (result.success) {
        setStatus(prev => ({ ...prev, recording: true, error: undefined }));
        setRecordedSteps([]);
        setRecordingUrl(result.url || '');
      } else {
        setStatus(prev => ({ ...prev, error: result.error }));
      }

      return result;
    } catch (error) {
      console.error('[usePuppeteerScraper] Failed to start recording:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setStatus(prev => ({ ...prev, error: errorMsg }));
      return { success: false, error: errorMsg };
    }
  };

  const stopRecording = async () => {
    try {
      const result = await window.electron.invoke('puppeteer:stop-recording');

      if (result.success) {
        setStatus(prev => ({ ...prev, recording: false }));
        setRecordedSteps(result.steps || []);
      }

      return result;
    } catch (error) {
      console.error('[usePuppeteerScraper] Failed to stop recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  const executeRecipe = async (recipe: { steps: any[]; extractionScript?: string }) => {
    setIsExecuting(true);
    try {
      const result = await window.electron.invoke('puppeteer:execute-recipe', recipe);
      return result;
    } catch (error) {
      console.error('[usePuppeteerScraper] Failed to execute recipe:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        transactions: [],
      };
    } finally {
      setIsExecuting(false);
    }
  };

  const extractTransactions = async () => {
    setIsExecuting(true);
    try {
      const result = await window.electron.invoke('puppeteer:extract-transactions');
      return result;
    } catch (error) {
      console.error('[usePuppeteerScraper] Failed to extract transactions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        transactions: [],
      };
    } finally {
      setIsExecuting(false);
    }
  };

  const closeBrowser = async () => {
    try {
      const result = await window.electron.invoke('puppeteer:close-browser');

      if (result.success) {
        setStatus({
          browserOpen: false,
          recording: false,
          chromeFound: status.chromeFound,
          chromePath: status.chromePath,
        });
        setRecordedSteps([]);
      }

      return result;
    } catch (error) {
      console.error('[usePuppeteerScraper] Failed to close browser:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  return {
    status,
    isStarting,
    isExecuting,
    recordedSteps,
    recordingUrl,
    checkChrome,
    startBrowser,
    startRecording,
    stopRecording,
    executeRecipe,
    extractTransactions,
    closeBrowser,
  };
}
