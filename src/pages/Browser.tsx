import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home, Download, FileText, Circle, Trash2, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { EditRecipeModal } from '../components/automation/EditRecipeModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const selectClass = 'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-ring focus:outline-none disabled:opacity-50';

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
  const [editingRecipe, setEditingRecipe] = useState<any>(null);
  const processedDownloads = useRef<Set<string>>(new Set());
  const isProcessingDownload = useRef(false);

  const { accounts, loadAccounts } = useStore();
  const navigate = useNavigate();

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

  useEffect(() => {
    const initBrowser = async () => {
      try {
        const showResult = await window.electron.invoke('browser:show');

        if (showResult.success) {
          console.log('[Browser] Showed existing browser view');
          setIsBrowserAttached(true);

          const lastUrl = await window.electron.invoke('settings:get', 'browser:lastUrl');
          if (lastUrl) {
            setUrl(lastUrl);
            setCurrentUrl(lastUrl);
          }
        } else {
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

    const handleUrlChange = (newUrl: string) => {
      setCurrentUrl(newUrl);
      setUrl(newUrl);
    };

    const handleLoading = (loading: boolean) => {
      setIsLoading(loading);
    };

    const handleDownload = (data: { filePath: string; fileName: string }) => {
      console.log('[Browser] CSV downloaded:', data);

      if (isProcessingDownload.current || processedDownloads.current.has(data.filePath)) {
        console.log('[Browser] Ignoring duplicate download event');
        return;
      }

      isProcessingDownload.current = true;
      processedDownloads.current.add(data.filePath);

      setDownloadedFile(data);

      window.electron.invoke('browser:hide').catch(err => {
        console.error('Failed to hide browser for modal:', err);
      });

      setTimeout(() => {
        isProcessingDownload.current = false;
      }, 1000);
    };

    const handleError = (error: { code: number; description: string; url: string }) => {
      console.error('[Browser] Navigation error:', error);
      if (error.code !== -3) {
        toast.error(`Failed to load page: ${error.description}`);
      }
    };

    window.electron.on('browser:url-changed', handleUrlChange);
    window.electron.on('browser:loading', handleLoading);
    window.electron.on('csv:downloaded', handleDownload);
    window.electron.on('browser:error', handleError);

    return () => {
      console.log('[Browser] Component unmounting, hiding browser view');
      window.electron.removeListener('browser:url-changed', handleUrlChange);
      window.electron.removeListener('browser:loading', handleLoading);
      window.electron.removeListener('csv:downloaded', handleDownload);
      window.electron.removeListener('browser:error', handleError);

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

  const promptForSensitiveInput = async (label: string, stepNumber: number, totalSteps: number): Promise<string> => {
    try {
      const value = await window.electron.invoke('browser:prompt-sensitive-input', label, stepNumber, totalSteps);
      return value;
    } catch (error) {
      console.error('Failed to prompt for sensitive input:', error);
      throw error;
    }
  };

  const handleEditRecipe = async () => {
    if (!selectedRecipe) {
      toast.error('Please select a recipe to edit');
      return;
    }

    try {
      const recipe = await window.electron.invoke('export-recipes:get-by-id', selectedRecipe);
      if (!recipe) {
        toast.error('Recipe not found');
        return;
      }

      const parsedRecipe = {
        ...recipe,
        steps: typeof recipe.steps === 'string' ? JSON.parse(recipe.steps) : recipe.steps
      };

      setEditingRecipe(parsedRecipe);
    } catch (error) {
      console.error('Failed to load recipe for editing:', error);
      toast.error('Failed to load recipe');
    }
  };

  const handleSaveEditedRecipe = async (updatedSteps: any[]) => {
    if (!editingRecipe) return;

    try {
      await window.electron.invoke('export-recipes:update', {
        id: editingRecipe.id,
        steps: updatedSteps
      });
      toast.success('Recipe updated successfully');
      setEditingRecipe(null);
      loadSavedRecipes();
    } catch (error) {
      console.error('Failed to save recipe:', error);
      toast.error('Failed to save recipe');
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

      await handleNavigate(recipe.url);

      await new Promise(resolve => setTimeout(resolve, 3000));

      let lastSensitiveValue = '';
      let lastSensitiveSelector = '';

      for (let i = 0; i < recipe.steps.length; i++) {
        let step = recipe.steps[i];

        console.log(`[Replay] Processing step ${i + 1}/${recipe.steps.length}:`, {
          type: step.type,
          selector: step.selector,
          isRedacted: step.value === '[REDACTED]'
        });

        if (step.type === 'input' && step.value === '[REDACTED]') {
          if (step.selector === lastSensitiveSelector && lastSensitiveValue) {
            console.log(`[Replay] Skipping duplicate sensitive input at step ${i + 1}`);
            step = { ...step, value: lastSensitiveValue };
          } else {
            console.log(`[Replay] Prompting for sensitive input at step ${i + 1}:`, step.selector);
            const userValue = await promptForSensitiveInput(
              step.selector,
              i + 1,
              recipe.steps.length
            );
            console.log(`[Replay] User provided value, length: ${userValue.length}`);
            lastSensitiveValue = userValue;
            lastSensitiveSelector = step.selector;
            step = { ...step, value: userValue };

            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        toast.loading(`Step ${i + 1}/${recipe.steps.length}: ${step.type} on ${step.element}`, {
          duration: 1500,
        });

        console.log(`[Replay] Executing step ${i + 1}`);
        const result = await window.electron.invoke('browser:execute-step', step);
        console.log(`[Replay] Step ${i + 1} result:`, result);

        if (!result.success) {
          const errorMsg = `Step ${i + 1} (${step.type} on ${step.element}) failed\n\nSelector: ${step.selector}\n\nError: ${result.error}`;
          toast.error(`Step ${i + 1} failed - check console`);
          console.error('Step failed:', step, result.error);
          console.log('Failed step details:', JSON.stringify(step, null, 2));
          console.log('Selector that failed:', step.selector);
          console.log('Element type:', step.element);

          if (!confirm(errorMsg + '\n\nContinue with remaining steps?')) {
            break;
          }
        }

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
          window.electron.invoke('browser:hide');

          setRecordingToSave(result.recording);
          setRecipeName('');
          setRecipeInstitution('');
          setShowSaveModal(true);
        } else {
          toast.success('Recording stopped (no steps captured)');
        }
      } else {
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
      const format = await window.electron.invoke('import:detect-format', downloadedFile.filePath);

      if (!format) {
        toast.error('Could not detect CSV format. Please use manual import.');
        window.electron.invoke('browser:show');
        return;
      }

      navigate('/import', {
        state: {
          filePath: downloadedFile.filePath,
          accountId: selectedAccountId,
          format,
        },
      });

      setDownloadedFile(null);
      setSelectedAccountId(null);
    } catch (error) {
      console.error('Failed to start import:', error);
      toast.error('Failed to start import. Please try manual import.');
      window.electron.invoke('browser:show');
    }
  };

  const handleCancelImport = () => {
    setDownloadedFile(null);
    setSelectedAccountId(null);

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
      loadSavedRecipes();
      setShowSaveModal(false);
      setRecordingToSave(null);
      setRecipeName('');
      setRecipeInstitution('');

      window.electron.invoke('browser:show');
    } catch (error) {
      console.error('Failed to save recipe:', error);
      toast.error('Failed to save recipe');
    }
  };

  const navBtnClass = 'p-1.5 rounded text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30';

  return (
    <div className="h-full flex flex-col">
      {/* Address Bar */}
      <div className="bg-muted p-3">
        <div className="flex items-center gap-2">
          {/* Navigation buttons */}
          <div className="flex gap-1">
            <button className={navBtnClass} onClick={handleBack} title="Back">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button className={navBtnClass} onClick={handleForward} title="Forward">
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className={navBtnClass} onClick={handleReload} title="Reload">
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button className={navBtnClass} onClick={handleHome} title="Home">
              <Home className="w-4 h-4" />
            </button>
            <button
              className={`p-1.5 rounded transition-colors ${isRecording ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'text-muted-foreground hover:bg-muted'}`}
              onClick={handleRecord}
              title={isRecording ? 'Stop Recording' : 'Record Export Steps'}
            >
              <Circle className={`w-4 h-4 ${isRecording ? 'fill-current animate-pulse' : ''}`} />
            </button>
          </div>

          {/* URL input */}
          <input
            type="text"
            className="flex-1 px-2 py-1 border border-border rounded-md bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-ring focus:outline-none"
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
            <label className="text-xs text-muted-foreground">Saved Recipes:</label>
            <select
              className="flex-1 px-2 py-1 border border-border rounded-md bg-background text-foreground text-xs focus:ring-1 focus:ring-ring focus:outline-none"
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
            <Button size="sm" onClick={handleReplayRecipe} disabled={!selectedRecipe} title="Replay selected recipe">
              Replay
            </Button>
            <button
              className={navBtnClass}
              onClick={handleEditRecipe}
              disabled={!selectedRecipe}
              title="Edit selected recipe"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
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
      <div className="flex-1 bg-muted relative">
        {!isBrowserAttached && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-muted-foreground/20 border-t-muted-foreground/70 rounded-full animate-spin mx-auto mb-4" />
              <p>Loading browser...</p>
            </div>
          </div>
        )}
        {isBrowserAttached && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 pointer-events-none">
            <p className="text-xs">Browser view active</p>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {downloadedFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-success" />
              Download Detected!
            </h3>

            <div className="bg-success/10 border border-success/30 rounded-lg p-3 flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-success" />
              <span className="text-sm text-success">{downloadedFile.fileName}</span>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              Select which account to import these transactions to:
            </p>

            <select
              className={selectClass + ' mb-6'}
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

            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={handleCancelImport}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!selectedAccountId}>
                Continue Import
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Save Recipe Modal */}
      {showSaveModal && recordingToSave && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Circle className="w-5 h-5 text-success" />
              Save Export Recipe
            </h3>

            <div className="bg-success/10 border border-success/30 rounded-lg p-3 flex items-center gap-3 mb-4">
              <span className="text-sm text-success">Captured {recordingToSave.interactions.length} steps</span>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              Save this recording so you can replay it later:
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1">Recipe Name *</label>
              <Input
                type="text"
                placeholder="e.g., Bank of America CSV Export"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-1">Institution (optional)</label>
              <Input
                type="text"
                placeholder="e.g., Bank of America"
                value={recipeInstitution}
                onChange={(e) => setRecipeInstitution(e.target.value)}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowSaveModal(false);
                  setRecordingToSave(null);
                  setRecipeName('');
                  setRecipeInstitution('');
                  window.electron.invoke('browser:show');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveRecipe} disabled={!recipeName.trim()}>
                Save Recipe
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recipe Modal */}
      {editingRecipe && (
        <EditRecipeModal
          recipe={editingRecipe}
          onClose={() => setEditingRecipe(null)}
          onSave={handleSaveEditedRecipe}
        />
      )}
    </div>
  );
}
