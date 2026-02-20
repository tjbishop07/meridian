import { useEffect, useState } from 'react';
import { Plus, Search, Filter, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTransactions } from '../hooks/useTransactions';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';
import Modal from '../components/ui/Modal';
import TransactionForm from '../components/transactions/TransactionForm';
import type { Transaction, CreateTransactionInput, Tag } from '../types';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function Transactions() {
  const {
    transactions,
    isLoading,
    error,
    loadTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactions();

  const { accounts, loadAccounts, selectedAccountId, setSelectedAccount } = useAccounts();
  const { categories, loadCategories } = useCategories();
  const { tags, loadTags, setTagsForTransaction } = useTags();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [showUncategorized, setShowUncategorized] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [transactionTags, setTransactionTags] = useState<Map<number, Tag[]>>(new Map());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    loadAccounts();
    loadCategories();
    loadTags();
    loadTransactions();
  }, []);

  const refreshTagMap = async () => {
    try {
      const rows = await window.electron.invoke('tags:get-all-transaction-tags');
      const map = new Map<number, Tag[]>();
      for (const row of rows) {
        const existing = map.get(row.transaction_id) || [];
        existing.push({ id: row.tag_id, name: row.tag_name, color: row.tag_color, created_at: '' });
        map.set(row.transaction_id, existing);
      }
      setTransactionTags(map);
    } catch (err) {
      console.error('Failed to load transaction tags', err);
    }
  };

  useEffect(() => {
    if (transactions.length > 0) refreshTagMap();
  }, [transactions.length > 0]);

  const handleCreate = async (data: CreateTransactionInput, tagIds: number[]) => {
    const tx = await createTransaction(data);
    if (tx && tagIds.length > 0) {
      await setTagsForTransaction((tx as any).id, tagIds);
      await refreshTagMap();
    }
    setIsCreateModalOpen(false);
  };

  const handleUpdate = async (data: CreateTransactionInput, tagIds: number[]) => {
    if (!editingTransaction) return;
    const updateData: any = {
      id: editingTransaction.id,
      type: data.type,
      account_id: data.account_id,
      category_id: data.category_id,
      date: data.date,
      description: data.description,
      amount: data.amount,
      status: data.status,
      notes: data.notes,
      to_account_id: data.to_account_id,
    };
    await updateTransaction(updateData, true);
    await setTagsForTransaction(editingTransaction.id, tagIds);
    setTransactionTags((prev) => {
      const next = new Map(prev);
      next.set(editingTransaction.id, tags.filter((t) => tagIds.includes(t.id)));
      return next;
    });
    setEditingTransaction(null);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      setDeletingId(id);
      try {
        await deleteTransaction(id);
        toast.success('Transaction deleted');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        t.description.toLowerCase().includes(query) ||
        t.original_description?.toLowerCase().includes(query) ||
        t.category_name?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    if (selectedMonth && t.date.substring(0, 7) !== selectedMonth) return false;
    if (showUncategorized && (t.category_id || t.type === 'transfer')) return false;
    if (selectedTagId) {
      const txTags = transactionTags.get(t.id) || [];
      if (!txTags.some((tag) => tag.id === selectedTagId)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedMonth, selectedAccountId, showUncategorized, selectedTagId]);

  if (error) {
    return (
      <div className="flex-1 p-6">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => loadTransactions()} variant="destructive" size="sm" className="mt-3">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-4 py-3 flex gap-2 items-center border-b border-border/60 flex-shrink-0">
        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add
        </Button>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-36 h-8 text-sm"
        />

        <select
          value={selectedAccountId || ''}
          onChange={(e) => setSelectedAccount(e.target.value ? Number(e.target.value) : null)}
          className="h-8 px-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select
          value={selectedTagId || ''}
          onChange={(e) => setSelectedTagId(e.target.value ? Number(e.target.value) : null)}
          className="h-8 px-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <button
          onClick={() => setShowUncategorized((v) => !v)}
          className={cn(
            'h-8 px-3 text-sm rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap',
            showUncategorized
              ? 'bg-warning/15 text-warning border border-warning/30'
              : 'border border-border text-muted-foreground hover:text-foreground hover:border-border/80'
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Uncategorized
        </button>
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-muted/40 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground mb-3">
                {searchQuery || selectedAccountId || selectedMonth
                  ? 'No transactions match your filters'
                  : 'No transactions yet'}
              </p>
              {!searchQuery && !selectedAccountId && !selectedMonth && (
                <button onClick={() => setIsCreateModalOpen(true)} className="text-sm text-primary hover:underline">
                  Add your first transaction
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Fixed thead */}
            <div className="overflow-x-auto flex-shrink-0 border-b border-border/60">
              <table className="min-w-full table-fixed">
                <thead>
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium w-28">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Description</th>
                    <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium w-44">Category</th>
                    <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium w-36">Account</th>
                    <th className="px-4 py-2.5 text-right text-xs text-muted-foreground font-medium w-28">Amount</th>
                    <th className="px-4 py-2.5 text-right text-xs text-muted-foreground font-medium w-28">Balance</th>
                    <th className="w-16" />
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scrollable tbody */}
            <div className="flex-1 overflow-y-auto">
              <table className="min-w-full table-fixed">
                <tbody className="divide-y divide-border/50">
                  {paginatedTransactions.map((transaction) => {
                    const isUncategorized = !transaction.category_id && transaction.type !== 'transfer';
                    const txTags = transactionTags.get(transaction.id) || [];
                    return (
                      <tr
                        key={transaction.id}
                        onClick={() => setEditingTransaction(transaction)}
                        className={cn(
                          'group cursor-pointer transition-all hover:bg-muted/30',
                          isUncategorized && 'opacity-50 hover:opacity-80'
                        )}
                      >
                        {/* Date */}
                        <td className="px-4 py-3 text-xs text-muted-foreground w-28 whitespace-nowrap">
                          {format(parseISO(transaction.date), 'MMM d, yyyy')}
                        </td>

                        {/* Description */}
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-foreground">
                            {transaction.description}
                          </div>
                          {transaction.original_description && transaction.original_description !== transaction.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-sm mt-0.5">
                              {transaction.original_description}
                            </div>
                          )}
                          {txTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {txTags.map((tag) => (
                                <span
                                  key={tag.id}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: tag.color + '33', color: tag.color }}
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3 w-44">
                          {transaction.type === 'transfer' ? (
                            <span className="text-xs text-primary">
                              Transfer{transaction.linked_account_name && ` → ${transaction.linked_account_name}`}
                            </span>
                          ) : (
                            <select
                              value={transaction.category_id ?? ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={async (e) => {
                                e.stopPropagation();
                                const category_id = e.target.value ? Number(e.target.value) : undefined;
                                try {
                                  await updateTransaction({ id: transaction.id, category_id }, true);
                                  toast.success('Category updated');
                                } catch {
                                  toast.error('Failed to update category');
                                }
                              }}
                              className="w-full text-xs bg-transparent text-muted-foreground border border-transparent hover:border-border focus:border-ring focus:outline-none rounded px-1 py-0.5 cursor-pointer transition-colors"
                            >
                              <option value="">Uncategorized</option>
                              {categories
                                .filter((c) => c.type === transaction.type)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                          )}
                        </td>

                        {/* Account */}
                        <td className="px-4 py-3 text-xs text-muted-foreground w-36 whitespace-nowrap truncate">
                          {transaction.account_name}
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3 text-sm text-right w-28 whitespace-nowrap tabular-nums">
                          <span className={cn(
                            'font-medium',
                            transaction.type === 'income' ? 'text-success' :
                            transaction.type === 'transfer' ? 'text-primary' :
                            'text-foreground'
                          )}>
                            {transaction.type === 'income' ? '+' : transaction.type === 'transfer' ? '⇄ ' : ''}
                            ${Math.abs(transaction.amount).toFixed(2)}
                          </span>
                        </td>

                        {/* Balance */}
                        <td className="px-4 py-3 text-xs text-right text-muted-foreground w-28 whitespace-nowrap tabular-nums">
                          {transaction.balance != null
                            ? `$${transaction.balance.toFixed(2)}`
                            : <span className="text-muted-foreground/30">—</span>
                          }
                        </td>

                        {/* Actions — only visible on row hover */}
                        <td className="px-2 py-3 w-16">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingTransaction(transaction); }}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(transaction.id); }}
                              disabled={deletingId === transaction.id}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 pt-2.5 pb-6 border-t border-border/60 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {startIndex + 1}–{Math.min(startIndex + pageSize, filteredTransactions.length)} of {filteredTransactions.length}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="text-xs px-1.5 py-1 border border-border rounded bg-background text-foreground focus:outline-none"
                >
                  {[25, 50, 100, 250].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <div className="flex rounded-md overflow-hidden border border-primary">
                  {[
                    { label: '«', action: () => setCurrentPage(1), disabled: currentPage === 1 },
                    { label: '‹', action: () => setCurrentPage((p) => p - 1), disabled: currentPage === 1 },
                    { label: '›', action: () => setCurrentPage((p) => p + 1), disabled: currentPage === totalPages },
                    { label: '»', action: () => setCurrentPage(totalPages), disabled: currentPage === totalPages },
                  ].map(({ label, action, disabled }, i) => (
                    <button
                      key={i}
                      onClick={action}
                      disabled={disabled}
                      className="w-8 h-8 text-sm font-medium bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-r border-primary-foreground/20 last:border-r-0"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Add Transaction" size="lg">
        <TransactionForm onSubmit={handleCreate} onCancel={() => setIsCreateModalOpen(false)} />
      </Modal>

      <Modal isOpen={!!editingTransaction} onClose={() => setEditingTransaction(null)} title="Edit Transaction" size="lg">
        {editingTransaction && (
          <TransactionForm
            transaction={editingTransaction}
            onSubmit={handleUpdate}
            onCancel={() => setEditingTransaction(null)}
          />
        )}
      </Modal>
    </div>
  );
}
