import { useState, useEffect } from 'react';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useTags } from '../../hooks/useTags';
import type { Transaction, CreateTransactionInput, Receipt } from '../../types';
import { ReceiptViewer } from '../receipts/ReceiptViewer';
import { format } from 'date-fns';
import { X, TrendingDown, TrendingUp, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface TransactionFormProps {
  transaction?: Transaction;
  receipt?: Receipt | null;
  onSubmit: (data: CreateTransactionInput, tagIds: number[]) => Promise<void>;
  onCancel: () => void;
  onReceiptDeleted?: () => void;
}

const TYPE_CONFIG = {
  expense: {
    icon: TrendingDown,
    label: 'Expense',
    activeClass: 'bg-rose-500 text-white shadow-sm',
    amountClass: 'text-rose-500',
    accentBorder: 'border-rose-500',
  },
  income: {
    icon: TrendingUp,
    label: 'Income',
    activeClass: 'bg-emerald-500 text-white shadow-sm',
    amountClass: 'text-emerald-500',
    accentBorder: 'border-emerald-500',
  },
  transfer: {
    icon: ArrowLeftRight,
    label: 'Transfer',
    activeClass: 'bg-sky-500 text-white shadow-sm',
    amountClass: 'text-sky-500',
    accentBorder: 'border-sky-500',
  },
} as const;

const labelClass = 'text-xs font-medium text-muted-foreground';

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

const selectClass =
  'w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 cursor-pointer';

export default function TransactionForm({ transaction, receipt, onSubmit, onCancel, onReceiptDeleted }: TransactionFormProps) {
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

  const currentType = TYPE_CONFIG[formData.type];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0 mt-1.5" />
          {error}
        </div>
      )}

      {/* Type Switcher */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-xl border border-border/40">
        {(Object.entries(TYPE_CONFIG) as [keyof typeof TYPE_CONFIG, (typeof TYPE_CONFIG)[keyof typeof TYPE_CONFIG]][]).map(
          ([type, cfg]) => {
            const Icon = cfg.icon;
            const isActive = formData.type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() =>
                  setFormData({ ...formData, type, category_id: undefined, to_account_id: undefined })
                }
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
                  isActive ? cfg.activeClass : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
              </button>
            );
          }
        )}
      </div>

      {/* Amount — prominent */}
      <div className={cn('space-y-1.5 border-l-2 pl-3', currentType.accentBorder)}>
        <Label className={labelClass}>Amount</Label>
        <div className="relative">
          <span
            className={cn(
              'absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-light pointer-events-none transition-colors duration-200',
              currentType.amountClass
            )}
          >
            $
          </span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.amount || ''}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            className="pl-8 h-12 text-2xl font-semibold tabular-nums"
            placeholder="0.00"
            required
          />
        </div>
      </div>

      {/* Date + Status */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className={labelClass}>Date</Label>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className={labelClass}>Status</Label>
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
      </div>

      <SectionDivider label="Details" />

      {/* Description */}
      <div className="space-y-1.5">
        <Label className={labelClass}>Description</Label>
        <Input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="e.g. Grocery shopping"
          required
        />
      </div>

      {/* Account */}
      <div className="space-y-1.5">
        <Label className={labelClass}>
          {formData.type === 'transfer' ? 'From Account' : 'Account'}
        </Label>
        <select
          value={formData.account_id}
          onChange={(e) => setFormData({ ...formData, account_id: Number(e.target.value) })}
          className={selectClass}
          required
        >
          <option value={0}>Select account…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.institution}
            </option>
          ))}
        </select>
      </div>

      {/* To Account (transfers) */}
      {formData.type === 'transfer' && (
        <div className="space-y-1.5">
          <Label className={labelClass}>To Account</Label>
          <select
            value={formData.to_account_id || 0}
            onChange={(e) => setFormData({ ...formData, to_account_id: Number(e.target.value) })}
            className={selectClass}
            required
          >
            <option value={0}>Select destination…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.institution}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Category */}
      {formData.type !== 'transfer' && (
        <div className="space-y-1.5">
          <Label className={labelClass}>Category</Label>
          <select
            value={formData.category_id || ''}
            onChange={(e) =>
              setFormData({ ...formData, category_id: e.target.value ? Number(e.target.value) : undefined })
            }
            className={selectClass}
          >
            <option value="">Uncategorized</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <SectionDivider label="Notes & Tags" />

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className={labelClass}>Notes</Label>
        <Textarea
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
          placeholder="Optional notes…"
          className="resize-none"
        />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label className={labelClass}>Tags</Label>
        {selectedTagIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedTagIds.map((tagId) => {
              const tag = tags.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: tag.color + '22',
                    color: tag.color,
                    border: `1px solid ${tag.color}44`,
                  }}
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => setSelectedTagIds((prev) => prev.filter((id) => id !== tagId))}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        {tags.filter((t) => !selectedTagIds.includes(t.id)).length > 0 && (
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
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* Receipt */}
      {receipt && onReceiptDeleted && (
        <ReceiptViewer receipt={receipt} onDeleted={onReceiptDeleted} />
      )}

      {/* Actions — sticky at bottom */}
      <div className="sticky bottom-0 bg-card/95 backdrop-blur-sm pt-3 pb-1 border-t border-border mt-2 flex gap-2">
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
