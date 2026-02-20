import { useEffect, useState } from 'react';
import { Plus, Search, Filter, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTransactions } from '../hooks/useTransactions';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';
import Modal from '../components/ui/Modal';
import TransactionForm from '../components/transactions/TransactionForm';
import PageHeader from '../components/layout/PageHeader';
import type { Transaction, CreateTransactionInput, Tag } from '../types';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const selectClass = 'px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring text-sm';

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
        toast.success('Transaction deleted successfully');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to delete transaction';
        toast.error(errorMsg);
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
    if (selectedMonth) {
      if (t.date.substring(0, 7) !== selectedMonth) return false;
    }
    if (showUncategorized && (t.category_id || t.type === 'transfer')) return false;
    if (selectedTagId) {
      const txTags = transactionTags.get(t.id) || [];
      if (!txTags.some((tag) => tag.id === selectedTagId)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedMonth, selectedAccountId, showUncategorized, selectedTagId]);

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Transactions" />
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6">
            <p className="text-destructive">{error}</p>
            <Button onClick={() => loadTransactions()} variant="destructive" className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Transactions"
        action={
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-5 h-5 mr-2" />
            Add Transaction
          </Button>
        }
      >
        {/* Filters */}
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-40"
          />

          <select
            value={selectedAccountId || ''}
            onChange={(e) => setSelectedAccount(e.target.value ? Number(e.target.value) : null)}
            className={selectClass}
          >
            <option value="">All Accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>

          <select
            value={selectedTagId || ''}
            onChange={(e) => setSelectedTagId(e.target.value ? Number(e.target.value) : null)}
            className={selectClass}
          >
            <option value="">All Tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>

          <Button
            variant={showUncategorized ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowUncategorized((v) => !v)}
            className={showUncategorized ? 'bg-warning text-white hover:bg-warning/80' : ''}
          >
            <Filter className="w-4 h-4 mr-1" />
            Uncategorized
          </Button>
        </div>
      </PageHeader>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col">
        {isLoading ? (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
            <p className="text-muted-foreground text-lg mb-4">
              {searchQuery || selectedAccountId || selectedMonth
                ? 'No transactions match your filters'
                : 'No transactions yet'}
            </p>
            {!searchQuery && !selectedAccountId && !selectedMonth && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="text-primary font-medium hover:underline"
              >
                Create your first transaction
              </button>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col flex-1 overflow-hidden">
            {/* Fixed Header */}
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-48">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-48">Account</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">Balance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">Actions</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto">
              <table className="min-w-full table-fixed">
                <tbody className="bg-card divide-y divide-border">
                  {paginatedTransactions.map((transaction) => {
                    const isUncategorized = !transaction.category_id && transaction.type !== 'transfer';
                    return (
                      <tr
                        key={transaction.id}
                        onClick={() => setEditingTransaction(transaction)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isUncategorized
                            ? 'bg-violet-500/10 hover:bg-violet-500/15'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <td className={cn('px-6 py-4 whitespace-nowrap text-sm w-32', isUncategorized ? 'text-violet-400' : 'text-foreground')}>
                          {format(parseISO(transaction.date), 'MMM d, yyyy')}
                        </td>
                        <td className={cn('px-6 py-4 text-sm', isUncategorized ? 'text-violet-400' : 'text-foreground')}>
                          <div className="font-medium">{transaction.description}</div>
                          {transaction.original_description && transaction.original_description !== transaction.description && (
                            <div className={cn('text-xs truncate max-w-md', isUncategorized ? 'text-violet-400/70' : 'text-muted-foreground')}>
                              {transaction.original_description}
                            </div>
                          )}
                          {(transactionTags.get(transaction.id) || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(transactionTags.get(transaction.id) || []).map((tag) => (
                                <span
                                  key={tag.id}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: tag.color, color: '#fff' }}
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground w-48">
                          {transaction.type === 'transfer' ? (
                            <span className="text-primary font-medium">
                              Transfer {transaction.linked_account_name && `→ ${transaction.linked_account_name}`}
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
                                  toast.success('Category updated successfully');
                                } catch (error) {
                                  const errorMsg = error instanceof Error ? error.message : 'Failed to update category';
                                  toast.error(errorMsg);
                                }
                              }}
                              className="w-full px-2 py-1 border border-border rounded-md bg-background text-foreground text-sm focus:ring-1 focus:ring-ring"
                            >
                              <option value="">Uncategorized</option>
                              {categories
                                .filter((c) => c.type === transaction.type)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                          )}
                        </td>
                        <td className={cn('px-6 py-4 whitespace-nowrap text-sm w-48', isUncategorized ? 'text-violet-400' : 'text-muted-foreground')}>
                          {transaction.account_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right w-32">
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums',
                              transaction.type === 'income'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : transaction.type === 'transfer'
                                ? 'bg-sky-500/15 text-sky-400'
                                : 'bg-rose-500/15 text-rose-400'
                            )}
                          >
                            {transaction.type === 'income' ? '+' : transaction.type === 'transfer' ? '⇄' : '−'}$
                            {Math.abs(transaction.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-muted-foreground w-32">
                          {transaction.balance !== null && transaction.balance !== undefined ? (
                            `$${transaction.balance.toFixed(2)}`
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right w-24">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingTransaction(transaction); }}
                              className="p-1 text-muted-foreground hover:text-primary transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(transaction.id); }}
                              disabled={deletingId === transaction.id}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Fixed Pagination Footer */}
            {filteredTransactions.length > 0 && (
              <div className="flex items-center justify-between px-4 pt-3 pb-4 border-t border-border bg-muted/50">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {startIndex + 1}–{Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length}
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="text-sm px-2 py-1 border border-border rounded bg-background text-foreground"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  {[
                    { label: '‹‹', onClick: () => setCurrentPage(1), disabled: currentPage === 1 },
                    { label: '‹', onClick: () => setCurrentPage(currentPage - 1), disabled: currentPage === 1 },
                    { label: '›', onClick: () => setCurrentPage(currentPage + 1), disabled: currentPage === totalPages },
                    { label: '››', onClick: () => setCurrentPage(totalPages), disabled: currentPage === totalPages },
                  ].map(({ label, onClick, disabled }, i) => (
                    <button
                      key={i}
                      onClick={onClick}
                      disabled={disabled}
                      className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground disabled:text-muted-foreground/30 disabled:cursor-not-allowed"
                    >
                      {label}
                    </button>
                  ))}
                  <span className="px-3 py-1 text-sm text-foreground">{currentPage}/{totalPages}</span>
                </div>
              </div>
            )}
          </div>
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
