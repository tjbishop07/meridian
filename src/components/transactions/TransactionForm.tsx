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
import { Label } from '@/components/ui/label';

interface TransactionFormProps {
  transaction?: Transaction;
  onSubmit: (data: CreateTransactionInput, tagIds: number[]) => Promise<void>;
  onCancel: () => void;
}

const selectClass =
  'w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50';

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

    if (!formData.account_id) return setError('Please select an account');
    if (formData.type === 'transfer' && !formData.to_account_id)
      return setError('Please select a destination account');
    if (formData.type === 'transfer' && formData.account_id === formData.to_account_id)
      return setError('Source and destination accounts must be different');
    if (!formData.description.trim()) return setError('Please enter a description');
    if (formData.amount <= 0) return setError('Amount must be greater than 0');

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Error */}
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Type segment */}
      <div className="flex rounded-md border border-border overflow-hidden">
        {(['expense', 'income', 'transfer'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFormData({ ...formData, type, category_id: undefined, to_account_id: undefined })}
            className={cn(
              'flex-1 py-2 text-sm font-medium capitalize transition-colors border-r border-border last:border-r-0',
              formData.type === type
                ? type === 'expense'
                  ? 'bg-destructive text-destructive-foreground'
                  : type === 'income'
                  ? 'bg-success text-success-foreground'
                  : 'bg-primary text-primary-foreground'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Account */}
      <div className="space-y-1.5">
        <Label>{formData.type === 'transfer' ? 'From Account' : 'Account'}</Label>
        <select
          value={formData.account_id}
          onChange={(e) => setFormData({ ...formData, account_id: Number(e.target.value) })}
          className={selectClass}
          required
        >
          <option value={0}>Select account…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name} — {a.institution}</option>
          ))}
        </select>
      </div>

      {/* To Account (transfers) */}
      {formData.type === 'transfer' && (
        <div className="space-y-1.5">
          <Label>To Account</Label>
          <select
            value={formData.to_account_id || 0}
            onChange={(e) => setFormData({ ...formData, to_account_id: Number(e.target.value) })}
            className={selectClass}
            required
          >
            <option value={0}>Select destination…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} — {a.institution}</option>
            ))}
          </select>
        </div>
      )}

      {/* Date + Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Amount</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            required
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="e.g. Grocery shopping"
          required
        />
      </div>

      {/* Category */}
      {formData.type !== 'transfer' && (
        <div className="space-y-1.5">
          <Label>Category</Label>
          <select
            value={formData.category_id || ''}
            onChange={(e) =>
              setFormData({ ...formData, category_id: e.target.value ? Number(e.target.value) : undefined })
            }
            className={selectClass}
          >
            <option value="">Uncategorized</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Status */}
      <div className="space-y-1.5">
        <Label>Status</Label>
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
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          placeholder="Optional notes…"
        />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags</Label>
        {selectedTagIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedTagIds.map((tagId) => {
              const tag = tags.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: tag.color + '33', color: tag.color }}
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => setSelectedTagIds((prev) => prev.filter((id) => id !== tagId))}
                    className="opacity-70 hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <select
          value=""
          onChange={(e) => {
            const id = Number(e.target.value);
            if (id && !selectedTagIds.includes(id)) setSelectedTagIds((prev) => [...prev, id]);
          }}
          className={selectClass}
        >
          <option value="">Add a tag…</option>
          {tags
            .filter((t) => !selectedTagIds.includes(t.id))
            .map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
        </select>
      </div>

      {/* Actions — sticky at bottom */}
      <div className="sticky bottom-0 bg-card pt-4 pb-2 border-t border-border mt-2 flex gap-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
