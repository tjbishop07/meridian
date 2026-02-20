import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { RecordingCard } from '../components/automation/RecordingCard';
import { EmptyState } from '../components/automation/EmptyState';
import { EditRecordingModal } from '../components/automation/EditRecordingModal';
import { useCategories } from '../hooks/useCategories';
import { useAutomationSettings } from '../hooks/useAutomationSettings';
import { useTickerStore } from '../store/tickerStore';
import { useAutomationStore } from '../store/automationStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Recording {
  id: string;
  name: string;
  institution?: string;
  url: string;
  steps: any[];
  account_id?: number | null;
  account_name?: string;
  created_at: string;
  updated_at: string;
  last_run_at?: string | null;
  last_scraping_method?: string | null;
}

export function Automation({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { categories, loadCategories } = useCategories();
  const { settings: automationSettings, updateSettings: updateAutomationSettings } = useAutomationSettings();
  const playingId = useAutomationStore((state) => state.playingRecipeId);
  const progress = useAutomationStore((state) => state.progress);
  const setPlayingRecipe = useAutomationStore((state) => state.setPlayingRecipe);
  const clearProgress = useAutomationStore((state) => state.clearProgress);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);

  console.log('[Automation] Component render - playingId:', playingId);
  console.log('[Automation] Component render - progress:', progress);
  const [scrapedTransactions, setScrapedTransactions] = useState<any[] | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const isImportingRef = useRef(false);

  const [showNewRecordingModal, setShowNewRecordingModal] = useState(false);
  const [startUrl, setStartUrl] = useState('https://www.usaa.com');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  useEffect(() => {
    if (location.pathname === '/automation' || location.pathname === '/import') {
      loadRecordings();
    }
  }, [location.pathname]);

  useEffect(() => {
    loadRecordings();
    loadAccounts();
    loadCategories();

    const handleRecordingSaved = () => {
      loadRecordings();
    };

    const handleScrapeComplete = async (...args: any[]) => {
      console.log('[Automation] handleScrapeComplete called');
      console.log('[Automation] Arguments received:', args);

      if (isImportingRef.current) {
        console.warn('[Automation] ❌ BLOCKED: Import already in progress, ignoring duplicate event');
        return;
      }
      isImportingRef.current = true;
      setIsImporting(true);

      const data = args[0];

      console.log('[Automation] Extracted data:', data);

      if (!data) {
        console.error('[Automation] Scrape complete event received with undefined data');
        useTickerStore.getState().addMessage({ content: 'Automation failed: no data received', type: 'error', duration: 6000 });
        isImportingRef.current = false;
        setIsImporting(false);
        return;
      }

      if (!data.transactions || !Array.isArray(data.transactions)) {
        console.error('[Automation] Invalid transactions data:', data);
        useTickerStore.getState().addMessage({ content: 'Automation failed: invalid data format', type: 'error', duration: 6000 });
        isImportingRef.current = false;
        setIsImporting(false);
        return;
      }

      console.log('[Automation] Scraped transactions:', data.transactions.length);

      if (data.count > 0) {
        const recording = recordings.find(r => r.id === String(data.recipeId));

        console.log('[Automation] Recording found:', recording?.name, 'Account ID:', recording?.account_id);
        console.log('[Automation] Available accounts:', accounts.length);

        let accountId = recording?.account_id;

        if (!accountId) {
          console.log('[Automation] No account_id on recording, fetching fresh data...');
          try {
            const freshRecording = await window.electron.invoke('export-recipes:get-by-id', Number(data.recipeId));
            accountId = freshRecording?.account_id;
            console.log('[Automation] Fresh recording account_id:', accountId);
          } catch (err) {
            console.error('[Automation] Failed to fetch fresh recording:', err);
          }
        }

        if (!accountId) {
          const accountsList = await window.electron.invoke('accounts:get-all');
          console.log('[Automation] Loaded accounts:', accountsList.length);

          if (accountsList.length > 0) {
            accountId = accountsList[0].id;
            console.log('[Automation] No account associated with recording, using first account:', accountsList[0].name);
          }
        }

        if (!accountId) {
          console.error('[Automation] No accounts available for import');
          useTickerStore.getState().addMessage({ content: 'No accounts available — please create an account first', type: 'error', duration: 6000 });
          isImportingRef.current = false;
          setIsImporting(false);
          return;
        }

        console.log('[Automation] Using account ID:', accountId);

        try {
          console.log('[Automation] ==================== SAVING TRANSACTIONS ====================');
          console.log('[Automation] Account ID:', accountId);
          console.log('[Automation] Total transactions:', data.transactions.length);
          console.log('[Automation] Sample scraped data:', data.transactions.slice(0, 2));

          const incomeCategory = categories.find(
            c => c.type === 'income' && (c.name.toLowerCase() === 'income' || c.name.toLowerCase().includes('income'))
          );

          const normalizeCategory = (name: string): string => {
            let n = name
              .trim()
              .replace(/\s*\d+\s*$/g, '')
              .replace(/\s*[\(\)\[\]\{\}]\s*\d*\s*$/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            return n || name.trim();
          };

          const batchProcessCategories = async (
            scrapedTransactions: any[]
          ): Promise<Map<string, number>> => {
            const uniqueCategories = new Map<string, 'income' | 'expense'>();

            for (const txn of scrapedTransactions) {
              if (!txn.category?.trim()) continue;
              const amount = parseFloat(txn.amount) || 0;
              const type = amount < 0 ? 'expense' : 'income';
              const norm = normalizeCategory(txn.category.trim());
              if (!norm || norm.toLowerCase().includes('pending')) continue;
              if (!uniqueCategories.has(norm)) uniqueCategories.set(norm, type);
            }

            console.log(`[Automation] Categories to resolve: ${uniqueCategories.size}`);

            const existingCategories = await window.electron.invoke('categories:get-all');
            const categoryMap = new Map<string, number>();
            for (const cat of existingCategories) {
              categoryMap.set(`${cat.name.toLowerCase()}:${cat.type}`, cat.id);
            }

            for (const [norm, type] of uniqueCategories) {
              const key = `${norm.toLowerCase()}:${type}`;
              if (categoryMap.has(key)) continue;

              try {
                const newId = await window.electron.invoke('categories:create', {
                  name: norm,
                  type,
                  parent_id: null,
                  icon: null,
                  color: null,
                  is_system: false
                });
                categoryMap.set(key, newId);
              } catch (error) {
                console.error(`[Automation] Failed to get/create category "${norm}":`, error);
              }
            }

            const lookupMap = new Map<string, number>();
            for (const [norm, type] of uniqueCategories) {
              const id = categoryMap.get(`${norm.toLowerCase()}:${type}`);
              if (id) lookupMap.set(`${norm}:${type}`, id);
            }

            console.log(`[Automation] Category map built: ${lookupMap.size} mappings`);
            return lookupMap;
          };

          const categoryLookupMap = await batchProcessCategories(data.transactions);

          const transactionsToCreate = [];

          for (const txn of data.transactions) {
            const amount = parseFloat(txn.amount) || 0;
            const balance = txn.balance ? parseFloat(txn.balance) : undefined;
            const type = amount < 0 ? 'expense' : 'income';

            let categoryId = null;

            if (txn.category && txn.category.trim()) {
              const normalizedName = normalizeCategory(txn.category.trim());
              const lookupKey = `${normalizedName}:${type}`;
              categoryId = categoryLookupMap.get(lookupKey) || null;

              if (categoryId) {
                console.log(`[Automation] Transaction "${txn.description}" → category ID ${categoryId}`);
              } else {
                console.warn(`[Automation] Transaction "${txn.description}" → no category found for "${normalizedName}"`);
              }
            } else if (type === 'income' && incomeCategory) {
              console.log('[Automation] 💰 Using default income category:', incomeCategory.id);
              categoryId = incomeCategory.id;
            } else {
              console.log('[Automation] ⚠️ No category assigned - scraped category was empty or invalid');
            }

            let formattedDate = '';
            try {
              const parsedDate = new Date(txn.date);
              if (!isNaN(parsedDate.getTime())) {
                const year = parsedDate.getFullYear();
                const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                const day = String(parsedDate.getDate()).padStart(2, '0');
                formattedDate = `${year}-${month}-${day}`;
              } else {
                console.warn('[Automation] Invalid date, skipping transaction:', txn);
                continue;
              }
            } catch (err) {
              console.warn('[Automation] Failed to parse date, skipping transaction:', txn.date, err);
              continue;
            }

            transactionsToCreate.push({
              account_id: accountId,
              date: formattedDate,
              description: txn.description,
              original_description: txn.description,
              amount: Math.abs(amount),
              balance: balance,
              type: type,
              status: 'cleared' as const,
              category_id: categoryId,
              notes: null
            });
          }

          const categorizedCount = transactionsToCreate.filter(t => t.category_id !== null).length;
          const uncategorizedCount = transactionsToCreate.length - categorizedCount;

          console.log(`[Automation] Transactions ready for import:`);
          console.log(`[Automation]   - Total: ${transactionsToCreate.length}`);
          console.log(`[Automation]   - With categories: ${categorizedCount}`);
          console.log(`[Automation]   - Without categories: ${uncategorizedCount}`);
          console.log('[Automation] Sample transactions:', transactionsToCreate.slice(0, 2));
          console.log('[Automation] Creating transactions...');

          const created = await window.electron.invoke('transactions:bulk-create', transactionsToCreate);

          console.log('[Automation] Successfully created:', created, 'transactions');
          console.log('[Automation] ==================== SAVE COMPLETE ====================');

          loadCategories().catch(err => console.error('[Automation] Failed to reload categories:', err));
          loadRecordings().catch(err => console.error('[Automation] Failed to reload recordings:', err));

          const recording = recordings.find(r => r.id === String(data.recipeId));
          const recordingName = recording?.name || 'Automation';
          console.log('[Automation] ========== ADDING TICKER MESSAGE ==========');
          console.log('[Automation] Recording:', recording);
          console.log('[Automation] Recording Name:', recordingName);
          console.log('[Automation] Created:', created);

          const noNewMessages = [
            `${recordingName}: Checked the books — your wallet is as quiet as a library. No new transactions.`,
            `${recordingName}: The bank is silent. Either you've gone off the grid or you're just really good at not spending money.`,
            `${recordingName}: Scrubbed every corner of the page and found absolutely nothing new. Your bank account is playing hard to get.`,
            `${recordingName}: Zero transactions imported. Your finances are apparently on vacation.`,
            `${recordingName}: Nothing to import. The transactions must be stuck in traffic.`,
          ];
          const tickerMessage = {
            content: created === 0
              ? noNewMessages[Math.floor(Math.random() * noNewMessages.length)]
              : `✓ ${recordingName}: Imported ${created} transaction${created === 1 ? '' : 's'} successfully`,
            type: (created === 0 ? 'info' : 'success') as const,
            duration: 8000,
          };
          console.log('[Automation] Ticker message:', tickerMessage);

          useTickerStore.getState().addMessage(tickerMessage);
          console.log('[Automation] Ticker store after add:', useTickerStore.getState().messages);
          console.log('[Automation] ================================================');

          clearProgress(String(data.recipeId));

          setTimeout(() => {
            navigate('/transactions');
          }, 1500);
        } catch (error) {
          console.error('[Automation] Failed to save transactions:', error);
          useTickerStore.getState().addMessage({
            content: 'Failed to save transactions: ' + (error instanceof Error ? error.message : String(error)),
            type: 'error',
            duration: 8000,
          });

          clearProgress(String(data.recipeId));
        } finally {
          isImportingRef.current = false;
          setIsImporting(false);
        }
      } else {
        const recording = recordings.find(r => r.id === String(data.recipeId));
        const recordingName = recording?.name || 'Automation';
        const noTxMessages = [
          `${recordingName}: Looked everywhere — not a single transaction to be found. Either the page outsmarted us or your spending is on strike.`,
          `${recordingName}: The page was visited, the AI squinted at it, and found… nothing. Completely transaction-free.`,
          `${recordingName}: No transactions detected. The robots have searched and come up empty-handed.`,
        ];
        useTickerStore.getState().addMessage({
          content: noTxMessages[Math.floor(Math.random() * noTxMessages.length)],
          type: 'info',
          duration: 6000,
        });

        clearProgress(String(data.recipeId));
      }
    };

    console.log('[Automation] Setting up event listeners');
    window.electron.on('automation:recording-saved', handleRecordingSaved);
    window.electron.on('automation:scrape-complete', handleScrapeComplete);

    return () => {
      console.log('[Automation] Cleaning up event listeners');
      window.electron.removeListener('automation:recording-saved', handleRecordingSaved);
      window.electron.removeListener('automation:scrape-complete', handleScrapeComplete);
    };
  }, []);

  const loadRecordings = async () => {
    try {
      setLoading(true);
      const [recipes, accountsList] = await Promise.all([
        window.electron.invoke('export-recipes:get-all'),
        window.electron.invoke('accounts:get-all')
      ]);

      const parsedRecipes = recipes.map((recipe: any) => {
        const account = accountsList.find((acc: any) => acc.id === recipe.account_id);
        return {
          ...recipe,
          id: String(recipe.id),
          steps: typeof recipe.steps === 'string' ? JSON.parse(recipe.steps) : recipe.steps,
          account_name: account?.name || null
        };
      });
      setRecordings(parsedRecipes);
      console.log('[Automation] Loaded recordings:', parsedRecipes.map(r => ({ id: r.id, type: typeof r.id })));
    } catch (error) {
      console.error('Failed to load recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const accountsList = await window.electron.invoke('accounts:get-all');
      setAccounts(accountsList);
      if (accountsList.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accountsList[0].id);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const handleNewRecording = () => {
    setShowNewRecordingModal(true);
  };

  const handleStartRecording = async () => {
    if (!selectedAccountId) {
      useTickerStore.getState().addMessage({ content: 'Please select an account first', type: 'warning', duration: 4000 });
      return;
    }

    try {
      setShowNewRecordingModal(false);
      const result = await window.electron.invoke('automation:start-recording', startUrl, selectedAccountId);

      if (!result.success) {
        useTickerStore.getState().addMessage({ content: 'Failed to open recording browser', type: 'error', duration: 5000 });
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      useTickerStore.getState().addMessage({ content: 'Failed to start recording', type: 'error', duration: 5000 });
    }
  };

  const handlePlayRecording = async (id: string) => {
    console.log('[Automation] ========== PLAY RECORDING CLICKED ==========');
    console.log('[Automation] ID:', id, '(type:', typeof id, ')');

    const recording = recordings.find(r => r.id === id);
    if (!recording) {
      console.error('[Automation] Recording not found for ID:', id);
      return;
    }

    try {
      const idStr = String(id);
      console.log('[Automation] Normalized ID:', idStr);
      console.log('[Automation] Calling setPlayingRecipe...');

      setPlayingRecipe(idStr);

      console.log('[Automation] Store after setPlayingRecipe:', {
        playingRecipeId: useAutomationStore.getState().playingRecipeId,
        progress: useAutomationStore.getState().progress
      });

      console.log('[Automation] Invoking automation:play-recording...');
      const result = await window.electron.invoke('automation:play-recording', idStr);
      console.log('[Automation] IPC result:', result);

    } catch (error) {
      console.error('[Automation] Failed to play recording:', error);
      useTickerStore.getState().addMessage({ content: 'Failed to play recording', type: 'error', duration: 5000 });
      clearProgress(String(id));
    }
    console.log('[Automation] ================================================');
  };

  const handleEditRecording = async (id: string, name: string, institution: string, steps?: any[], accountId?: number | null) => {
    try {
      await window.electron.invoke('export-recipes:update', {
        id,
        name,
        institution: institution || null,
        steps: steps,
        account_id: accountId
      });
      await loadRecordings();
    } catch (error) {
      console.error('Failed to update recording:', error);
    }
  };

  const handleDeleteRecording = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this recording? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await window.electron.invoke('export-recipes:delete', id);
      await loadRecordings();
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
  };

  const handleDuplicateRecording = async (id: string) => {
    try {
      const original = recordings.find(r => r.id === id);
      if (!original) return;

      await window.electron.invoke('export-recipes:create', {
        name: `${original.name} (Copy)`,
        institution: original.institution || null,
        url: original.url,
        steps: JSON.stringify(original.steps)
      });
      await loadRecordings();
    } catch (error) {
      console.error('Failed to duplicate recording:', error);
    }
  };

  const selectClass = 'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring text-sm';

  return (
    <div className="flex flex-col h-full">
      {!embedded && (
        <PageHeader
          title="Automation"
          subtitle="Automate transaction imports with browser automation and AI"
          action={
            <Button onClick={handleNewRecording}>
              <Plus className="w-4 h-4 mr-2" />
              New Recording
            </Button>
          }
        />
      )}

      {embedded && (
        <div className="border-b border-border px-6 py-2 flex justify-end">
          <Button size="sm" onClick={handleNewRecording}>
            <Plus className="w-4 h-4 mr-2" />
            New Recording
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        <>
          {/* Scraping Method Selector */}
          <div className="bg-card rounded-xl border border-border p-4 mb-6">
            <p className="text-sm font-medium text-muted-foreground mb-3">Transaction Scraping Method</p>
            <div className="grid grid-cols-2 gap-3 max-w-lg">
              {([
                {
                  value: 'claude',
                  label: 'Claude Vision AI',
                  description: 'Most reliable. Configure API key in Settings.',
                },
                {
                  value: 'ollama',
                  label: 'Local Ollama',
                  description: 'Runs on your machine. Configure in Settings.',
                },
              ] as const).map((opt) => {
                const active = automationSettings.vision_provider === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateAutomationSettings({ vision_provider: opt.value })}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all',
                      active
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-card hover:border-muted-foreground/30'
                    )}
                  >
                    <span className={cn('font-medium text-sm', active ? 'text-primary' : 'text-foreground')}>
                      {opt.label}
                    </span>
                    <p className="text-xs text-muted-foreground leading-snug">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : recordings.length === 0 ? (
            <EmptyState onCreateNew={handleNewRecording} />
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="bg-muted px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="bg-muted px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">Account</th>
                    <th className="bg-muted px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">Steps</th>
                    <th className="bg-muted px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-48">Last Run</th>
                    <th className="bg-muted px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="bg-muted px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recordings.map((recording) => {
                    const recordingProgress = progress[recording.id];
                    const isPlaying = playingId === recording.id;

                    return (
                      <RecordingCard
                        key={recording.id}
                        recording={recording}
                        onPlay={handlePlayRecording}
                        onEdit={(rec) => setEditingRecording(rec)}
                        onDelete={handleDeleteRecording}
                        onDuplicate={handleDuplicateRecording}
                        isPlaying={isPlaying}
                        progress={recordingProgress}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      </div>

      <EditRecordingModal
        isOpen={!!editingRecording}
        recording={editingRecording}
        accounts={accounts}
        onSave={handleEditRecording}
        onClose={() => setEditingRecording(null)}
      />

      {/* Scraped Transactions Modal */}
      {scrapedTransactions && scrapedTransactions.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-border shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">
                Scraped Transactions ({scrapedTransactions.length})
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Review the extracted transactions below</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Category</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Amount</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Balance</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {scrapedTransactions.map((txn, idx) => (
                      <tr key={idx} className="hover:bg-muted/50">
                        <td className="px-3 py-2 text-muted-foreground">{txn.index || idx + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{txn.date}</td>
                        <td className="px-3 py-2 max-w-xs truncate">{txn.description}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {txn.category ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              {txn.category}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">No category</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">{txn.amount}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">{txn.balance}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                            txn.confidence > 50 ? 'bg-success/10 text-success' :
                            txn.confidence > 30 ? 'bg-warning/10 text-warning' :
                            'bg-destructive/10 text-destructive'
                          )}>
                            {txn.confidence ? Math.round(txn.confidence) : '?'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-border bg-muted/50">
              <Button variant="outline" className="flex-1" onClick={() => setScrapedTransactions(null)}>
                Dismiss
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { navigator.clipboard.writeText(JSON.stringify(scrapedTransactions, null, 2)); }}
              >
                Copy as JSON
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  navigate('/import', { state: { scrapedTransactions, source: 'automation' } });
                  setScrapedTransactions(null);
                }}
              >
                Import Transactions
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Recording Modal */}
      {showNewRecordingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-border shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">Start New Recording</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Import To Account
                </label>
                <select
                  value={selectedAccountId || ''}
                  onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                  className={selectClass}
                >
                  <option value="">Select account...</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.institution})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Transactions will be automatically imported to this account
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Starting URL
                </label>
                <input
                  type="url"
                  value={startUrl}
                  onChange={(e) => setStartUrl(e.target.value)}
                  placeholder="https://www.usaa.com"
                  className={selectClass}
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                <p className="text-blue-900 dark:text-blue-200 font-medium text-sm mb-2">How it works:</p>
                <ol className="text-blue-700 dark:text-blue-300 text-xs space-y-1 list-decimal list-inside">
                  <li>Opens a real browser window (undetectable by banks)</li>
                  <li>Navigate to your bank and log in manually</li>
                  <li>Click "Start Recording" when ready</li>
                  <li>Perform your actions (navigate, click, type)</li>
                  <li>Click "Stop &amp; Save" when done</li>
                  <li>Your recording can be replayed anytime!</li>
                </ol>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3">
                <p className="text-emerald-800 dark:text-emerald-200 text-sm">
                  <strong>✓ Uses real Chromium browser</strong>
                </p>
                <p className="text-emerald-700 dark:text-emerald-300 text-xs mt-1">
                  Cookies and sessions persist between recordings, so you stay logged in!
                </p>
              </div>

              <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 rounded-lg p-3">
                <p className="text-violet-800 dark:text-violet-200 text-sm">
                  <strong>🔒 Fully Automated</strong>
                </p>
                <p className="text-violet-700 dark:text-violet-300 text-xs mt-1">
                  All inputs including PINs and passwords are saved during recording and automatically entered during playback.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowNewRecordingModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleStartRecording}>
                Open Recording Browser
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
