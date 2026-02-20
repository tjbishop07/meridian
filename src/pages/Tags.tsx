import { useEffect, useState } from 'react';
import { Plus, Sparkles, Trash2, X, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useTags } from '../hooks/useTags';
import { useTickerStore } from '../store/tickerStore';
import Modal from '../components/ui/Modal';
import TransactionForm from '../components/transactions/TransactionForm';
import PageHeader from '../components/layout/PageHeader';
import type { TagStat, TagMonthlyRow, Transaction, CreateTransactionInput } from '../types';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#3b82f6', '#0ea5e9',
  '#10b981', '#f59e0b', '#ef4444', '#ec4899',
  '#14b8a6', '#f97316',
];

// ── Tag Form (shared by New + Edit) ────────────────────────────────────────
function TagForm({
  initial,
  onSave,
  onCancel,
  submitLabel,
}: {
  initial: { name: string; color: string; description: string };
  onSave: (values: { name: string; color: string; description: string }) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [description, setDescription] = useState(initial.description);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), color, description: description.trim() }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">Tag Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          className="input w-full"
          placeholder="e.g., Subscriptions"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Description <span className="text-base-content/40 font-normal">(used by AI for smarter matching)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="textarea w-full text-sm"
          rows={2}
          placeholder="e.g., Netflix, Spotify, Apple One, recurring monthly charges"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${
                color === c ? 'ring-2 ring-offset-2 ring-base-content scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-base-300"
          />
          <span className="text-sm text-base-content/60">Custom</span>
          <span className="badge ml-auto" style={{ backgroundColor: color, color: '#fff', borderColor: color }}>
            {name || 'Preview'}
          </span>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={handleSave} disabled={!name.trim() || saving} className="btn btn-primary flex-1">
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button onClick={onCancel} className="btn btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function Tags() {
  const { tags, loadTags, createTag, updateTag, deleteTag } = useTags();

  const [activeTab, setActiveTab] = useState<'browse' | 'analytics'>('browse');
  const [stats, setStats] = useState<TagStat[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [tagTransactions, setTagTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [isNewTagOpen, setIsNewTagOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagStat | null>(null);
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Analytics state
  const [monthlyData, setMonthlyData] = useState<TagMonthlyRow[]>([]);
  const [analyticsMonths, setAnalyticsMonths] = useState(6);

  useEffect(() => {
    loadTags();
    loadStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') loadMonthlyStats();
  }, [activeTab, analyticsMonths]);

  const loadStats = async () => {
    try { setStats(await window.electron.invoke('tags:get-stats')); }
    catch (err) { console.error('Failed to load tag stats', err); }
  };

  const loadMonthlyStats = async () => {
    try { setMonthlyData(await window.electron.invoke('tags:get-monthly-stats', analyticsMonths)); }
    catch (err) { console.error('Failed to load monthly stats', err); }
  };

  const handleSelectTag = async (tagId: number) => {
    if (selectedTagId === tagId) { setSelectedTagId(null); setTagTransactions([]); return; }
    setSelectedTagId(tagId);
    setLoadingTransactions(true);
    try { setTagTransactions(await window.electron.invoke('tags:get-transactions', tagId)); }
    catch (err) { console.error('Failed to load transactions for tag', err); }
    finally { setLoadingTransactions(false); }
  };

  const handleCreateTag = async (values: { name: string; color: string; description: string }) => {
    await createTag({ name: values.name, color: values.color, description: values.description || undefined });
    await loadStats();
    setIsNewTagOpen(false);
  };

  const handleEditTag = async (values: { name: string; color: string; description: string }) => {
    if (!editingTag) return;
    await updateTag({ id: editingTag.id, name: values.name, color: values.color, description: values.description || undefined });
    await loadStats();
    setEditingTag(null);
  };

  const handleDeleteTag = async (id: number) => {
    if (!confirm('Delete this tag? It will be removed from all transactions.')) return;
    await deleteTag(id);
    await loadStats();
    if (selectedTagId === id) { setSelectedTagId(null); setTagTransactions([]); }
  };

  const handleRemoveTransactionFromTag = async (transactionId: number) => {
    if (!selectedTagId) return;
    try {
      const currentTags = await window.electron.invoke('tags:get-for-transaction', transactionId);
      const newTagIds = currentTags.map((t) => t.id).filter((id) => id !== selectedTagId);
      await window.electron.invoke('tags:set-for-transaction', transactionId, newTagIds);
      setTagTransactions((prev) => prev.filter((tx) => tx.id !== transactionId));
      await loadStats();
    } catch (err) { console.error('Failed to remove transaction from tag', err); }
  };

  const handleUpdateTransaction = async (data: CreateTransactionInput, tagIds: number[]) => {
    if (!editingTransaction) return;
    await window.electron.invoke('transactions:update', { id: editingTransaction.id, ...data } as any);
    await window.electron.invoke('tags:set-for-transaction', editingTransaction.id, tagIds);
    if (selectedTagId) setTagTransactions(await window.electron.invoke('tags:get-transactions', selectedTagId));
    await loadStats();
    setEditingTransaction(null);
  };

  const handleAutoTag = async () => {
    setIsAutoTagging(true);
    useTickerStore.getState().addMessage({ content: 'Auto-tagging transactions with AI…', type: 'info', duration: 0 });
    try {
      const result = await window.electron.invoke('tags:auto-tag');
      await loadStats();
      useTickerStore.getState().addMessage({
        content: `Auto-tagging complete — ${result.tagged} transactions tagged`,
        type: 'success', duration: 5000,
      });
    } catch {
      useTickerStore.getState().addMessage({ content: 'Auto-tagging failed — is Ollama running?', type: 'error', duration: 5000 });
    } finally {
      setIsAutoTagging(false);
    }
  };

  // ── Analytics helpers ─────────────────────────────────────────────────────
  // Pivot monthly rows into chart-friendly format: [{ month, TagA, TagB, ... }]
  const months = [...new Set(monthlyData.map((r) => r.month))].sort();
  const chartTags = [...new Set(monthlyData.map((r) => r.tag_name))];
  const chartData = months.map((month) => {
    const row: Record<string, any> = { month };
    for (const tagName of chartTags) {
      const match = monthlyData.find((r) => r.month === month && r.tag_name === tagName);
      row[tagName] = match ? Number(match.total_amount.toFixed(2)) : 0;
    }
    return row;
  });
  const tagColorMap = new Map(monthlyData.map((r) => [r.tag_name, r.tag_color]));

  // Table: tags as rows, months as columns
  const tableMonths = months.slice(-analyticsMonths);

  const selectedStat = stats.find((s) => s.id === selectedTagId);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Tags"
        action={
          <div className="flex gap-2">
            <button onClick={handleAutoTag} disabled={isAutoTagging} className="btn btn-ghost gap-2">
              <Sparkles className="w-4 h-4" />
              {isAutoTagging ? 'Tagging…' : 'Auto-tag with AI'}
            </button>
            <button onClick={() => setIsNewTagOpen(true)} className="btn btn-primary gap-2">
              <Plus className="w-4 h-4" />
              New Tag
            </button>
          </div>
        }
      >
        {/* Tabs */}
        <div className="flex gap-1 mt-1">
          {(['browse', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                activeTab === tab ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* ── Browse Tab ── */}
      {activeTab === 'browse' && (
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
                      <span className="badge" style={{ backgroundColor: stat.color, color: '#fff', borderColor: stat.color }}>
                        {stat.name}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingTag(stat); }}
                          className="btn btn-ghost btn-xs opacity-50 hover:opacity-100"
                          title="Edit tag"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTag(stat.id); }}
                          className="btn btn-ghost btn-xs text-error opacity-50 hover:opacity-100"
                          title="Delete tag"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {stat.description && (
                      <p className="text-xs text-base-content/40 mt-1 line-clamp-2">{stat.description}</p>
                    )}
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
                    <span className="badge" style={{ backgroundColor: selectedStat.color, color: '#fff', borderColor: selectedStat.color }}>
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
                            <div className="text-xs text-base-content/50 truncate max-w-xs">{tx.original_description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-base-content/60">
                          {tx.category_name || <span className="text-base-content/30">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                          <span className={
                            tx.type === 'income' ? 'text-green-600 font-medium' :
                            tx.type === 'transfer' ? 'text-blue-600 font-medium' : 'text-red-600'
                          }>
                            {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '→' : '-'}${Math.abs(tx.amount).toFixed(2)}
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
      )}

      {/* ── Analytics Tab ── */}
      {activeTab === 'analytics' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Controls */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-base-content/60">Show last</span>
            {[3, 6, 12].map((n) => (
              <button
                key={n}
                onClick={() => setAnalyticsMonths(n)}
                className={`btn btn-sm ${analyticsMonths === n ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
              >
                {n}m
              </button>
            ))}
          </div>

          {monthlyData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-base-content/40">
              <p>No tagged transactions yet — run Auto-tag to get started</p>
            </div>
          ) : (
            <>
              {/* Stacked bar chart */}
              <div className="bg-base-100 rounded-xl border border-base-300 p-4">
                <h2 className="text-sm font-semibold text-base-content/70 mb-4 uppercase tracking-wide">
                  Monthly Spend by Tag
                </h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--b3))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`]} />
                    <Legend />
                    {chartTags.map((tagName) => (
                      <Bar
                        key={tagName}
                        dataKey={tagName}
                        stackId="a"
                        fill={tagColorMap.get(tagName) ?? '#6366f1'}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Month-over-month table */}
              <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden">
                <h2 className="text-sm font-semibold text-base-content/70 px-4 py-3 border-b border-base-300 uppercase tracking-wide">
                  Tag Breakdown
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-base-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-base-content/60 uppercase">Tag</th>
                        {tableMonths.map((m) => (
                          <th key={m} className="px-4 py-2 text-right text-xs font-medium text-base-content/60 uppercase">
                            {m}
                          </th>
                        ))}
                        <th className="px-4 py-2 text-right text-xs font-medium text-base-content/60 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-300">
                      {chartTags.map((tagName) => {
                        const rowMonths = tableMonths.map((m) => {
                          const r = monthlyData.find((d) => d.month === m && d.tag_name === tagName);
                          return r ? r.total_amount : 0;
                        });
                        const total = rowMonths.reduce((s, v) => s + v, 0);
                        const color = tagColorMap.get(tagName) ?? '#6366f1';
                        // For mini sparkline: scale bars relative to row max
                        const rowMax = Math.max(...rowMonths, 0.01);

                        return (
                          <tr key={tagName} className="hover:bg-base-200">
                            <td className="px-4 py-3">
                              <span className="badge badge-sm" style={{ backgroundColor: color, color: '#fff', borderColor: color }}>
                                {tagName}
                              </span>
                            </td>
                            {rowMonths.map((amt, i) => (
                              <td key={i} className="px-4 py-3 text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-sm tabular-nums">
                                    {amt > 0 ? `$${amt.toFixed(0)}` : <span className="text-base-content/25">—</span>}
                                  </span>
                                  {/* Tiny inline bar */}
                                  {amt > 0 && (
                                    <div className="h-1 rounded-full" style={{
                                      width: `${Math.max(4, (amt / rowMax) * 48)}px`,
                                      backgroundColor: color,
                                      opacity: 0.6,
                                    }} />
                                  )}
                                </div>
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right text-sm font-medium tabular-nums">
                              ${total.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Edit Transaction Modal */}
      <Modal isOpen={!!editingTransaction} onClose={() => setEditingTransaction(null)} title="Edit Transaction" size="lg">
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
        <TagForm
          initial={{ name: '', color: '#6366f1', description: '' }}
          onSave={handleCreateTag}
          onCancel={() => setIsNewTagOpen(false)}
          submitLabel="Create Tag"
        />
      </Modal>

      {/* Edit Tag Modal */}
      <Modal isOpen={!!editingTag} onClose={() => setEditingTag(null)} title="Edit Tag" size="sm">
        {editingTag && (
          <TagForm
            initial={{ name: editingTag.name, color: editingTag.color, description: editingTag.description ?? '' }}
            onSave={handleEditTag}
            onCancel={() => setEditingTag(null)}
            submitLabel="Save Changes"
          />
        )}
      </Modal>
    </div>
  );
}
