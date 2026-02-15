import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Zap, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/layout/PageHeader';
import { RecordingCard } from '../components/automation/RecordingCard';
import { EmptyState } from '../components/automation/EmptyState';
import { EditRecordingModal } from '../components/automation/EditRecordingModal';
import { useCategories } from '../hooks/useCategories';

interface Recording {
  id: string;
  name: string;
  institution?: string;
  url: string;
  steps: any[];
  account_id?: number | null;
  created_at: string;
  updated_at: string;
  last_run_at?: string | null;
}

export function Automation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { categories, loadCategories } = useCategories();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [scrapedTransactions, setScrapedTransactions] = useState<any[] | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const isImportingRef = useRef(false); // Use ref for synchronous duplicate detection

  // New recording modal
  const [showNewRecordingModal, setShowNewRecordingModal] = useState(false);
  const [startUrl, setStartUrl] = useState('https://www.usaa.com');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  // Reload recordings whenever user navigates to this page
  useEffect(() => {
    if (location.pathname === '/automation') {
      loadRecordings();
    }
  }, [location.pathname]);

  useEffect(() => {
    loadRecordings();
    loadAccounts();
    loadCategories();

    // Listen for recording saved events
    const handleRecordingSaved = () => {
      loadRecordings();
      toast.success('Recording saved successfully');
    };

    // Listen for playback complete events
    const handlePlaybackComplete = () => {
      setPlayingId(null);
      // Don't show toast here - wait for scrape complete which shows transaction count
    };

    // Listen for scrape complete events
    const handleScrapeComplete = async (...args: any[]) => {
      console.log('[Automation] handleScrapeComplete called');
      console.log('[Automation] Arguments received:', args);

      // Prevent concurrent imports - use REF for synchronous check
      if (isImportingRef.current) {
        console.warn('[Automation] ❌ BLOCKED: Import already in progress, ignoring duplicate event');
        return;
      }
      isImportingRef.current = true; // Set ref synchronously
      setIsImporting(true); // Set state for UI

      // The data should be the first argument (event is filtered by preload)
      const data = args[0];

      console.log('[Automation] Extracted data:', data);

      if (!data) {
        console.error('[Automation] Scrape complete event received with undefined data');
        toast.error('Failed to receive scraped data');
        isImportingRef.current = false;
        setIsImporting(false);
        return;
      }

      if (!data.transactions || !Array.isArray(data.transactions)) {
        console.error('[Automation] Invalid transactions data:', data);
        toast.error('Invalid scraped data format');
        isImportingRef.current = false;
        setIsImporting(false);
        return;
      }

      console.log('[Automation] Scraped transactions:', data.transactions.length);

      if (data.count > 0) {
        // Find the recording to get the account_id
        const recording = recordings.find(r => r.id === String(data.recipeId));

        console.log('[Automation] Recording found:', recording?.name, 'Account ID:', recording?.account_id);
        console.log('[Automation] Available accounts:', accounts.length);

        let accountId = recording?.account_id;

        // If no account associated with recording, try to reload and check again
        if (!accountId) {
          console.log('[Automation] No account_id on recording, fetching fresh data...');
          try {
            // Reload the specific recording to get latest data
            const freshRecording = await window.electron.invoke('export-recipes:get-by-id', Number(data.recipeId));
            accountId = freshRecording?.account_id;
            console.log('[Automation] Fresh recording account_id:', accountId);
          } catch (err) {
            console.error('[Automation] Failed to fetch fresh recording:', err);
          }
        }

        // If still no account, use the first available account
        if (!accountId) {
          // Reload accounts to make sure we have the latest list
          const accountsList = await window.electron.invoke('accounts:get-all');
          console.log('[Automation] Loaded accounts:', accountsList.length);

          if (accountsList.length > 0) {
            accountId = accountsList[0].id;
            console.log('[Automation] No account associated with recording, using first account:', accountsList[0].name);
          }
        }

        if (!accountId) {
          console.error('[Automation] No accounts available for import');
          toast.error('No accounts available. Please create an account first.');
          isImportingRef.current = false;
        setIsImporting(false);
          return;
        }

        console.log('[Automation] Using account ID:', accountId);

        // Directly save transactions to database
        try {
          toast.loading('Saving transactions...', { id: 'import' });

          console.log('[Automation] ==================== SAVING TRANSACTIONS ====================');
          console.log('[Automation] Account ID:', accountId);
          console.log('[Automation] Total transactions:', data.transactions.length);
          console.log('[Automation] Sample scraped data:', data.transactions.slice(0, 2));

          // Find the default income category
          const incomeCategory = categories.find(
            c => c.type === 'income' && (c.name.toLowerCase() === 'income' || c.name.toLowerCase().includes('income'))
          );

          // Helper function to normalize category names
          const normalizeCategoryName = (name: string): string => {
            return name
              .trim()
              .replace(/\s+\d+$/g, '')  // Remove trailing numbers like "Allowance 0"
              .replace(/[\d\(\)]+$/g, '')  // Remove trailing numbers and parentheses
              .replace(/\s+/g, ' ')  // Normalize multiple spaces to single space
              .trim();
          };

          /**
           * FINAL SANITIZATION - Remove ANY suspicious characters before database save
           * This is the last line of defense to ensure clean category names
           */
          const sanitizeCategoryForDatabase = (name: string): string => {
            const original = name;

            let cleaned = name
              .trim()
              // Remove ALL trailing digits (be aggressive)
              .replace(/\s*\d+\s*$/g, '')
              // Remove trailing spaces again
              .trim()
              // Remove any remaining trailing punctuation with numbers
              .replace(/\s*[\(\)\[\]\{\}]\s*\d*\s*$/g, '')
              // Remove multiple spaces
              .replace(/\s+/g, ' ')
              // Final trim
              .trim();

            // Log if we made changes
            if (original !== cleaned) {
              console.log(`[Automation] 🧹 SANITIZED: "${original}" → "${cleaned}"`);
            }

            // Validate result
            if (!cleaned || cleaned.length === 0) {
              console.error(`[Automation] ❌ SANITIZATION FAILED: "${original}" became empty!`);
              return original; // Return original rather than empty string
            }

            // Check if still has trailing digits (should never happen)
            if (/\d$/.test(cleaned)) {
              console.warn(`[Automation] ⚠️ WARNING: Category still has trailing digit: "${cleaned}"`);
              // One more aggressive pass
              cleaned = cleaned.replace(/\s*\d+$/g, '').trim();
              console.log(`[Automation] 🧹 EXTRA PASS: Now "${cleaned}"`);
            }

            return cleaned;
          };

          /**
           * Extract, normalize, and batch-create categories from scraped transactions
           * Returns a map: normalized category name + type → category_id
           */
          const batchProcessCategories = async (
            scrapedTransactions: any[]
          ): Promise<Map<string, number>> => {
            console.log('[Automation] ==================== BATCH PROCESSING CATEGORIES ====================');

            // Step 1: Extract unique categories from scraped data
            const uniqueCategories = new Map<string, { type: 'income' | 'expense', originalNames: Set<string> }>();

            for (const txn of scrapedTransactions) {
              if (!txn.category || !txn.category.trim()) continue;

              const amount = parseFloat(txn.amount) || 0;
              const type = amount < 0 ? 'expense' : 'income';
              const normalizedName = normalizeCategoryName(txn.category.trim());

              // Skip empty or "pending" categories
              if (!normalizedName || normalizedName.toLowerCase().includes('pending')) {
                continue;
              }

              // Group by normalized name
              if (!uniqueCategories.has(normalizedName)) {
                uniqueCategories.set(normalizedName, { type, originalNames: new Set() });
              }
              uniqueCategories.get(normalizedName)!.originalNames.add(txn.category.trim());
            }

            console.log(`[Automation] Found ${uniqueCategories.size} unique categories to process`);
            console.log('[Automation] Categories:', Array.from(uniqueCategories.entries()).map(([name, data]) =>
              `${name} (${data.type}) from [${Array.from(data.originalNames).join(', ')}]`
            ));

            // Step 2: Fetch existing categories once
            const existingCategories = await window.electron.invoke('categories:get-all');
            console.log(`[Automation] Found ${existingCategories.length} existing categories in database`);

            // Step 3: Build map of existing categories
            const categoryMap = new Map<string, number>();
            for (const cat of existingCategories) {
              const key = `${cat.name.toLowerCase()}:${cat.type}`;
              categoryMap.set(key, cat.id);
            }

            // Step 4: Identify categories that need to be created
            const categoriesToCreate: Array<{ name: string; type: 'income' | 'expense' }> = [];

            for (const [normalizedName, data] of uniqueCategories) {
              const key = `${normalizedName.toLowerCase()}:${data.type}`;

              if (!categoryMap.has(key)) {
                categoriesToCreate.push({ name: normalizedName, type: data.type });
              }
            }

            console.log(`[Automation] Need to create ${categoriesToCreate.length} new categories`);

            // Step 5: Batch create new categories
            if (categoriesToCreate.length > 0) {
              console.log('[Automation] Creating categories:', categoriesToCreate.map(c => `${c.name} (${c.type})`).join(', '));

              for (const cat of categoriesToCreate) {
                try {
                  console.log(`[Automation]   🔍 BEFORE SANITIZATION: "${cat.name}" (type: ${cat.type})`);
                  console.log(`[Automation]      - Length: ${cat.name.length}`);
                  console.log(`[Automation]      - Char codes: [${Array.from(cat.name).map(c => c.charCodeAt(0)).join(', ')}]`);
                  console.log(`[Automation]      - Last char: "${cat.name[cat.name.length - 1]}" (code: ${cat.name.charCodeAt(cat.name.length - 1)})`);

                  // FINAL SANITIZATION - Clean category name right before database save
                  const sanitizedName = sanitizeCategoryForDatabase(cat.name);

                  console.log(`[Automation]   📝 AFTER SANITIZATION: "${sanitizedName}" (type: ${cat.type})`);
                  console.log(`[Automation]      - Length: ${sanitizedName.length}`);
                  console.log(`[Automation]      - Last char: "${sanitizedName[sanitizedName.length - 1]}" (code: ${sanitizedName.charCodeAt(sanitizedName.length - 1)})`);

                  const newId = await window.electron.invoke('categories:create', {
                    name: sanitizedName,
                    type: cat.type,
                    parent_id: null,
                    icon: null,
                    color: null,
                    is_system: false
                  });

                  // Verify what was actually created
                  const createdCategory = await window.electron.invoke('categories:get-all');
                  const justCreated = createdCategory.find((c: any) => c.id === newId);
                  console.log(`[Automation]   ✅ VERIFIED IN DB: "${justCreated?.name}" (ID: ${newId})`);
                  if (justCreated?.name !== sanitizedName) {
                    console.error(`[Automation]   🚨 MISMATCH! Sent "${sanitizedName}" but DB has "${justCreated?.name}"`);
                  }

                  // Use sanitized name for the map key
                  const key = `${sanitizedName.toLowerCase()}:${cat.type}`;
                  categoryMap.set(key, newId);
                } catch (error) {
                  console.error(`[Automation]   ✗ Failed to create "${cat.name}":`, error);
                }
              }
            }

            // Step 6: Build final lookup map: normalized name + type → category_id
            const lookupMap = new Map<string, number>();
            for (const [normalizedName, data] of uniqueCategories) {
              const key = `${normalizedName.toLowerCase()}:${data.type}`;
              const categoryId = categoryMap.get(key);
              if (categoryId) {
                lookupMap.set(`${normalizedName}:${data.type}`, categoryId);
              }
            }

            console.log('[Automation] Category map built:', lookupMap.size, 'mappings');
            console.log('[Automation] ==================== CATEGORY PROCESSING COMPLETE ====================');

            return lookupMap;
          };

          // Step A: Batch process all categories BEFORE processing transactions
          const categoryLookupMap = await batchProcessCategories(data.transactions);

          // Step B: Convert scraped transactions to CreateTransactionInput format
          const transactionsToCreate = [];

          for (const txn of data.transactions) {
            const amount = parseFloat(txn.amount) || 0;

            // Determine transaction type from amount
            // Negative amounts are expenses, positive are income
            const type = amount < 0 ? 'expense' : 'income';

            // Handle category from pre-built map (no IPC calls)
            let categoryId = null;

            if (txn.category && txn.category.trim()) {
              const normalizedName = normalizeCategoryName(txn.category.trim());
              const lookupKey = `${normalizedName}:${type}`;
              categoryId = categoryLookupMap.get(lookupKey) || null;

              if (categoryId) {
                console.log(`[Automation] Transaction "${txn.description}" → category ID ${categoryId}`);
              } else {
                console.warn(`[Automation] Transaction "${txn.description}" → no category found for "${normalizedName}"`);
              }
            } else if (type === 'income' && incomeCategory) {
              // Fall back to default income category for income transactions without category
              console.log('[Automation] 💰 Using default income category:', incomeCategory.id);
              categoryId = incomeCategory.id;
            } else {
              console.log('[Automation] ⚠️ No category assigned - scraped category was empty or invalid');
            }

            // Convert date to YYYY-MM-DD format
            let formattedDate = '';
            try {
              // Parse date like "Feb 10, 2026" to "2026-02-10"
              const parsedDate = new Date(txn.date);
              if (!isNaN(parsedDate.getTime())) {
                const year = parsedDate.getFullYear();
                const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                const day = String(parsedDate.getDate()).padStart(2, '0');
                formattedDate = `${year}-${month}-${day}`;
              } else {
                console.warn('[Automation] Invalid date, skipping transaction:', txn);
                continue; // Skip this transaction
              }
            } catch (err) {
              console.warn('[Automation] Failed to parse date, skipping transaction:', txn.date, err);
              continue; // Skip this transaction
            }

            transactionsToCreate.push({
              account_id: accountId,
              date: formattedDate,
              description: txn.description,
              original_description: txn.description,
              amount: Math.abs(amount), // Store as positive number
              type: type,
              status: 'cleared' as const,
              category_id: categoryId,
              notes: null
            });
          }

          // Summary before bulk insert
          const categorizedCount = transactionsToCreate.filter(t => t.category_id !== null).length;
          const uncategorizedCount = transactionsToCreate.length - categorizedCount;

          console.log(`[Automation] Transactions ready for import:`);
          console.log(`[Automation]   - Total: ${transactionsToCreate.length}`);
          console.log(`[Automation]   - With categories: ${categorizedCount}`);
          console.log(`[Automation]   - Without categories: ${uncategorizedCount}`);
          console.log('[Automation] Sample transactions:', transactionsToCreate.slice(0, 2));
          console.log('[Automation] Creating transactions...');

          // Bulk create all transactions
          const created = await window.electron.invoke('transactions:bulk-create', transactionsToCreate);

          console.log('[Automation] Successfully created:', created, 'transactions');
          console.log('[Automation] ==================== SAVE COMPLETE ====================');

          // Reload categories and recordings in background for UI
          loadCategories().catch(err => console.error('[Automation] Failed to reload categories:', err));
          loadRecordings().catch(err => console.error('[Automation] Failed to reload recordings:', err));

          // Update the loading toast to success (same id to replace it)
          toast.success(
            `Saved ${created} transactions!`,
            { id: 'import', duration: 3000 }
          );

          // Navigate to transactions page to see the saved data
          setTimeout(() => {
            navigate('/transactions');
          }, 1500);
        } catch (error) {
          console.error('[Automation] Failed to save transactions:', error);
          // Update the loading toast to error (same id to replace it)
          toast.error(
            'Failed to save transactions: ' + (error instanceof Error ? error.message : String(error)),
            { id: 'import' }
          );
        } finally {
          isImportingRef.current = false;
        setIsImporting(false);
        }
      } else {
        toast('No transactions found on page', { icon: 'ℹ️' });
      }
    };

    console.log('[Automation] Setting up event listeners');
    window.electron.on('automation:recording-saved', handleRecordingSaved);
    window.electron.on('automation:playback-complete', handlePlaybackComplete);
    window.electron.on('automation:scrape-complete', handleScrapeComplete);

    return () => {
      console.log('[Automation] Cleaning up event listeners');
      window.electron.removeListener('automation:recording-saved', handleRecordingSaved);
      window.electron.removeListener('automation:playback-complete', handlePlaybackComplete);
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

      // Parse steps from JSON string to array and add account names
      const parsedRecipes = recipes.map((recipe: any) => {
        const account = accountsList.find((acc: any) => acc.id === recipe.account_id);
        return {
          ...recipe,
          steps: typeof recipe.steps === 'string' ? JSON.parse(recipe.steps) : recipe.steps,
          account_name: account?.name || null
        };
      });
      setRecordings(parsedRecipes);
    } catch (error) {
      console.error('Failed to load recordings:', error);
      toast.error('Failed to load recordings');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const accountsList = await window.electron.invoke('accounts:get-all');
      setAccounts(accountsList);
      // Set first account as default
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
      toast.error('Please select an account first');
      return;
    }

    try {
      setShowNewRecordingModal(false);
      toast.loading('Opening recording browser...', { duration: 1000 });

      const result = await window.electron.invoke('automation:start-recording', startUrl, selectedAccountId);

      if (result.success) {
        toast.success('Recording browser opened! Navigate, interact, then click "Start Recording".');
      } else {
        toast.error('Failed to open recording browser');
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const handlePlayRecording = async (id: string) => {
    const recording = recordings.find(r => r.id === id);
    if (!recording) return;

    try {
      setPlayingId(id);

      await window.electron.invoke('automation:play-recording', id);

      // Don't show toast - overlay will show progress
    } catch (error) {
      console.error('Failed to play recording:', error);
      toast.error('Failed to play recording');
      setPlayingId(null);
    }
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
      toast.success('Recording updated successfully');
    } catch (error) {
      console.error('Failed to update recording:', error);
      toast.error('Failed to update recording');
    }
  };

  const handleDeleteRecording = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this recording? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await window.electron.invoke('export-recipes:delete', id);
      await loadRecordings();
      toast.success('Recording deleted successfully');
    } catch (error) {
      console.error('Failed to delete recording:', error);
      toast.error('Failed to delete recording');
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
      toast.success('Recording duplicated successfully');
    } catch (error) {
      console.error('Failed to duplicate recording:', error);
      toast.error('Failed to duplicate recording');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Automation"
        subtitle="Record and replay browser interactions with real browser (undetectable)"
        action={
          <button className="btn btn-primary gap-2" onClick={handleNewRecording}>
            <Plus className="w-4 h-4" />
            New Recording
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : recordings.length === 0 ? (
          <EmptyState onCreateNew={handleNewRecording} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                onPlay={handlePlayRecording}
                onEdit={(rec) => setEditingRecording(rec)}
                onDelete={handleDeleteRecording}
                onDuplicate={handleDuplicateRecording}
                isPlaying={playingId === recording.id}
              />
            ))}
          </div>
        )}
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
          <div className="bg-base-100 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-base-300">
              <h3 className="text-xl font-bold text-base-content">
                Scraped Transactions ({scrapedTransactions.length})
              </h3>
              <p className="text-sm text-base-content/70 mt-1">
                Review the extracted transactions below
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Balance</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scrapedTransactions.map((txn, idx) => (
                      <tr key={idx}>
                        <td>{txn.index || idx + 1}</td>
                        <td className="whitespace-nowrap">{txn.date}</td>
                        <td className="max-w-xs truncate">{txn.description}</td>
                        <td className="whitespace-nowrap">
                          {txn.category ? (
                            <span className="badge badge-sm badge-primary">{txn.category}</span>
                          ) : (
                            <span className="text-base-content/40 text-xs">No category</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap font-mono">{txn.amount}</td>
                        <td className="whitespace-nowrap font-mono">{txn.balance}</td>
                        <td>
                          <span className={`badge badge-sm ${
                            txn.confidence > 50 ? 'badge-success' :
                            txn.confidence > 30 ? 'badge-warning' :
                            'badge-error'
                          }`}>
                            {txn.confidence ? Math.round(txn.confidence) : '?'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-base-300 bg-base-200">
              <button
                onClick={() => setScrapedTransactions(null)}
                className="flex-1 px-4 py-2 bg-base-300 text-base-content rounded-lg hover:bg-base-400 font-medium"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  // Copy as JSON to clipboard
                  navigator.clipboard.writeText(JSON.stringify(scrapedTransactions, null, 2));
                  toast.success('Copied to clipboard!');
                }}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
              >
                Copy as JSON
              </button>
              <button
                onClick={() => {
                  // Navigate to Import page with scraped transactions
                  navigate('/import', {
                    state: {
                      scrapedTransactions: scrapedTransactions,
                      source: 'automation'
                    }
                  });
                  setScrapedTransactions(null); // Close modal
                }}
                className="flex-1 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 font-medium"
              >
                Import Transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Recording Modal */}
      {showNewRecordingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-base-100 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-base-content mb-4">Start New Recording</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-2">
                  Import To Account
                </label>
                <select
                  value={selectedAccountId || ''}
                  onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="">Select account...</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.institution})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-base-content/60 mt-1">
                  Transactions will be automatically imported to this account
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-2">
                  Starting URL
                </label>
                <input
                  type="url"
                  value={startUrl}
                  onChange={(e) => setStartUrl(e.target.value)}
                  placeholder="https://www.usaa.com"
                  className="w-full px-4 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-900 font-medium text-sm mb-2">How it works:</p>
                <ol className="text-blue-700 text-xs space-y-1 list-decimal list-inside">
                  <li>Opens a real browser window (undetectable by banks)</li>
                  <li>Navigate to your bank and log in manually</li>
                  <li>Click "Start Recording" when ready</li>
                  <li>Perform your actions (navigate, click, type)</li>
                  <li>Click "Stop & Save" when done</li>
                  <li>Your recording can be replayed anytime!</li>
                </ol>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-800 text-sm">
                  <strong>✓ Uses real Chromium browser</strong>
                </p>
                <p className="text-green-700 text-xs mt-1">
                  Cookies and sessions persist between recordings, so you stay logged in!
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-purple-800 text-sm">
                  <strong>🔒 Fully Automated</strong>
                </p>
                <p className="text-purple-700 text-xs mt-1">
                  All inputs including PINs and passwords are saved during recording and automatically entered during playback. No manual intervention needed!
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewRecordingModal(false)}
                className="flex-1 px-4 py-2 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleStartRecording}
                className="flex-1 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 font-medium"
              >
                Open Recording Browser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
