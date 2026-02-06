import { useEffect, useState } from 'react';
import { Plus, Search, Filter, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTransactions } from '../hooks/useTransactions';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { useStore } from '../store';
import Modal from '../components/ui/Modal';
import TransactionForm from '../components/transactions/TransactionForm';
import type { Transaction, CreateTransactionInput } from '../types';
import { format } from 'date-fns';

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

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Load data on mount
  useEffect(() => {
    loadAccounts();
    loadCategories();
    loadTransactions();
  }, []);

  const handleCreate = async (data: CreateTransactionInput) => {
    await createTransaction(data);
    setIsCreateModalOpen(false);
  };

  const handleUpdate = async (data: CreateTransactionInput) => {
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
      to_account_id: data.to_account_id
    };
    await updateTransaction(updateData);
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

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        t.description.toLowerCase().includes(query) ||
        t.original_description?.toLowerCase().includes(query) ||
        t.category_name?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Month filter
    if (selectedMonth) {
      const transactionMonth = t.date.substring(0, 7); // Extract YYYY-MM
      if (transactionMonth !== selectedMonth) return false;
    }

    return true;
  });

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-base-content mb-6">Transactions</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => loadTransactions()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-content">Transactions</h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="bg-base-100 rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/50" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Month Filter */}
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
          />

          {/* Account Filter */}
          <select
            value={selectedAccountId || ''}
            onChange={(e) => setSelectedAccount(e.target.value ? Number(e.target.value) : null)}
            className="px-4 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">All Accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transaction List */}
      {isLoading ? (
        <div className="bg-base-100 rounded-lg shadow-sm p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-base-300 rounded"></div>
            ))}
          </div>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-base-100 rounded-lg shadow-sm p-12 text-center">
          <p className="text-base-content/70 text-lg mb-4">
            {searchQuery || selectedAccountId || selectedMonth
              ? 'No transactions match your filters'
              : 'No transactions yet'}
          </p>
          {!searchQuery && !selectedAccountId && !selectedMonth && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="text-primary hover:text-primary font-medium"
            >
              Create your first transaction
            </button>
          )}
        </div>
      ) : (
        <div className="bg-base-100 rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-base-300">
            <thead className="bg-base-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-base-content/60 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-base-content/60 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-base-100 divide-y divide-base-300">
              {filteredTransactions.map((transaction) => {
                const isUncategorized = !transaction.category_id && transaction.type !== 'transfer';
                return (
                <tr
                  key={transaction.id}
                  className={`transition-colors ${
                    isUncategorized
                      ? 'bg-warning/10 hover:bg-warning/20 border-l-4 border-warning'
                      : 'hover:bg-base-200'
                  }`}
                >
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isUncategorized ? 'text-warning' : 'text-base-content'}`}>
                    {format(new Date(transaction.date), 'MMM d, yyyy')}
                  </td>
                  <td className={`px-6 py-4 text-sm ${isUncategorized ? 'text-warning' : 'text-base-content'}`}>
                    <div className="font-medium">{transaction.description}</div>
                    {transaction.original_description && transaction.original_description !== transaction.description && (
                      <div className={`text-xs truncate max-w-md ${isUncategorized ? 'text-warning/80' : 'text-base-content/60'}`}>
                        {transaction.original_description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content/70">
                    {transaction.type === 'transfer' ? (
                      <span className="text-info font-medium">
                        Transfer {transaction.linked_account_name && `→ ${transaction.linked_account_name}`}
                      </span>
                    ) : (
                      <select
                        value={transaction.category_id ?? ''}
                        onChange={async (e) => {
                          const category_id = e.target.value ? Number(e.target.value) : undefined;
                          try {
                            await updateTransaction({ id: transaction.id, category_id }, true);
                            toast.success('Category updated successfully');
                          } catch (error) {
                            const errorMsg = error instanceof Error ? error.message : 'Failed to update category';
                            toast.error(errorMsg);
                          }
                        }}
                        className="px-2 py-1 border border-base-300 rounded bg-base-100 text-sm text-base-content focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer"
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
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isUncategorized ? 'text-warning' : 'text-base-content/70'}`}>
                    {transaction.account_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <span
                      className={
                        transaction.type === 'income'
                          ? 'text-green-600 font-medium'
                          : transaction.type === 'transfer'
                          ? 'text-blue-600 font-medium'
                          : 'text-red-600'
                      }
                    >
                      {transaction.type === 'income' ? '+' : transaction.type === 'transfer' ? '→' : '-'}$
                      {Math.abs(transaction.amount).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingTransaction(transaction)}
                        className="p-1 text-base-content/50 hover:text-primary transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        disabled={deletingId === transaction.id}
                        className="p-1 text-base-content/50 hover:text-red-600 transition-colors disabled:opacity-50"
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
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Transaction"
        size="lg"
      >
        <TransactionForm onSubmit={handleCreate} onCancel={() => setIsCreateModalOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        title="Edit Transaction"
        size="lg"
      >
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
