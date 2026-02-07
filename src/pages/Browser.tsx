import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home, Download, FileText, Circle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';

export default function Browser() {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBrowserAttached, setIsBrowserAttached] = useState(false);
  const [downloadedFile, setDownloadedFile] = useState<{ filePath: string; fileName: string } | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<number | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recordingToSave, setRecordingToSave] = useState<any>(null);
  const [recipeName, setRecipeName] = useState('');
  const [recipeInstitution, setRecipeInstitution] = useState('');
  const [showSensitiveInputModal, setShowSensitiveInputModal] = useState(false);
  const [sensitiveInputValue, setSensitiveInputValue] = useState('');
  const [sensitiveInputLabel, setSensitiveInputLabel] = useState('');
  const [sensitiveInputResolver, setSensitiveInputResolver] = useState<((value: string) => void) | null>(null);
  const processedDownloads = useRef<Set<string>>(new Set());
  const isProcessingDownload = useRef(false);

  const { accounts, loadAccounts } = useStore();
  const navigate = useNavigate();

  // Fetch accounts and saved recipes on mount
  useEffect(() => {
    loadAccounts();
    loadSavedRecipes();
  }, [loadAccounts]);

  const loadSavedRecipes = async () => {
    try {
      const recipes = await window.electron.invoke('export-recipes:get-all');
      setSavedRecipes(recipes);
    } catch (error) {
      console.error('Failed to load export recipes:', error);
    }
  };

  // Save current URL to settings whenever it changes
  useEffect(() => {
    if (currentUrl && currentUrl !== 'about:blank') {
      window.electron.invoke('settings:set', {
        key: 'browser:lastUrl',
        value: currentUrl,
      }).catch(error => {
        console.error('Failed to save last URL:', error);
      });
    }
  }, [currentUrl]);

  // Attach or show browser on mount
  useEffect(() => {
    const initBrowser = async () => {
      try {
        // Try to show existing browser first
        const showResult = await window.electron.invoke('browser:show');

        if (showResult.success) {
          console.log('[Browser] Showed existing browser view');
          setIsBrowserAttached(true);

          // Load current URL from settings
          const lastUrl = await window.electron.invoke('settings:get', 'browser:lastUrl');
          if (lastUrl) {
            setUrl(lastUrl);
            setCurrentUrl(lastUrl);
          }
        } else {
          // Browser doesn't exist yet - create it
          console.log('[Browser] Creating new browser view');
          const lastUrl = await window.electron.invoke('settings:get', 'browser:lastUrl');
          const initialUrl = lastUrl || 'about:blank';

          const attachResult = await window.electron.invoke('browser:attach', initialUrl);

          if (attachResult.success) {
            setIsBrowserAttached(true);

            if (lastUrl) {
              setUrl(lastUrl);
              setCurrentUrl(lastUrl);
            }
          } else {
            console.error('Failed to attach browser');
            toast.error('Failed to load browser');
          }
        }
      } catch (error) {
        console.error('Failed to initialize browser:', error);
        toast.error('Failed to load browser');
      }
    };

    initBrowser();

    // Listen for URL changes
    const handleUrlChange = (newUrl: string) => {
      setCurrentUrl(newUrl);
      setUrl(newUrl);
    };

    const handleLoading = (loading: boolean) => {
      setIsLoading(loading);
    };

    const handleDownload = (data: { filePath: string; fileName: string }) => {
      console.log('[Browser] CSV downloaded:', data);

      // Prevent duplicate processing
      if (isProcessingDownload.current || processedDownloads.current.has(data.filePath)) {
        console.log('[Browser] Ignoring duplicate download event');
        return;
      }

      isProcessingDownload.current = true;
      processedDownloads.current.add(data.filePath);

      setDownloadedFile(data);

      // Hide browser view so modal is visible
      window.electron.invoke('browser:hide').catch(err => {
        console.error('Failed to hide browser for modal:', err);
      });

      // Reset processing flag after a short delay
      setTimeout(() => {
        isProcessingDownload.current = false;
      }, 1000);
    };

    const handleError = (error: { code: number; description: string; url: string }) => {
      console.error('[Browser] Navigation error:', error);
      // Only show error for significant issues (not cancelled loads)
      if (error.code !== -3) {
        toast.error(`Failed to load page: ${error.description}`);
      }
    };

    window.electron.on('browser:url-changed', handleUrlChange);
    window.electron.on('browser:loading', handleLoading);
    window.electron.on('csv:downloaded', handleDownload);
    window.electron.on('browser:error', handleError);

    // Cleanup on unmount - hide browser instead of destroying it
    return () => {
      console.log('[Browser] Component unmounting, hiding browser view');
      window.electron.removeListener('browser:url-changed', handleUrlChange);
      window.electron.removeListener('browser:loading', handleLoading);
      window.electron.removeListener('csv:downloaded', handleDownload);
      window.electron.removeListener('browser:error', handleError);

      // Hide browser view (keep it alive for next visit)
      window.electron.invoke('browser:hide').catch(err => {
        console.error('Failed to hide browser:', err);
      });
    };
  }, []);

  const handleNavigate = async (targetUrl?: string) => {
    if (!isBrowserAttached) {
      toast.error('Browser is not ready yet');
      return;
    }

    const urlToLoad = targetUrl || url;
    if (!urlToLoad || urlToLoad.trim() === '') {
      return;
    }

    // Add https:// if no protocol specified
    let finalUrl = urlToLoad;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('about:')) {
      finalUrl = 'https://' + finalUrl;
    }

    try {
      await window.electron.invoke('browser:navigate', finalUrl);
      setCurrentUrl(finalUrl);
      setUrl(finalUrl);
    } catch (error) {
      console.error('Failed to navigate:', error);
      toast.error('Failed to load page');
    }
  };

  const handleBack = async () => {
    await window.electron.invoke('browser:back');
  };

  const handleForward = async () => {
    await window.electron.invoke('browser:forward');
  };

  const handleReload = async () => {
    await window.electron.invoke('browser:reload');
  };

  const handleHome = () => {
    handleNavigate('https://google.com');
  };

  const promptForSensitiveInput = (label: string): Promise<string> => {
    return new Promise((resolve) => {
      // Hide browser so modal is visible
      window.electron.invoke('browser:hide');

      setSensitiveInputLabel(label);
      setSensitiveInputValue('');
      setShowSensitiveInputModal(true);
      setSensitiveInputResolver(() => resolve);
    });
  };

  const handleSensitiveInputSubmit = () => {
    if (sensitiveInputResolver) {
      sensitiveInputResolver(sensitiveInputValue);
      setSensitiveInputResolver(null);
      setShowSensitiveInputModal(false);
      setSensitiveInputValue('');

      // Show browser again
      window.electron.invoke('browser:show');
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipe) {
      toast.error('Please select a recipe to delete');
      return;
    }

    const recipe = savedRecipes.find(r => r.id === selectedRecipe);
    if (!recipe) return;

    if (confirm(`Delete recipe "${recipe.name}"?\n\nThis cannot be undone.`)) {
      try {
        await window.electron.invoke('export-recipes:delete', selectedRecipe);
        toast.success('Recipe deleted');
        setSelectedRecipe(null);
        loadSavedRecipes();
      } catch (error) {
        console.error('Failed to delete recipe:', error);
        toast.error('Failed to delete recipe');
      }
    }
  };

  const handleReplayRecipe = async () => {
    if (!selectedRecipe) {
      toast.error('Please select a recipe to replay');
      return;
    }

    try {
      const recipe = await window.electron.invoke('export-recipes:get-by-id', selectedRecipe);
      if (!recipe) {
        toast.error('Recipe not found');
        return;
      }

      toast.success(`Starting replay: ${recipe.name}`, { duration: 2000 });

      // Navigate to the URL
      await handleNavigate(recipe.url);

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Execute steps one by one
      for (let i = 0; i < recipe.steps.length; i++) {
        let step = recipe.steps[i];

        // Check if this is a sensitive input that was redacted
        if (step.type === 'input' && step.value === '[REDACTED]') {
          const userValue = await promptForSensitiveInput(
            `Enter value for ${step.element} (Step ${i + 1}/${recipe.steps.length})`
          );
          // Create a new step with the user-provided value
          step = { ...step, value: userValue };
        }

        toast.loading(`Step ${i + 1}/${recipe.steps.length}: ${step.type} on ${step.element}`, {
          duration: 1500,
        });

        const result = await window.electron.invoke('browser:execute-step', step);

        if (!result.success) {
          toast.error(`Step ${i + 1} failed: ${result.error}`);
          console.error('Step failed:', step, result.error);

          // Ask if user wants to continue
          if (!confirm(`Step ${i + 1} failed: ${result.error}\n\nContinue with remaining steps?`)) {
            break;
          }
        }

        // Wait between steps
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast.success(`Replay complete! Executed ${recipe.steps.length} steps.`);
    } catch (error) {
      console.error('Failed to replay recipe:', error);
      toast.error('Failed to replay recipe');
    }
  };

  const handleRecord = async () => {
    if (!isBrowserAttached) {
      toast.error('Browser is not ready yet');
      return;
    }

    try {
      if (isRecording) {
        // Stop recording
        console.log('[Browser UI] Stopping recording...');
        const result = await window.electron.invoke('browser:stop-recording');
        console.log('[Browser UI] Stop result:', result);
        setIsRecording(false);

        if (!result) {
          toast.error('No result from stop recording');
          return;
        }

        if (!result.success) {
          toast.error(`Stop failed: ${result.error || 'Unknown error'}`);
          return;
        }

        if (result.recording && result.recording.interactions && result.recording.interactions.length > 0) {
          // Hide browser so modal is visible
          window.electron.invoke('browser:hide');

          // Show modal to save the recording
          setRecordingToSave(result.recording);
          setRecipeName('');
          setRecipeInstitution('');
          setShowSaveModal(true);
        } else {
          toast.success('Recording stopped (no steps captured)');
        }
      } else {
        // Start recording
        await window.electron.invoke('browser:start-recording');
        setIsRecording(true);
        toast.success('Recording started - interact with the page to capture steps');
      }
    } catch (error) {
      console.error('Failed to toggle recording - full error:', error);
      toast.error(`Failed to toggle recording: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleImport = async () => {
    if (!downloadedFile || !selectedAccountId) return;

    try {
      // Detect format
      const format = await window.electron.invoke('import:detect-format', downloadedFile.filePath);

      if (!format) {
        toast.error('Could not detect CSV format. Please use manual import.');
        // Show browser again since we're staying on this page
        window.electron.invoke('browser:show');
        return;
      }

      // Navigate to import page with file path and account
      navigate('/import', {
        state: {
          filePath: downloadedFile.filePath,
          accountId: selectedAccountId,
          format,
        },
      });

      setDownloadedFile(null);
      setSelectedAccountId(null);
      // Browser will be hidden by cleanup since we're navigating away
    } catch (error) {
      console.error('Failed to start import:', error);
      toast.error('Failed to start import. Please try manual import.');
      // Show browser again since we're staying on this page
      window.electron.invoke('browser:show');
    }
  };

  const handleCancelImport = () => {
    setDownloadedFile(null);
    setSelectedAccountId(null);

    // Show browser again
    window.electron.invoke('browser:show').catch(err => {
      console.error('Failed to show browser:', err);
    });
  };

  const handleSaveRecipe = async () => {
    if (!recordingToSave || !recipeName.trim()) {
      toast.error('Please enter a recipe name');
      return;
    }

    try {
      await window.electron.invoke('export-recipes:create', {
        name: recipeName.trim(),
        url: recordingToSave.url,
        institution: recipeInstitution.trim() || undefined,
        steps: recordingToSave.interactions,
      });
      toast.success(`Saved export recipe: ${recipeName}`);
      loadSavedRecipes(); // Reload the list
      setShowSaveModal(false);
      setRecordingToSave(null);
      setRecipeName('');
      setRecipeInstitution('');

      // Show browser again
      window.electron.invoke('browser:show');
    } catch (error) {
      console.error('Failed to save recipe:', error);
      toast.error('Failed to save recipe');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Address Bar */}
      <div className="bg-base-200 p-3">
        <div className="flex items-center gap-2">
          {/* Navigation buttons */}
          <div className="flex gap-1">
            <button
              className="btn btn-sm btn-ghost"
              onClick={handleBack}
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={handleForward}
              title="Forward"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={handleReload}
              title="Reload"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={handleHome}
              title="Home"
            >
              <Home className="w-4 h-4" />
            </button>
            <button
              className={`btn btn-sm ${isRecording ? 'btn-error' : 'btn-ghost'}`}
              onClick={handleRecord}
              title={isRecording ? 'Stop Recording' : 'Record Export Steps'}
            >
              <Circle className={`w-4 h-4 ${isRecording ? 'fill-current animate-pulse' : ''}`} />
            </button>
          </div>

          {/* URL input */}
          <input
            type="text"
            className="input input-sm input-bordered flex-1 font-mono text-xs"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNavigate();
              }
            }}
            placeholder="Enter URL (e.g., bankofamerica.com) and press Enter"
          />
        </div>

        {/* Saved Recipes Row */}
        {savedRecipes.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs text-base-content/70">Saved Recipes:</label>
            <select
              className="select select-sm select-bordered flex-1 text-xs"
              value={selectedRecipe || ''}
              onChange={(e) => setSelectedRecipe(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select a saved export recipe...</option>
              {savedRecipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name} {recipe.institution && `(${recipe.institution})`} - {recipe.steps.length} steps
                </option>
              ))}
            </select>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleReplayRecipe}
              disabled={!selectedRecipe}
              title="Replay selected recipe"
            >
              Replay
            </button>
            <button
              className="btn btn-sm btn-error btn-outline"
              onClick={handleDeleteRecipe}
              disabled={!selectedRecipe}
              title="Delete selected recipe"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Browser content area - BrowserView is overlaid here by Electron */}
      <div className="flex-1 bg-base-300 relative">
        {!isBrowserAttached && (
          <div className="absolute inset-0 flex items-center justify-center text-base-content/50">
            <div className="text-center">
              <div className="loading loading-spinner loading-lg mb-4"></div>
              <p>Loading browser...</p>
            </div>
          </div>
        )}
        {isBrowserAttached && (
          <div className="absolute inset-0 flex items-center justify-center text-base-content/30 pointer-events-none">
            <p className="text-xs">Browser view active</p>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {downloadedFile && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-success" />
              Download Detected!
            </h3>

            <div className="alert alert-success mb-4">
              <FileText className="w-5 h-5" />
              <span>{downloadedFile.fileName}</span>
            </div>

            <p className="mb-4 text-sm text-base-content/70">
              Select which account to import these transactions to:
            </p>

            <div className="form-control mb-6">
              <select
                className="select select-bordered"
                value={selectedAccountId || ''}
                onChange={(e) => setSelectedAccountId(Number(e.target.value))}
              >
                <option value="">Select an account...</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.institution})
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={handleCancelImport}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!selectedAccountId}
              >
                Continue Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Recipe Modal */}
      {showSaveModal && recordingToSave && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Circle className="w-5 h-5 text-success" />
              Save Export Recipe
            </h3>

            <div className="alert alert-success mb-4">
              <span>Captured {recordingToSave.interactions.length} steps</span>
            </div>

            <p className="mb-4 text-sm text-base-content/70">
              Save this recording so you can replay it later:
            </p>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Recipe Name *</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder="e.g., Bank of America CSV Export"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text">Institution (optional)</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder="e.g., Bank of America"
                value={recipeInstitution}
                onChange={(e) => setRecipeInstitution(e.target.value)}
              />
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowSaveModal(false);
                  setRecordingToSave(null);
                  setRecipeName('');
                  setRecipeInstitution('');
                  // Show browser again
                  window.electron.invoke('browser:show');
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveRecipe}
                disabled={!recipeName.trim()}
              >
                Save Recipe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sensitive Input Modal (for replay) */}
      {showSensitiveInputModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              Enter Sensitive Value
            </h3>

            <p className="mb-4 text-sm text-base-content/70">
              {sensitiveInputLabel}
            </p>

            <div className="form-control mb-6">
              <input
                type="password"
                className="input input-bordered"
                placeholder="Enter value..."
                value={sensitiveInputValue}
                onChange={(e) => setSensitiveInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && sensitiveInputValue) {
                    handleSensitiveInputSubmit();
                  }
                }}
                autoFocus
              />
            </div>

            <div className="modal-action">
              <button
                className="btn btn-primary"
                onClick={handleSensitiveInputSubmit}
                disabled={!sensitiveInputValue}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
