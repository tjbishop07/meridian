import { CheckCircle, XCircle, Download, Loader, ExternalLink, Terminal, Sparkles } from 'lucide-react';
import { useOllama } from '../hooks/useOllama';

export default function OllamaSetup() {
  const {
    status,
    isChecking,
    isInstalling,
    isPulling,
    pullProgress,
    installProgress,
    homebrewInstalled,
    checkStatus,
    checkHomebrew,
    installOllama,
    startServer,
    pullModel,
    openDownloadPage,
    openHomebrewInstall,
  } = useOllama();

  if (isChecking) {
    return (
      <div className="bg-base-200/50 rounded-lg p-6 border border-base-300">
        <div className="flex items-center gap-3">
          <Loader className="w-5 h-5 animate-spin text-primary" />
          <span className="text-base-content/70">Checking Ollama status...</span>
        </div>
      </div>
    );
  }

  const isReady = status.installed && status.running && status.hasVisionModel;

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <div className="bg-base-200/50 rounded-lg p-6 border border-base-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Ollama Setup
          </h3>
          <button
            onClick={checkStatus}
            className="text-sm text-primary hover:underline"
            disabled={isChecking}
          >
            Refresh Status
          </button>
        </div>

        <div className="space-y-3">
          {/* Installation Status */}
          <div className="flex items-center gap-3">
            {status.installed ? (
              <CheckCircle className="w-5 h-5 text-success" />
            ) : (
              <XCircle className="w-5 h-5 text-error" />
            )}
            <span className="text-base-content/80">
              Ollama {status.installed ? 'installed' : 'not installed'}
            </span>
          </div>

          {/* Server Status */}
          {status.installed && (
            <div className="flex items-center gap-3">
              {status.running ? (
                <CheckCircle className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-error" />
              )}
              <span className="text-base-content/80">
                Server {status.running ? 'running' : 'not running'}
              </span>
            </div>
          )}

          {/* AI Model Status */}
          {status.installed && status.running && (
            <div className="flex items-center gap-3">
              {status.hasVisionModel ? (
                <CheckCircle className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-error" />
              )}
              <span className="text-base-content/80">
                AI model {status.hasVisionModel ? 'ready' : 'not downloaded'}
              </span>
              {status.availableModels.length > 0 && (
                <span className="text-xs text-base-content/60">
                  ({status.availableModels.length} {status.availableModels.length === 1 ? 'model' : 'models'})
                </span>
              )}
            </div>
          )}

          {/* Show which models are installed */}
          {status.installed && status.running && status.availableModels.length > 0 && (
            <div className="text-xs text-base-content/60 ml-8">
              Installed: {status.availableModels.slice(0, 3).join(', ')}
              {status.availableModels.length > 3 && ` +${status.availableModels.length - 3} more`}
            </div>
          )}
        </div>

        {/* Ready State */}
        {isReady && (
          <div className="mt-4 p-3 bg-success/10 border border-success/30 rounded-lg">
            <p className="text-success text-sm font-medium">
              ✨ Ollama is ready! You can now use AI scraping.
            </p>
          </div>
        )}
      </div>

      {/* Setup Steps */}
      {!isReady && (
        <div className="bg-base-200/50 rounded-lg p-6 border border-base-300">
          <h4 className="font-semibold mb-4">Setup Steps:</h4>
          <div className="space-y-4">
            {/* Step 0: Check/Install Homebrew (if Ollama not installed) */}
            {!status.installed && homebrewInstalled === false && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-warning/20 text-warning flex items-center justify-center font-semibold text-sm">
                    !
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-base-content mb-2">Homebrew Not Found</p>
                    <p className="text-sm text-base-content/70 mb-3">
                      Homebrew is required to install Ollama. Install it first, then refresh this page.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={openHomebrewInstall}
                        className="btn btn-sm btn-warning"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Install Homebrew
                      </button>
                      <button
                        onClick={checkHomebrew}
                        className="btn btn-sm btn-ghost"
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="mt-3 p-3 bg-base-300 rounded text-xs font-mono">
                      Or run in Terminal:<br/>
                      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Install Ollama */}
            {!status.installed && homebrewInstalled !== false && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-base-content mb-2">Install Ollama</p>
                    <p className="text-sm text-base-content/70 mb-3">
                      {homebrewInstalled === null ? 'Checking for Homebrew...' : 'Install Ollama via Homebrew or download manually'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={installOllama}
                        disabled={isInstalling || homebrewInstalled === null}
                        className="btn btn-sm btn-primary"
                      >
                        {isInstalling ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Installing...
                          </>
                        ) : (
                          <>
                            <Terminal className="w-4 h-4" />
                            Install via Homebrew
                          </>
                        )}
                      </button>
                      <button
                        onClick={openDownloadPage}
                        className="btn btn-sm btn-ghost"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Download Manually
                      </button>
                    </div>
                    {installProgress && (
                      <div className="mt-3 p-3 bg-base-300 rounded font-mono text-xs max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {installProgress}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Start Server */}
            {status.installed && !status.running && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-base-content mb-2">Start Ollama Server</p>
                    <p className="text-sm text-base-content/70 mb-3">
                      Start the Ollama server to enable AI features
                    </p>
                    <button
                      onClick={startServer}
                      className="btn btn-sm btn-primary"
                    >
                      <Terminal className="w-4 h-4" />
                      Start Server
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Download Vision Model */}
            {status.installed && status.running && !status.hasVisionModel && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-base-content mb-2">Download AI Model</p>
                    <p className="text-sm text-base-content/70 mb-3">
                      Download llama3.2 (~2GB) for HTML analysis - faster and more accurate
                    </p>
                    <button
                      onClick={() => pullModel('llama3.2')}
                      disabled={isPulling}
                      className="btn btn-sm btn-primary"
                    >
                      {isPulling ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Download Model
                        </>
                      )}
                    </button>
                    {isPulling && pullProgress && (
                      <div className="mt-3 p-3 bg-base-300 rounded font-mono text-xs max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {pullProgress}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-base-content/60 space-y-1">
        <p>💡 <strong>What is Ollama?</strong> A free, local AI platform that runs on your Mac.</p>
        <p>🔒 <strong>Privacy:</strong> All data stays on your machine. No cloud services.</p>
        <p>⚡ <strong>Speed:</strong> Fast on Apple Silicon (M1/M2/M3). Slower on Intel Macs.</p>
      </div>
    </div>
  );
}
