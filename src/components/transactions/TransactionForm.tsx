import { useState, useEffect } from 'react';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useTags } from '../../hooks/useTags';
import type { Transaction, CreateTransactionInput } from '../../types';
import { format } from 'date-fns';
import { X } from 'lucide-react';

interface TransactionFormProps {
  transaction?: Transaction;
  onSubmit: (data: CreateTransactionInput, tagIds: number[]) => Promise<void>;
  onCancel: () => void;
}

export default function TransactionForm({ transaction, onSubmit, onCancel }: TransactionFormProps) {
  const { accounts } = useAccounts();
  const { categories, getCategoriesByType } = useCategories();
  const { tags, loadTags } = useTags();

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [formData, setFormData] = useState<CreateTransactionInput>({
    account_id: transaction?.account_id || 0,
    category_id: transaction?.category_id || undefined,
    date: transaction?.date || format(new Date(), 'yyyy-MM-dd'),
    description: transaction?.description || '',
    original_description: transaction?.original_description || '',
    amount: transaction?.amount || 0,
    type: transaction?.type || 'expense',
    status: transaction?.status || 'cleared',
    notes: transaction?.notes || '',
    to_account_id: undefined,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tags and existing tags for this transaction
  useEffect(() => {
    loadTags();
    if (transaction?.id) {
      window.electron.invoke('tags:get-for-transaction', transaction.id).then((existingTags) => {
        setSelectedTagIds(existingTags.map((t) => t.id));
      });
    }
  }, [transaction?.id]);

  // Filter categories by transaction type (not applicable for transfers)
  const filteredCategories = formData.type !== 'transfer' ? getCategoriesByType(formData.type) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.account_id) {
      setError('Please select an account');
      return;
    }
    if (formData.type === 'transfer' && !formData.to_account_id) {
      setError('Please select a destination account for the transfer');
      return;
    }
    if (formData.type === 'transfer' && formData.account_id === formData.to_account_id) {
      setError('Source and destination accounts must be different');
      return;
    }
    if (!formData.description.trim()) {
      setError('Please enter a description');
      return;
    }
    if (formData.amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData, selectedTagIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Type Toggle */}
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-2">
          Transaction Type
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, type: 'expense', category_id: undefined, to_account_id: undefined })}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              formData.type === 'expense'
                ? 'bg-red-600 text-white'
                : 'bg-base-200 text-base-content/80 hover:bg-base-300'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, type: 'income', category_id: undefined, to_account_id: undefined })}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              formData.type === 'income'
                ? 'bg-green-600 text-white'
                : 'bg-base-200 text-base-content/80 hover:bg-base-300'
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, type: 'transfer', category_id: undefined, to_account_id: undefined })}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              formData.type === 'transfer'
                ? 'bg-blue-600 text-white'
                : 'bg-base-200 text-base-content/80 hover:bg-base-300'
            }`}
          >
            Transfer
          </button>
        </div>
      </div>

      {/* Account */}
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          {formData.type === 'transfer' ? 'From Account *' : 'Account *'}
        </label>
        <select
          value={formData.account_id}
          onChange={(e) => setFormData({ ...formData, account_id: Number(e.target.value) })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
          required
        >
          <option value={0}>Select an account...</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.institution})
            </option>
          ))}
        </select>
      </div>

      {/* To Account (for transfers) */}
      {formData.type === 'transfer' && (
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">
            To Account *
          </label>
          <select
            value={formData.to_account_id || 0}
            onChange={(e) => setFormData({ ...formData, to_account_id: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
            required
          >
            <option value={0}>Select destination account...</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.institution})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Date & Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">
            Date *
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">
            Amount *
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
            required
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Description *
        </label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
          placeholder="e.g., Grocery shopping"
          required
        />
      </div>

      {/* Category (not shown for transfers) */}
      {formData.type !== 'transfer' && (
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">
            Category
          </label>
          <select
            value={formData.category_id || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                category_id: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
          >
            <option value="">Uncategorized</option>
            {filteredCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Status
        </label>
        <select
          value={formData.status}
          onChange={(e) =>
            setFormData({ ...formData, status: e.target.value as 'pending' | 'cleared' | 'reconciled' })
          }
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
        >
          <option value="pending">Pending</option>
          <option value="cleared">Cleared</option>
          <option value="reconciled">Reconciled</option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
          rows={3}
          placeholder="Optional notes..."
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-2">
          Tags
        </label>
        {/* Assigned tags as removable chips */}
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTagIds.map((tagId) => {
            const tag = tags.find((t) => t.id === tagId);
            if (!tag) return null;
            return (
              <span
                key={tagId}
                className="badge gap-1"
                style={{ backgroundColor: tag.color, color: '#fff', borderColor: tag.color }}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => setSelectedTagIds((prev) => prev.filter((id) => id !== tagId))}
                  className="opacity-80 hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          {selectedTagIds.length === 0 && (
            <span className="text-sm text-base-content/40">No tags assigned</span>
          )}
        </div>
        {/* Dropdown to add tags */}
        <select
          value=""
          onChange={(e) => {
            const id = Number(e.target.value);
            if (id && !selectedTagIds.includes(id)) {
              setSelectedTagIds((prev) => [...prev, id]);
            }
          }}
          className="select select-sm w-full"
        >
          <option value="">Add a tag...</option>
          {tags
            .filter((t) => !selectedTagIds.includes(t.id))
            .map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isSubmitting ? 'Saving...' : transaction ? 'Update Transaction' : 'Create Transaction'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 disabled:opacity-50 font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
