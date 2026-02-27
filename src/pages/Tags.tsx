import { useEffect, useState } from 'react';
import { Plus, Sparkles, Trash2, X, Pencil, Tag, TagsIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ResponsiveBar } from '@nivo/bar';
import { nivoTheme, tooltipStyle } from '../lib/nivoTheme';
import { useTags } from '../hooks/useTags';
import { toast } from 'sonner';
import Modal from '../components/ui/Modal';
import TransactionForm from '../components/transactions/TransactionForm';
import type { TagStat, TagMonthlyRow, Transaction, CreateTransactionInput } from '../types';
import { Button } from '@/components/ui/button';
import { AccentButton } from '@/components/ui/accent-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/FormField';
import { PageSidebar } from '@/components/ui/PageSidebar';
import { SunkenCard } from '@/components/ui/SunkenCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usePageEntrance } from '../hooks/usePageEntrance';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#3b82f6', '#0ea5e9',
  '#10b981', '#f59e0b', '#ef4444', '#ec4899',
  '#14b8a6', '#f97316',
];

// ── Tag Form ─────────────────────────────────────────────────────────────────
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Tags() {
  const { sidebarClass, contentClass } = usePageEntrance();
  const { tags, loadTags, createTag, updateTag, deleteTag } = useTags();

  const [activeTab, setActiveTab] = useState<'browse' | 'analytics'>('browse');
  const [stats, setStats] = useState<TagStat[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [tagTransactions, setTagTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [isNewTagOpen, setIsNewTagOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagStat | null>(null);
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
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

  const handleClearAllTags = async () => {
    try {
      const result = await window.electron.invoke('tags:clear-all-assignments');
      await loadStats();
      setSelectedTagId(null);
      setTagTransactions([]);
      setIsClearAllOpen(false);
      toast.success(`Cleared ${result.count} tag assignment${result.count !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to clear tag assignments');
    }
  };

  const handleAutoTag = async () => {
    setIsAutoTagging(true);
    const loadingToast = toast.loading('Auto-tagging transactions with AI…');
    try {
      const result = await window.electron.invoke('tags:auto-tag');
      await loadStats();
      toast.dismiss(loadingToast);
      toast.success(`Auto-tagging complete — ${result.tagged} transactions tagged`);
    } catch {
      toast.dismiss(loadingToast);
      toast.error('Auto-tagging failed — is Ollama running?');
    } finally {
      setIsAutoTagging(false);
    }
  };

  // ── Analytics helpers ──────────────────────────────────────────────────────
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
    <div className="flex h-full relative overflow-hidden">

      {/* ── Sidebar ── */}
      <PageSidebar title="Tags" className={sidebarClass}>
        {/* Actions */}
        <div className="px-3 pt-3 pb-3 space-y-2 border-t border-border/40">
          <AccentButton className="w-full justify-center text-xs h-8" onClick={() => setIsNewTagOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Tag
          </AccentButton>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground/60 hover:text-foreground h-7"
            onClick={handleAutoTag}
            disabled={isAutoTagging}
          >
            <Sparkles className="w-3 h-3 mr-1.5" />
            {isAutoTagging ? 'Tagging…' : 'Auto-tag with AI'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground/40 hover:text-destructive h-7"
            onClick={() => setIsClearAllOpen(true)}
            disabled={stats.length === 0}
          >
            <TagsIcon className="w-3 h-3 mr-1.5" />
            Clear All Tags
          </Button>
        </div>

        {/* Tag list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {stats.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-center px-4">
              <Tag className="w-6 h-6 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground/40">No tags yet</p>
            </div>
          ) : (
            stats.map((stat) => (
              <button
                key={stat.id}
                onClick={() => handleSelectTag(stat.id)}
                className={cn(
                  'w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 group transition-all',
                  selectedTagId === stat.id
                    ? 'bg-primary/10'
                    : 'hover:bg-muted/30'
                )}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: stat.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-xs font-medium truncate leading-tight',
                    selectedTagId === stat.id ? 'text-primary' : 'text-foreground'
                  )}>
                    {stat.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 tabular-nums">
                    {stat.count} · ${stat.total_amount.toFixed(0)}
                  </p>
                </div>
                <div className={cn(
                  'flex gap-0.5 transition-opacity shrink-0',
                  selectedTagId === stat.id ? 'opacity-60' : 'opacity-0 group-hover:opacity-60'
                )}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingTag(stat); }}
                    className="p-1 hover:text-foreground text-muted-foreground/60 transition-colors rounded"
                    title="Edit"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTag(stat.id); }}
                    className="p-1 hover:text-destructive text-muted-foreground/60 transition-colors rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Summary footer */}
        {stats.length > 0 && (
          <div className="px-4 py-3 border-t border-border/40">
            <p className="text-[10px] text-muted-foreground/35 tabular-nums">
              {stats.length} tag{stats.length !== 1 ? 's' : ''} · {stats.reduce((s, t) => s + t.count, 0)} transactions
            </p>
          </div>
        )}
      </PageSidebar>

      {/* ── Main Content ── */}
      <div className={cn('flex-1 flex flex-col overflow-hidden', contentClass)}>

        {/* Tab bar + controls */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between flex-shrink-0 border-b border-border/60">
          <div className="flex gap-1">
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

          {activeTab === 'analytics' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground/50 mr-1">Last</span>
              {[3, 6, 12].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={analyticsMonths === n ? 'default' : 'ghost'}
                  onClick={() => setAnalyticsMonths(n)}
                  className="h-7 text-xs"
                >
                  {n}m
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* ── Browse Tab ── */}
        {activeTab === 'browse' && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {!selectedTagId ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <Tag className="w-8 h-8 text-muted-foreground/15" />
                <p className="text-sm text-muted-foreground/50">Select a tag to browse transactions</p>
              </div>
            ) : loadingTransactions ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : tagTransactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-muted-foreground/50">No transactions with this tag</p>
              </div>
            ) : (
              <div>
                {/* Tag header */}
                {selectedStat && (
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: selectedStat.color, color: '#fff' }}
                    >
                      {selectedStat.name}
                    </span>
                    <span className="text-xs text-muted-foreground/50">
                      {selectedStat.count} transactions · ${selectedStat.total_amount.toFixed(2)} total
                    </span>
                  </div>
                )}

                {/* Transaction table */}
                <SunkenCard className="p-0 overflow-hidden">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Date</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Description</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Category</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Amount</th>
                        <th className="px-4 py-2.5 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/15">
                      {tagTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          onClick={() => setEditingTransaction(tx)}
                          className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 text-xs text-muted-foreground/60 whitespace-nowrap tabular-nums">
                            {format(parseISO(tx.date), 'MMM d, yyyy')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-foreground">{tx.description}</div>
                            {tx.original_description && tx.original_description !== tx.description && (
                              <div className="text-xs text-muted-foreground/40 truncate max-w-xs">{tx.original_description}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground/60">
                            {tx.category_name || <span className="text-muted-foreground/20">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-right whitespace-nowrap tabular-nums">
                            <span className={cn(
                              'font-medium',
                              tx.type === 'income' ? 'text-success' :
                              tx.type === 'transfer' ? 'text-primary' : 'text-foreground'
                            )}>
                              {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '→' : '-'}${Math.abs(tx.amount).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3 w-10">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveTransactionFromTag(tx.id); }}
                              className="p-1 text-muted-foreground/20 hover:text-destructive transition-colors rounded"
                              title="Remove from tag"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SunkenCard>
              </div>
            )}
          </div>
        )}

        {/* ── Analytics Tab ── */}
        {activeTab === 'analytics' && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {monthlyData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/15" />
                <p className="text-sm text-muted-foreground/50">No tagged transactions yet</p>
                <p className="text-xs text-muted-foreground/30">Run Auto-tag to get started</p>
              </div>
            ) : (
              <>
                {/* Chart */}
                <SunkenCard title="Monthly Spend by Tag">
                  <div style={{ height: 260 }}>
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
                </SunkenCard>

                {/* Breakdown table */}
                <div>
                  <SectionLabel>Tag Breakdown</SectionLabel>
                  <SunkenCard className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b border-border/30">
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Tag</th>
                            {tableMonths.map((m) => (
                              <th key={m} className="px-4 py-2.5 text-right text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                                {m}
                              </th>
                            ))}
                            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/15">
                          {chartTags.map((tagName) => {
                            const rowMonths = tableMonths.map((m) => {
                              const r = monthlyData.find((d) => d.month === m && d.tag_name === tagName);
                              return r ? r.total_amount : 0;
                            });
                            const total = rowMonths.reduce((s, v) => s + v, 0);
                            const color = tagColorMap.get(tagName) ?? '#6366f1';
                            const rowMax = Math.max(...rowMonths, 0.01);

                            return (
                              <tr key={tagName} className="hover:bg-white/[0.02] transition-colors">
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
                                        {amt > 0 ? `$${amt.toFixed(0)}` : <span className="text-muted-foreground/20">—</span>}
                                      </span>
                                      {amt > 0 && (
                                        <div className="h-0.5 rounded-full" style={{
                                          width: `${Math.max(4, (amt / rowMax) * 48)}px`,
                                          backgroundColor: color,
                                          opacity: 0.5,
                                        }} />
                                      )}
                                    </div>
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                                  ${total.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </SunkenCard>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <Modal isOpen={!!editingTransaction} onClose={() => setEditingTransaction(null)} title="Edit Transaction" size="lg">
        {editingTransaction && (
          <TransactionForm
            transaction={editingTransaction}
            onSubmit={handleUpdateTransaction}
            onCancel={() => setEditingTransaction(null)}
          />
        )}
      </Modal>

      <Modal isOpen={isNewTagOpen} onClose={() => setIsNewTagOpen(false)} title="New Tag" size="sm">
        <TagForm
          initial={{ name: '', color: '#6366f1', description: '' }}
          onSave={handleCreateTag}
          onCancel={() => setIsNewTagOpen(false)}
          submitLabel="Create Tag"
        />
      </Modal>

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

      <ConfirmDialog
        open={isClearAllOpen}
        onConfirm={handleClearAllTags}
        onCancel={() => setIsClearAllOpen(false)}
        title="Clear All Tag Assignments?"
        description="This will remove all tag assignments from every transaction. Your tag definitions will be kept, but no transactions will be tagged. This cannot be undone."
        confirmLabel="Clear All"
      />
    </div>
  );
}
