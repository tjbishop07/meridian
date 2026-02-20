import { CheckCircle, XCircle, Download, Loader, ExternalLink, Terminal, Sparkles } from 'lucide-react';
import { useOllama } from '../hooks/useOllama';
import { Button } from '@/components/ui/button';

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
      <div className="bg-muted/50 rounded-lg p-6 border border-border">
        <div className="flex items-center gap-3">
          <Loader className="w-5 h-5 animate-spin text-primary" />
          <span className="text-muted-foreground">Checking Ollama status...</span>
        </div>
      </div>
    );
  }

  const isReady = status.installed && status.running && status.hasVisionModel;

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <div className="bg-muted/50 rounded-lg p-6 border border-border">
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
              <XCircle className="w-5 h-5 text-destructive" />
            )}
            <span className="text-foreground">
              Ollama {status.installed ? 'installed' : 'not installed'}
            </span>
          </div>

          {/* Server Status */}
          {status.installed && (
            <div className="flex items-center gap-3">
              {status.running ? (
                <CheckCircle className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive" />
              )}
              <span className="text-foreground">
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
                <XCircle className="w-5 h-5 text-destructive" />
              )}
              <span className="text-foreground">
                AI model {status.hasVisionModel ? 'ready' : 'not downloaded'}
              </span>
              {status.availableModels.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({status.availableModels.length} {status.availableModels.length === 1 ? 'model' : 'models'})
                </span>
              )}
            </div>
          )}

          {/* Show which models are installed */}
          {status.installed && status.running && status.availableModels.length > 0 && (
            <div className="text-xs text-muted-foreground ml-8">
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
        <div className="bg-muted/50 rounded-lg p-6 border border-border">
          <h4 className="font-semibold mb-4">Setup Steps:</h4>
          <div className="space-y-4">
            {/* Step 0: Check/Install Homebrew */}
            {!status.installed && homebrewInstalled === false && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-warning/20 text-warning flex items-center justify-center font-semibold text-sm">
                    !
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground mb-2">Homebrew Not Found</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Homebrew is required to install Ollama. Install it first, then refresh this page.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={openHomebrewInstall} className="gap-1 bg-warning text-white hover:bg-warning/90">
                        <ExternalLink className="w-4 h-4" />
                        Install Homebrew
                      </Button>
                      <Button size="sm" variant="ghost" onClick={checkHomebrew}>
                        Refresh
                      </Button>
                    </div>
                    <div className="mt-3 p-3 bg-muted rounded text-xs font-mono">
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
                    <p className="font-medium text-foreground mb-2">Install Ollama</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      {homebrewInstalled === null ? 'Checking for Homebrew...' : 'Install Ollama via Homebrew or download manually'}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={installOllama}
                        disabled={isInstalling || homebrewInstalled === null}
                        className="gap-1"
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
                      </Button>
                      <Button size="sm" variant="ghost" onClick={openDownloadPage} className="gap-1">
                        <ExternalLink className="w-4 h-4" />
                        Download Manually
                      </Button>
                    </div>
                    {installProgress && (
                      <div className="mt-3 p-3 bg-muted rounded font-mono text-xs max-h-32 overflow-y-auto whitespace-pre-wrap">
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
                    <p className="font-medium text-foreground mb-2">Start Ollama Server</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Start the Ollama server to enable AI features
                    </p>
                    <Button size="sm" onClick={startServer} className="gap-1">
                      <Terminal className="w-4 h-4" />
                      Start Server
                    </Button>
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
                    <p className="font-medium text-foreground mb-2">Download AI Model</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Download llama3.2 (~2GB) for HTML analysis - faster and more accurate
                    </p>
                    <Button size="sm" onClick={() => pullModel('llama3.2')} disabled={isPulling} className="gap-1">
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
                    </Button>
                    {isPulling && pullProgress && (
                      <div className="mt-3 p-3 bg-muted rounded font-mono text-xs max-h-40 overflow-y-auto whitespace-pre-wrap">
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
      <div className="text-xs text-muted-foreground space-y-1">
        <p>💡 <strong>What is Ollama?</strong> A free, local AI platform that runs on your Mac.</p>
        <p>🔒 <strong>Privacy:</strong> All data stays on your machine. No cloud services.</p>
        <p>⚡ <strong>Speed:</strong> Fast on Apple Silicon (M1/M2/M3). Slower on Intel Macs.</p>
      </div>
    </div>
  );
}
