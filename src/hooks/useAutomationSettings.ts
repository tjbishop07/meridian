import { useState, useEffect } from 'react';

export interface AutomationSettings {
  vision_provider: 'claude' | 'ollama' | 'none';
  claude_api_key: string;
  claude_model?: string;
  retry_attempts: number;
  retry_delay_ms: number;
  schedule_enabled: boolean;
  schedule_cron: string;
  scraping_prompt?: string;
  prompt_welcome?: string;
  prompt_auto_tag?: string;
  auto_tag_model?: string;
}

export function useAutomationSettings() {
  const [settings, setSettings] = useState<AutomationSettings>({
    vision_provider: 'none',
    claude_api_key: '',
    claude_model: 'claude-3-5-sonnet-20241022',
    retry_attempts: 3,
    retry_delay_ms: 2000,
    schedule_enabled: false,
    schedule_cron: '0 6 * * *',
    scraping_prompt: '',
    prompt_welcome: '',
    prompt_auto_tag: '',
    auto_tag_model: 'llama3.2',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const loadedSettings = await window.electron.invoke('automation-settings:get-all');
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load automation settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<AutomationSettings>) => {
    try {
      setSaving(true);

      // Convert to string format for database
      const stringUpdates: Record<string, string> = {};
      for (const [key, value] of Object.entries(updates)) {
        stringUpdates[key] = String(value);
      }

      await window.electron.invoke('automation-settings:update', stringUpdates);

      // Update local state
      setSettings(prev => ({ ...prev, ...updates }));
    } catch (error) {
      console.error('Failed to update automation settings:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const setSetting = async (key: keyof AutomationSettings, value: any) => {
    try {
      await window.electron.invoke('automation-settings:set', key, String(value));
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      console.error('Failed to set automation setting:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    loading,
    saving,
    updateSettings,
    setSetting,
    loadSettings,
  };
}
