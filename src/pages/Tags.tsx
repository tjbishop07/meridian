import { useEffect, useState } from 'react';
import { Plus, Sparkles, Trash2, X, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ResponsiveBar } from '@nivo/bar';
import { nivoTheme, tooltipStyle } from '../lib/nivoTheme';
import { useTags } from '../hooks/useTags';
import { useTickerStore } from '../store/tickerStore';
import Modal from '../components/ui/Modal';
import TransactionForm from '../components/transactions/TransactionForm';
import PageHeader from '../components/layout/PageHeader';
import type { TagStat, TagMonthlyRow, Transaction, CreateTransactionInput } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/FormField';
import { cn } from '@/lib/utils';

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
      <FormField label="Tag Name">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          placeholder="e.g., Subscriptions"
          autoFocus
        />
      </FormField>

      <FormField label="Description" hint="Used by AI for smarter matching">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="e.g., Netflix, Spotify, Apple One, recurring monthly charges"
        />
      </FormField>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                'w-7 h-7 rounded-full transition-transform hover:scale-110',
                color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-border"
          />
          <span className="text-sm text-muted-foreground">Custom</span>
          <span
            className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: color, color: '#fff' }}
          >
            {name || 'Preview'}
          </span>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <Button onClick={handleSave} disabled={!name.trim() || saving} className="flex-1">
          {saving ? 'Saving…' : submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
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
  const chartDisplayData = chartData.map((row) => ({
    ...row,
    month: format(new Date((row.month as string) + '-01'), 'MMM'),
  }));
  const tagColorMap = new Map(monthlyData.map((r) => [r.tag_name, r.tag_color]));
  const tableMonths = months.slice(-analyticsMonths);
  const selectedStat = stats.find((s) => s.id === selectedTagId);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Tags"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleAutoTag} disabled={isAutoTagging}>
              <Sparkles className="w-4 h-4 mr-2" />
              {isAutoTagging ? 'Tagging…' : 'Auto-tag with AI'}
            </Button>
            <Button onClick={() => setIsNewTagOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Tag
            </Button>
          </div>
        }
      >
        {/* Tabs */}
        <div className="flex gap-1 mt-1">
          {(['browse', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors',
                activeTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
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
          <div className="w-72 flex-shrink-0 border-r border-border overflow-y-auto p-4 space-y-3">
            {stats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No tags yet</p>
            ) : (
              stats.map((stat) => (
                <div
                  key={stat.id}
                  onClick={() => handleSelectTag(stat.id)}
                  className={cn(
                    'rounded-xl border cursor-pointer transition-all p-4',
                    selectedTagId === stat.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/30 hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: stat.color, color: '#fff' }}
                    >
                      {stat.name}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingTag(stat); }}
                        className="p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                        title="Edit tag"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTag(stat.id); }}
                        className="p-1 text-muted-foreground/50 hover:text-destructive transition-colors"
                        title="Delete tag"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {stat.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{stat.description}</p>
                  )}
                  <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>{stat.count} transactions</span>
                    <span>${stat.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: Transaction List */}
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedTagId ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Select a tag to browse transactions</p>
              </div>
            ) : loadingTransactions ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : tagTransactions.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No transactions with this tag</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {selectedStat && (
                  <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: selectedStat.color, color: '#fff' }}
                    >
                      {selectedStat.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {selectedStat.count} transactions · ${selectedStat.total_amount.toFixed(2)} total
                    </span>
                  </div>
                )}
                <table className="min-w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Category</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Amount</th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tagTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        onClick={() => setEditingTransaction(tx)}
                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {format(parseISO(tx.date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-foreground">{tx.description}</div>
                          {tx.original_description && tx.original_description !== tx.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-xs">{tx.original_description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {tx.category_name || <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                          <span className={cn(
                            'font-medium',
                            tx.type === 'income' ? 'text-success' :
                            tx.type === 'transfer' ? 'text-primary' : 'text-destructive'
                          )}>
                            {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '→' : '-'}${Math.abs(tx.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 w-10">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveTransactionFromTag(tx.id); }}
                            className="p-1 text-muted-foreground/30 hover:text-destructive transition-colors rounded"
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
            <span className="text-sm text-muted-foreground">Show last</span>
            {[3, 6, 12].map((n) => (
              <Button
                key={n}
                size="sm"
                variant={analyticsMonths === n ? 'default' : 'outline'}
                onClick={() => setAnalyticsMonths(n)}
              >
                {n}m
              </Button>
            ))}
          </div>

          {monthlyData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>No tagged transactions yet — run Auto-tag to get started</p>
            </div>
          ) : (
            <>
              {/* Stacked bar chart */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
                  Monthly Spend by Tag
                </h2>
                <div style={{ height: 280 }}>
                  <ResponsiveBar
                    data={chartDisplayData}
                    theme={nivoTheme}
                    keys={chartTags}
                    indexBy="month"
                    groupMode="stacked"
                    margin={{ top: 0, right: 16, bottom: 48, left: 56 }}
                    padding={0.35}
                    colors={({ id }) => tagColorMap.get(id as string) ?? '#6366f1'}
                    enableLabel={false}
                    enableGridX={false}
                    borderRadius={2}
                    axisLeft={{
                      tickSize: 0,
                      tickPadding: 8,
                      tickValues: 5,
                      format: (v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`,
                    }}
                    axisBottom={{ tickSize: 0, tickPadding: 8 }}
                    tooltip={({ id, value, color }) => (
                      <div style={tooltipStyle}>
                        <span style={{ color, marginRight: 6 }}>●</span>
                        <strong>{id}</strong>: ${(value as number).toFixed(2)}
                      </div>
                    )}
                    legends={[{
                      dataFrom: 'keys',
                      anchor: 'bottom',
                      direction: 'row',
                      translateY: 44,
                      itemWidth: 90,
                      itemHeight: 14,
                      symbolSize: 10,
                      symbolShape: 'circle',
                    }]}
                  />
                </div>
              </div>

              {/* Month-over-month table */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <h2 className="text-sm font-semibold text-muted-foreground px-4 py-3 border-b border-border uppercase tracking-wide">
                  Tag Breakdown
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Tag</th>
                        {tableMonths.map((m) => (
                          <th key={m} className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                            {m}
                          </th>
                        ))}
                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {chartTags.map((tagName) => {
                        const rowMonths = tableMonths.map((m) => {
                          const r = monthlyData.find((d) => d.month === m && d.tag_name === tagName);
                          return r ? r.total_amount : 0;
                        });
                        const total = rowMonths.reduce((s, v) => s + v, 0);
                        const color = tagColorMap.get(tagName) ?? '#6366f1';
                        const rowMax = Math.max(...rowMonths, 0.01);

                        return (
                          <tr key={tagName} className="hover:bg-muted/50">
                            <td className="px-4 py-3">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ backgroundColor: color, color: '#fff' }}
                              >
                                {tagName}
                              </span>
                            </td>
                            {rowMonths.map((amt, i) => (
                              <td key={i} className="px-4 py-3 text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-sm tabular-nums">
                                    {amt > 0 ? `$${amt.toFixed(0)}` : <span className="text-muted-foreground/25">—</span>}
                                  </span>
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
