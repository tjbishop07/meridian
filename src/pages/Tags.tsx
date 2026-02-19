import { useEffect, useState } from 'react';
import { Plus, Sparkles, Trash2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTags } from '../hooks/useTags';
import { useTickerStore } from '../store/tickerStore';
import Modal from '../components/ui/Modal';
import TransactionForm from '../components/transactions/TransactionForm';
import PageHeader from '../components/layout/PageHeader';
import type { TagStat, Transaction, CreateTransactionInput } from '../types';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#3b82f6', '#0ea5e9',
  '#10b981', '#f59e0b', '#ef4444', '#ec4899',
  '#14b8a6', '#f97316',
];

export default function Tags() {
  const { tags, loadTags, createTag, deleteTag } = useTags();

  const [stats, setStats] = useState<TagStat[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [tagTransactions, setTagTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [isNewTagOpen, setIsNewTagOpen] = useState(false);
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // New tag form state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');

  useEffect(() => {
    loadTags();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const result = await window.electron.invoke('tags:get-stats');
      setStats(result);
    } catch (err) {
      console.error('Failed to load tag stats', err);
    }
  };

  const handleSelectTag = async (tagId: number) => {
    if (selectedTagId === tagId) {
      setSelectedTagId(null);
      setTagTransactions([]);
      return;
    }
    setSelectedTagId(tagId);
    setLoadingTransactions(true);
    try {
      const txs = await window.electron.invoke('tags:get-transactions', tagId);
      setTagTransactions(txs);
    } catch (err) {
      console.error('Failed to load transactions for tag', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    await createTag({ name: newTagName.trim(), color: newTagColor });
    await loadStats();
    setNewTagName('');
    setNewTagColor('#6366f1');
    setIsNewTagOpen(false);
  };

  const handleRemoveTransactionFromTag = async (transactionId: number) => {
    if (!selectedTagId) return;
    try {
      // Get all current tags for this transaction, remove the selected one
      const currentTags = await window.electron.invoke('tags:get-for-transaction', transactionId);
      const newTagIds = currentTags
        .map((t) => t.id)
        .filter((id) => id !== selectedTagId);
      await window.electron.invoke('tags:set-for-transaction', transactionId, newTagIds);
      // Remove from local list immediately
      setTagTransactions((prev) => prev.filter((tx) => tx.id !== transactionId));
      // Refresh stats
      await loadStats();
    } catch (err) {
      console.error('Failed to remove transaction from tag', err);
    }
  };

  const handleUpdateTransaction = async (data: CreateTransactionInput, tagIds: number[]) => {
    if (!editingTransaction) return;
    await window.electron.invoke('transactions:update', {
      id: editingTransaction.id,
      ...data,
    } as any);
    await window.electron.invoke('tags:set-for-transaction', editingTransaction.id, tagIds);
    // Refresh the transaction list for the current tag
    if (selectedTagId) {
      const txs = await window.electron.invoke('tags:get-transactions', selectedTagId);
      setTagTransactions(txs);
    }
    await loadStats();
    setEditingTransaction(null);
  };

  const handleDeleteTag = async (id: number) => {
    if (!confirm('Delete this tag? It will be removed from all transactions.')) return;
    await deleteTag(id);
    await loadStats();
    if (selectedTagId === id) {
      setSelectedTagId(null);
      setTagTransactions([]);
    }
  };

  const handleAutoTag = async () => {
    setIsAutoTagging(true);
    useTickerStore.getState().addMessage({
      content: 'Auto-tagging transactions with AI...',
      type: 'info',
      duration: 0,
    });

    try {
      const result = await window.electron.invoke('tags:auto-tag');
      await loadStats();
      useTickerStore.getState().addMessage({
        content: `Auto-tagging complete — ${result.tagged} transactions tagged`,
        type: 'success',
        duration: 5000,
      });
    } catch (err) {
      useTickerStore.getState().addMessage({
        content: 'Auto-tagging failed — is Ollama running?',
        type: 'error',
        duration: 5000,
      });
    } finally {
      setIsAutoTagging(false);
    }
  };

  const selectedStat = stats.find((s) => s.id === selectedTagId);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Tags"
        action={
          <div className="flex gap-2">
            <button
              onClick={handleAutoTag}
              disabled={isAutoTagging}
              className="btn btn-ghost gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {isAutoTagging ? 'Tagging...' : 'Auto-tag with AI'}
            </button>
            <button
              onClick={() => setIsNewTagOpen(true)}
              className="btn btn-primary gap-2"
            >
              <Plus className="w-4 h-4" />
              New Tag
            </button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tag Cards */}
        <div className="w-72 flex-shrink-0 border-r border-base-300 overflow-y-auto p-4 space-y-3">
          {stats.length === 0 ? (
            <p className="text-sm text-base-content/50 text-center py-8">No tags yet</p>
          ) : (
            stats.map((stat) => (
              <div
                key={stat.id}
                onClick={() => handleSelectTag(stat.id)}
                className={`card card-compact cursor-pointer border transition-all ${
                  selectedTagId === stat.id
                    ? 'border-primary bg-primary/5'
                    : 'border-base-300 bg-base-100 hover:border-primary/30 hover:bg-base-200'
                }`}
              >
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <span
                      className="badge"
                      style={{ backgroundColor: stat.color, color: '#fff', borderColor: stat.color }}
                    >
                      {stat.name}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteTag(stat.id); }}
                      className="btn btn-ghost btn-xs text-error opacity-50 hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex justify-between text-sm text-base-content/60 mt-1">
                    <span>{stat.count} transactions</span>
                    <span>${stat.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Transaction List */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedTagId ? (
            <div className="flex items-center justify-center h-full text-base-content/40">
              <p>Select a tag to browse transactions</p>
            </div>
          ) : loadingTransactions ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-base-200 rounded animate-pulse" />
              ))}
            </div>
          ) : tagTransactions.length === 0 ? (
            <div className="flex items-center justify-center h-full text-base-content/40">
              <p>No transactions with this tag</p>
            </div>
          ) : (
            <div className="bg-base-100 rounded-lg border border-base-300 overflow-hidden">
              {selectedStat && (
                <div className="px-4 py-3 border-b border-base-300 flex items-center gap-3">
                  <span
                    className="badge"
                    style={{ backgroundColor: selectedStat.color, color: '#fff', borderColor: selectedStat.color }}
                  >
                    {selectedStat.name}
                  </span>
                  <span className="text-sm text-base-content/60">
                    {selectedStat.count} transactions · ${selectedStat.total_amount.toFixed(2)} total
                  </span>
                </div>
              )}
              <table className="min-w-full">
                <thead className="bg-base-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-base-content/60 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-base-content/60 uppercase">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-base-content/60 uppercase">Category</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-base-content/60 uppercase">Amount</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-300">
                  {tagTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => setEditingTransaction(tx)}
                      className="hover:bg-base-200 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm text-base-content/70 whitespace-nowrap">
                        {format(parseISO(tx.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-base-content">{tx.description}</div>
                        {tx.original_description && tx.original_description !== tx.description && (
                          <div className="text-xs text-base-content/50 truncate max-w-xs">
                            {tx.original_description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-base-content/60">
                        {tx.category_name || <span className="text-base-content/30">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                        <span className={
                          tx.type === 'income' ? 'text-green-600 font-medium' :
                          tx.type === 'transfer' ? 'text-blue-600 font-medium' :
                          'text-red-600'
                        }>
                          {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '→' : '-'}$
                          {Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 w-10">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveTransactionFromTag(tx.id); }}
                          className="btn btn-ghost btn-xs btn-circle text-base-content/30 hover:text-error hover:bg-error/10"
                          title="Remove from tag"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        title="Edit Transaction"
        size="lg"
      >
        {editingTransaction && (
          <TransactionForm
            transaction={editingTransaction}
            onSubmit={handleUpdateTransaction}
            onCancel={() => setEditingTransaction(null)}
          />
        )}
      </Modal>

      {/* New Tag Modal */}
      <Modal isOpen={isNewTagOpen} onClose={() => setIsNewTagOpen(false)} title="New Tag" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Tag Name</label>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTag(); }}
              className="input w-full"
              placeholder="e.g., Subscriptions"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewTagColor(color)}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${
                    newTagColor === color ? 'ring-2 ring-offset-2 ring-base-content scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-base-300"
              />
              <span className="text-sm text-base-content/60">Custom color</span>
              <span
                className="badge ml-auto"
                style={{ backgroundColor: newTagColor, color: '#fff', borderColor: newTagColor }}
              >
                {newTagName || 'Preview'}
              </span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreateTag}
              disabled={!newTagName.trim()}
              className="btn btn-primary flex-1"
            >
              Create Tag
            </button>
            <button onClick={() => setIsNewTagOpen(false)} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
