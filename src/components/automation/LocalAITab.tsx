import { CheckCircle, XCircle, Loader, RefreshCw, Download } from 'lucide-react';
import { useOllama } from '../../hooks/useOllama';

const AI_MODELS = [
  {
    name: 'llama3.2',
    displayName: 'Llama 3.2 (Text)',
    size: '~2GB',
    purpose: 'HTML analysis for transaction scraping',
    speed: 'Fast (2-5 sec)',
    recommended: true,
  },
  {
    name: 'llama3.2-vision',
    displayName: 'Llama 3.2 Vision',
    size: '~7GB',
    purpose: 'Screenshot-based transaction extraction',
    speed: 'Slower (5-10 sec)',
    recommended: false,
  },
  {
    name: 'mistral',
    displayName: 'Mistral 7B',
    size: '~4GB',
    purpose: 'Alternative text model',
    speed: 'Fast (2-4 sec)',
    recommended: false,
  },
];

export function LocalAITab() {
  const {
    status: ollamaStatus,
    isChecking: isCheckingOllama,
    isPulling,
    pullingModel,
    pullPercentage,
    pullStatus,
    checkStatus: checkOllamaStatus,
    pullModel,
    openHomebrewInstall,
  } = useOllama();

  return (
    <div className="space-y-6">
      <div className="bg-base-100 rounded-lg p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-semibold text-base-content mb-2">
              Local AI with Ollama
            </h3>
            <p className="text-sm text-base-content/70">
              Run AI models locally on your machine for privacy and offline access. Ollama is free and open-source.
            </p>
          </div>
          <button
            onClick={checkOllamaStatus}
            disabled={isCheckingOllama}
            className="flex items-center gap-2 px-4 py-2 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingOllama ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Ollama Status */}
        <div className="mb-6 p-4 bg-base-200 rounded-lg">
          <h4 className="font-semibold text-base-content mb-3">Ollama Status</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {ollamaStatus.installed ? (
                <CheckCircle className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-error" />
              )}
              <span className="text-sm text-base-content">
                Ollama {ollamaStatus.installed ? 'installed' : 'not installed'}
              </span>
            </div>
            {ollamaStatus.installed && (
              <div className="flex items-center gap-3">
                {ollamaStatus.running ? (
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : (
                  <XCircle className="w-5 h-5 text-error" />
                )}
                <span className="text-sm text-base-content">
                  Server {ollamaStatus.running ? 'running' : 'not running'}
                </span>
              </div>
            )}
          </div>

          {!ollamaStatus.installed && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <p className="text-sm text-warning mb-2">Ollama is not installed.</p>
              <button
                onClick={openHomebrewInstall}
                className="text-sm text-primary hover:underline"
              >
                Install via Homebrew →
              </button>
            </div>
          )}
        </div>

        {/* Coming Soon Notice */}
        <div className="mb-6 p-4 bg-info/10 border border-info/30 rounded-lg">
          <p className="text-sm font-medium text-info mb-1">🚧 Coming Soon</p>
          <p className="text-xs text-base-content/70">
            Local AI integration is under development. For now, use Claude Vision AI for the most reliable transaction scraping.
          </p>
        </div>

        {/* Available Models */}
        <div>
          <h4 className="font-semibold text-base-content mb-3">Available Models</h4>
          <div className="space-y-3">
            {AI_MODELS.map((model) => {
              const isInstalled = ollamaStatus.availableModels.some(m => {
                const modelBaseName = m.split(':')[0];
                return modelBaseName === model.name;
              });
              const isDownloading = isPulling && pullingModel === model.name;

              return (
                <div
                  key={model.name}
                  className="p-4 border border-base-300 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-base-content">{model.displayName}</h4>
                        {isInstalled && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-success/20 text-success rounded">
                            Installed
                          </span>
                        )}
                        {model.recommended && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-base-content/70 mb-2">{model.purpose}</p>
                      <div className="flex gap-4 text-xs text-base-content/60">
                        <span>Size: {model.size}</span>
                        <span>Speed: {model.speed}</span>
                      </div>
                    </div>
                    <div>
                      {isInstalled ? (
                        <div className="flex items-center gap-2 text-success">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-sm font-medium">Ready</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => pullModel(model.name)}
                          disabled={isDownloading || !ollamaStatus.running}
                          className="btn btn-sm btn-primary"
                        >
                          {isDownloading ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              Downloading...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              Download
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Show progress if downloading this model */}
                  {isDownloading && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-base-content/70">{pullStatus}</span>
                        <span className="text-xs font-medium text-base-content">{pullPercentage}%</span>
                      </div>
                      <div className="w-full bg-base-300 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${pullPercentage}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Installed Models List */}
        {ollamaStatus.availableModels.length > 0 && (
          <div className="mt-6 p-4 bg-base-200 rounded-lg">
            <h4 className="font-semibold text-base-content mb-2">Installed Models</h4>
            <div className="flex flex-wrap gap-2">
              {ollamaStatus.availableModels.map((model) => (
                <span
                  key={model}
                  className="px-3 py-1 text-xs font-medium bg-base-300 text-base-content rounded-full"
                >
                  {model}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
