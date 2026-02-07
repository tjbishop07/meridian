import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Copy, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { useCategories } from '../hooks/useCategories';
import Modal from '../components/ui/Modal';
import type { Budget, BudgetInput, Category } from '../types';

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
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Category *
        </label>
        <select
          value={formData.category_id}
          onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          required
          disabled={isEditing}
        >
          <option value={0}>Select a category...</option>
          {expenseCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Budget Amount *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            className="w-full pl-8 pr-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          rows={2}
          placeholder="Optional notes..."
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="rollover"
          checked={formData.rollover}
          onChange={(e) => setFormData({ ...formData, rollover: e.target.checked })}
          className="w-4 h-4 text-primary border-base-300 rounded focus:ring-primary"
        />
        <label htmlFor="rollover" className="ml-2 text-sm text-base-content/80">
          Rollover unused budget to next month
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 disabled:opacity-50 font-medium"
        >
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Budget' : 'Create Budget'}
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

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadBudgets();
    loadProgress();
  }, [selectedMonth]);

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
    setFormData({
      category_id: 0,
      month: selectedMonth,
      amount: 0,
      rollover: false,
      notes: '',
    });
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
      const copied = await window.electron.invoke('budgets:copy-to-next-month', {
        from: selectedMonth,
        to: nextMonth,
      });
      alert(`Copied ${copied} budgets to ${nextMonth}`);
      setSelectedMonth(nextMonth);
    } catch (err) {
      console.error('Error copying budgets:', err);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };


  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="p-4 flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Budgets</h1>
          <p className="text-base-content/70 mt-1">Track your spending against monthly budgets</p>
        </div>
        <div className="flex gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
          {budgets.length > 0 && (
            <button
              onClick={handleCopyToNextMonth}
              className="flex items-center gap-2 px-4 py-2 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 font-medium"
            >
              <Copy className="w-4 h-4" />
              Copy to Next Month
            </button>
          )}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Budget
          </button>
        </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Overall Progress */}
      {progress && budgets.length > 0 && (
        <div className="bg-base-100 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-base-content">Overall Progress</h2>
              <p className="text-sm text-base-content/70">
                ${progress.total_spent.toFixed(2)} of ${progress.total_budgeted.toFixed(2)} spent
              </p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${progress.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(progress.remaining).toFixed(2)}
              </p>
              <p className="text-sm text-base-content/70">
                {progress.remaining >= 0 ? 'remaining' : 'over budget'}
              </p>
            </div>
          </div>
          <div className="w-full bg-base-300 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all ${getProgressColor(progress.percentage)}`}
              style={{ width: `${Math.min(progress.percentage, 100)}%` }}
            />
          </div>
          <p className="text-sm text-base-content/70 mt-2 text-center">
            {progress.percentage.toFixed(1)}% of total budget used
          </p>
        </div>
      )}

      {/* Budget List */}
      {isLoading ? (
        <div className="bg-base-100 rounded-lg shadow-sm p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-base-300 rounded"></div>
            ))}
          </div>
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-base-100 rounded-lg shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 text-base-content/50 mx-auto mb-3" />
          <p className="text-base-content/70 text-lg mb-4">No budgets set for {selectedMonth}</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="text-primary hover:text-primary font-medium"
          >
            Create your first budget
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {budgets.map((budget) => {
            const percentage = budget.amount > 0 ? (budget.spent! / budget.amount) * 100 : 0;
            const isOverBudget = budget.spent! > budget.amount;

            return (
              <div key={budget.id} className="bg-base-100 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-base-content">{budget.category_name}</h3>
                    <p className="text-sm text-base-content/70">
                      ${budget.spent!.toFixed(2)} of ${budget.amount.toFixed(2)} spent
                      {budget.notes && ` • ${budget.notes}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-xl font-bold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                        ${Math.abs(budget.remaining!).toFixed(2)}
                      </p>
                      <p className="text-sm text-base-content/70">
                        {isOverBudget ? 'over' : 'remaining'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingBudget(budget)}
                        className="p-2 text-base-content/50 hover:text-primary transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(budget)}
                        className="p-2 text-base-content/50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="w-full bg-base-300 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${getProgressColor(percentage)}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-base-content/70">{percentage.toFixed(1)}% used</p>
                  {isOverBudget && (
                    <div className="flex items-center gap-1 text-red-600">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {((percentage - 100)).toFixed(1)}% over
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetForm();
        }}
        title="Add Budget"
        size="md"
      >
        <BudgetForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsCreateModalOpen(false);
            resetForm();
          }}
          isSubmitting={isSubmitting}
          error={error}
          expenseCategories={expenseCategories}
          isEditing={false}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingBudget}
        onClose={() => {
          setEditingBudget(null);
          resetForm();
        }}
        title="Edit Budget"
        size="md"
      >
        <BudgetForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onCancel={() => {
            setEditingBudget(null);
            resetForm();
          }}
          isSubmitting={isSubmitting}
          error={error}
          expenseCategories={expenseCategories}
          isEditing={true}
        />
      </Modal>
      </div>
    </div>
  );
}
