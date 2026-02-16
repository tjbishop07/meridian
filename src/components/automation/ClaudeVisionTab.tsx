import { Key, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useAutomationSettings } from '../../hooks/useAutomationSettings';

export function ClaudeVisionTab() {
  const { settings, loading, saving, updateSettings } = useAutomationSettings();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-base-content/50" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-base-100 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-base-content mb-4">
          Claude Vision AI Configuration
        </h3>
        <p className="text-sm text-base-content/70 mb-6">
          Configure Claude AI for vision-based transaction scraping. Claude reads transaction pages like a human,
          making it resilient to website changes.
        </p>

        {/* Info Notice */}
        <div className="mb-6 p-4 bg-info/10 border border-info/30 rounded-lg">
          <p className="text-sm text-base-content/70">
            Configure your Claude API credentials below. Select "Claude Vision AI" as the scraping method in the Browser Automation tab to use this service.
          </p>
        </div>

        {/* Claude API Key */}
        {settings.vision_provider === 'claude' && (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-base-content/80 mb-2">
                <Key className="w-4 h-4 inline mr-1" />
                Claude API Key
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={settings.claude_api_key}
                  onChange={(e) => updateSettings({ claude_api_key: e.target.value })}
                  placeholder="sk-ant-api..."
                  className="flex-1 px-4 py-2.5 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content font-mono text-sm"
                />
                {saving && (
                  <div className="flex items-center px-4 py-2.5 bg-success/10 text-success rounded-lg">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-base-content/60">
                Get your API key from{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  console.anthropic.com/settings/keys
                </a>
              </p>
            </div>

            {/* Claude Model Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-base-content/80 mb-2">
                Claude Model
              </label>
              <select
                value={settings.claude_model || 'claude-sonnet-4-5-20250929'}
                onChange={(e) => updateSettings({ claude_model: e.target.value })}
                className="w-full px-4 py-2.5 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
              >
                <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Recommended - Latest & Most Accurate)</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (October 2024)</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus (Most Capable)</option>
                <option value="claude-3-sonnet-20240229">Claude 3 Sonnet (Balanced)</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fastest & Cheapest)</option>
              </select>
              <p className="mt-2 text-xs text-base-content/60">
                Claude Sonnet 4.5 offers the best balance of speed, accuracy, and cost for transaction scraping.
              </p>
            </div>
          </>
        )}

        {/* Error Recovery Settings */}
        <div className="border-t border-base-300 pt-6 mb-6">
          <h3 className="text-sm font-semibold text-base-content/80 uppercase tracking-wide mb-4">
            Error Recovery
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-2">
                Retry Attempts
              </label>
              <select
                value={settings.retry_attempts}
                onChange={(e) => updateSettings({ retry_attempts: Number(e.target.value) })}
                className="w-full px-4 py-2.5 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
              >
                <option value="1">1 (No Retries)</option>
                <option value="2">2</option>
                <option value="3">3 (Recommended)</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
              <p className="mt-1 text-xs text-base-content/60">
                Number of times to retry failed steps
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-2">
                Retry Delay
              </label>
              <select
                value={settings.retry_delay_ms}
                onChange={(e) => updateSettings({ retry_delay_ms: Number(e.target.value) })}
                className="w-full px-4 py-2.5 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
              >
                <option value="1000">1 second</option>
                <option value="2000">2 seconds (Recommended)</option>
                <option value="3000">3 seconds</option>
                <option value="5000">5 seconds</option>
              </select>
              <p className="mt-1 text-xs text-base-content/60">
                Base delay between retry attempts (uses exponential backoff)
              </p>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        {settings.claude_api_key ? (
          <div className="p-4 bg-success/10 border border-success/30 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-success" />
            <div>
              <p className="text-sm font-medium text-success">Claude API Configured</p>
              <p className="text-xs text-base-content/70 mt-0.5">
                {settings.vision_provider === 'claude'
                  ? 'Currently active - automations will use Claude Vision AI'
                  : 'Ready to use - select "Claude Vision AI" in Browser Automation tab'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-3">
            <XCircle className="w-5 h-5 text-warning" />
            <div>
              <p className="text-sm font-medium text-warning">API Key Required</p>
              <p className="text-xs text-base-content/70 mt-0.5">
                Add your Claude API key above to enable Claude Vision AI scraping
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
