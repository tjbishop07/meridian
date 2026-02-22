import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Copy, TrendingUp } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { useCategories } from '../hooks/useCategories';
import Modal from '../components/ui/Modal';
import type { Budget, BudgetInput, Category } from '../types';
import { Button } from '@/components/ui/button';
import { AccentButton } from '@/components/ui/accent-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/ui/FormField';
import { EmptyState } from '@/components/ui/EmptyState';
import { AlertCircle } from 'lucide-react';
import { PageSidebar } from '@/components/ui/PageSidebar';
import { usePageEntrance } from '../hooks/usePageEntrance';
import { cn } from '@/lib/utils';

interface BudgetFormProps {
  formData: BudgetInput;
  setFormData: (data: BudgetInput) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
  expenseCategories: Category[];
  isEditing: boolean;
}

function BudgetForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  expenseCategories,
  isEditing,
}: BudgetFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <FormField label="Category" required>
        <select
          value={formData.category_id}
          onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring disabled:opacity-50"
          required
          disabled={isEditing}
        >
          <option value={0}>Select a category...</option>
          {expenseCategories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </FormField>

      <FormField label="Budget Amount" required>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            className="pl-8"
            required
          />
        </div>
      </FormField>

      <FormField label="Notes">
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
          placeholder="Optional notes..."
        />
      </FormField>

      <div className="flex items-center gap-2">
        <Checkbox
          id="rollover"
          checked={formData.rollover}
          onCheckedChange={(checked) => setFormData({ ...formData, rollover: !!checked })}
        />
        <Label htmlFor="rollover" className="text-sm cursor-pointer">
          Rollover unused budget to next month
        </Label>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Budget' : 'Create Budget'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const getProgressColor = (percentage: number) => {
  if (percentage >= 100) return 'bg-destructive';
  if (percentage >= 80) return 'bg-warning';
  return 'bg-success';
};

export default function Budgets() {
  const { categories, loadCategories, getCategoriesByType } = useCategories();
  const expenseCategories = getCategoriesByType('expense');

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [progress, setProgress] = useState<any>(null);

  const [formData, setFormData] = useState<BudgetInput>({
    category_id: 0,
    month: selectedMonth,
    amount: 0,
    rollover: false,
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sidebarClass, contentClass } = usePageEntrance();

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadBudgets(); loadProgress(); }, [selectedMonth]);

  useEffect(() => {
    if (editingBudget) {
      setFormData({
        category_id: editingBudget.category_id,
        month: editingBudget.month,
        amount: editingBudget.amount,
        rollover: editingBudget.rollover,
        notes: editingBudget.notes || '',
      });
    } else {
      resetForm();
    }
  }, [editingBudget]);

  const loadBudgets = async () => {
    try {
      setIsLoading(true);
      const data = await window.electron.invoke('budgets:get-by-month', selectedMonth);
      setBudgets(data);
    } catch (err) {
      console.error('Error loading budgets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      const data = await window.electron.invoke('budgets:get-progress', selectedMonth);
      setProgress(data);
    } catch (err) {
      console.error('Error loading progress:', err);
    }
  };

  const resetForm = () => {
    setFormData({ category_id: 0, month: selectedMonth, amount: 0, rollover: false, notes: '' });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.category_id || formData.amount <= 0) {
      setError('Please select a category and enter a valid amount');
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingBudget) {
        await window.electron.invoke('budgets:update', { ...formData, id: editingBudget.id });
        setEditingBudget(null);
      } else {
        await window.electron.invoke('budgets:create', formData);
        setIsCreateModalOpen(false);
      }
      await loadBudgets();
      await loadProgress();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save budget');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (budget: Budget) => {
    if (confirm(`Delete budget for ${budget.category_name}?`)) {
      try {
        await window.electron.invoke('budgets:delete', budget.id);
        await loadBudgets();
        await loadProgress();
      } catch (err) {
        console.error('Error deleting budget:', err);
      }
    }
  };

  const handleCopyToNextMonth = async () => {
    const nextMonth = format(addMonths(new Date(selectedMonth + '-01'), 1), 'yyyy-MM');
    try {
      const copied = await window.electron.invoke('budgets:copy-to-next-month', { from: selectedMonth, to: nextMonth });
      alert(`Copied ${copied} budgets to ${nextMonth}`);
      setSelectedMonth(nextMonth);
    } catch (err) {
      console.error('Error copying budgets:', err);
    }
  };

  return (
    <div className="flex h-full">
      <PageSidebar title="Budgets" className={sidebarClass}>
        <div className="px-3 pt-4 pb-3 space-y-2 border-b border-border/40">
          <AccentButton
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full justify-start text-xs h-8 px-3"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            New Budget
          </AccentButton>
          {budgets.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleCopyToNextMonth}
              className="w-full justify-start text-xs h-8 gap-2">
              <Copy className="w-3.5 h-3.5 shrink-0" />
              Copy to Next Month
            </Button>
          )}
        </div>
        <div className="px-4 pt-4 pb-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/35 mb-2">
            Month
          </p>
          <Input type="month" value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full h-8 text-xs" />
        </div>
      </PageSidebar>

      <div className={cn('flex-1 flex flex-col overflow-hidden', contentClass)}>
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 space-y-4">
        {/* Overall Progress */}
        {progress && budgets.length > 0 && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Overall Progress</h2>
                <p className="text-sm text-muted-foreground">
                  ${progress.total_spent.toFixed(2)} of ${progress.total_budgeted.toFixed(2)} spent
                </p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${progress.remaining >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ${Math.abs(progress.remaining).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {progress.remaining >= 0 ? 'remaining' : 'over budget'}
                </p>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all ${getProgressColor(progress.percentage)}`}
                style={{ width: `${Math.min(progress.percentage, 100)}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              {progress.percentage.toFixed(1)}% of total budget used
            </p>
          </div>
        )}

        {/* Budget List */}
        {isLoading ? (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : budgets.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <EmptyState
              message={`No budgets set for ${selectedMonth}`}
              icon={<AlertCircle className="w-12 h-12" />}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {budgets.map((budget) => {
              const percentage = budget.amount > 0 ? (budget.spent! / budget.amount) * 100 : 0;
              const isOverBudget = budget.spent! > budget.amount;
              return (
                <div key={budget.id} className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">{budget.category_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        ${budget.spent!.toFixed(2)} of ${budget.amount.toFixed(2)} spent
                        {budget.notes && ` • ${budget.notes}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`text-xl font-bold ${isOverBudget ? 'text-destructive' : 'text-success'}`}>
                          ${Math.abs(budget.remaining!).toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {isOverBudget ? 'over' : 'remaining'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingBudget(budget)}
                          className="p-2 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(budget)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${getProgressColor(percentage)}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-muted-foreground">{percentage.toFixed(1)}% used</p>
                    {isOverBudget && (
                      <div className="flex items-center gap-1 text-destructive">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm font-medium">{(percentage - 100).toFixed(1)}% over</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); resetForm(); }} title="Add Budget" size="md">
        <BudgetForm formData={formData} setFormData={setFormData} onSubmit={handleSubmit}
          onCancel={() => { setIsCreateModalOpen(false); resetForm(); }}
          isSubmitting={isSubmitting} error={error} expenseCategories={expenseCategories} isEditing={false} />
      </Modal>

      <Modal isOpen={!!editingBudget} onClose={() => { setEditingBudget(null); resetForm(); }} title="Edit Budget" size="md">
        <BudgetForm formData={formData} setFormData={setFormData} onSubmit={handleSubmit}
          onCancel={() => { setEditingBudget(null); resetForm(); }}
          isSubmitting={isSubmitting} error={error} expenseCategories={expenseCategories} isEditing={true} />
      </Modal>
      </div>
    </div>
  );
}
