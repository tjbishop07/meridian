import { useState, useEffect } from 'react';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useTags } from '../../hooks/useTags';
import type { Transaction, CreateTransactionInput } from '../../types';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/FormField';

interface TransactionFormProps {
  transaction?: Transaction;
  onSubmit: (data: CreateTransactionInput, tagIds: number[]) => Promise<void>;
  onCancel: () => void;
}

const selectClass = 'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring disabled:opacity-50 text-sm';

export default function TransactionForm({ transaction, onSubmit, onCancel }: TransactionFormProps) {
  const { accounts } = useAccounts();
  const { getCategoriesByType } = useCategories();
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

  useEffect(() => {
    loadTags();
    if (transaction?.id) {
      window.electron.invoke('tags:get-for-transaction', transaction.id).then((existingTags) => {
        setSelectedTagIds(existingTags.map((t) => t.id));
      });
    }
  }, [transaction?.id]);

  const filteredCategories = formData.type !== 'transfer' ? getCategoriesByType(formData.type) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Type Toggle */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">Transaction Type</label>
        <div className="flex gap-2">
          {(['expense', 'income', 'transfer'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFormData({ ...formData, type, category_id: undefined, to_account_id: undefined })}
              className={cn(
                'flex-1 px-4 py-2 rounded-lg font-medium capitalize transition-colors text-sm',
                formData.type === type
                  ? type === 'expense'
                    ? 'bg-destructive text-destructive-foreground'
                    : type === 'income'
                    ? 'bg-success text-white'
                    : 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Account */}
      <FormField label={formData.type === 'transfer' ? 'From Account' : 'Account'} required>
        <select
          value={formData.account_id}
          onChange={(e) => setFormData({ ...formData, account_id: Number(e.target.value) })}
          className={selectClass}
          required
        >
          <option value={0}>Select an account...</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.institution})
            </option>
          ))}
        </select>
      </FormField>

      {/* To Account (for transfers) */}
      {formData.type === 'transfer' && (
        <FormField label="To Account" required>
          <select
            value={formData.to_account_id || 0}
            onChange={(e) => setFormData({ ...formData, to_account_id: Number(e.target.value) })}
            className={selectClass}
            required
          >
            <option value={0}>Select destination account...</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.institution})
              </option>
            ))}
          </select>
        </FormField>
      )}

      {/* Date & Amount */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Date" required>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </FormField>
        <FormField label="Amount" required>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            required
          />
        </FormField>
      </div>

      {/* Description */}
      <FormField label="Description" required>
        <Input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="e.g., Grocery shopping"
          required
        />
      </FormField>

      {/* Category (not shown for transfers) */}
      {formData.type !== 'transfer' && (
        <FormField label="Category">
          <select
            value={formData.category_id || ''}
            onChange={(e) =>
              setFormData({ ...formData, category_id: e.target.value ? Number(e.target.value) : undefined })
            }
            className={selectClass}
          >
            <option value="">Uncategorized</option>
            {filteredCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FormField>
      )}

      {/* Status */}
      <FormField label="Status">
        <select
          value={formData.status}
          onChange={(e) =>
            setFormData({ ...formData, status: e.target.value as 'pending' | 'cleared' | 'reconciled' })
          }
          className={selectClass}
        >
          <option value="pending">Pending</option>
          <option value="cleared">Cleared</option>
          <option value="reconciled">Reconciled</option>
        </select>
      </FormField>

      {/* Notes */}
      <FormField label="Notes">
        <Textarea
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          placeholder="Optional notes..."
        />
      </FormField>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTagIds.map((tagId) => {
            const tag = tags.find((t) => t.id === tagId);
            if (!tag) return null;
            return (
              <span
                key={tagId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
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
            <span className="text-sm text-muted-foreground">No tags assigned</span>
          )}
        </div>
        <select
          value=""
          onChange={(e) => {
            const id = Number(e.target.value);
            if (id && !selectedTagIds.includes(id)) {
              setSelectedTagIds((prev) => [...prev, id]);
            }
          }}
          className={selectClass}
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
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Saving...' : transaction ? 'Update Transaction' : 'Create Transaction'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
