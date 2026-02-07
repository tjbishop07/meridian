import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, TrendingUp, Target, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useCategories } from '../hooks/useCategories';
import { useGoals } from '../hooks/useGoals';
import Modal from '../components/ui/Modal';
import type { Goal, GoalInput, Category, GoalContribution } from '../types';

interface GoalFormProps {
  formData: GoalInput;
  setFormData: (data: GoalInput) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
  categories: Category[];
  isEditing: boolean;
}

function GoalForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  categories,
  isEditing,
}: GoalFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Goal Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          placeholder="e.g., Emergency Fund, Vacation, New Car"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Target Amount *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.target_amount}
            onChange={(e) => setFormData({ ...formData, target_amount: Number(e.target.value) })}
            className="w-full pl-8 pr-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Current Amount
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.current_amount || 0}
            onChange={(e) => setFormData({ ...formData, current_amount: Number(e.target.value) })}
            className="w-full pl-8 pr-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Target Date
        </label>
        <input
          type="date"
          value={formData.target_date || ''}
          onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Category
        </label>
        <select
          value={formData.category_id || 0}
          onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) || null })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value={0}>None</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          rows={3}
          placeholder="Optional notes about this goal..."
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 disabled:opacity-50 font-medium"
        >
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Goal' : 'Create Goal'}
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

interface ContributionFormProps {
  goalId: number;
  onSubmit: (amount: number, date: string, notes: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
}

function ContributionForm({ goalId, onSubmit, onCancel, isSubmitting, error }: ContributionFormProps) {
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(amount, date, notes);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Contribution Amount *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60">$</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full pl-8 pr-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Date *
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          rows={2}
          placeholder="Optional notes..."
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 disabled:opacity-50 font-medium"
        >
          {isSubmitting ? 'Adding...' : 'Add Contribution'}
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

export default function Goals() {
  const { categories, loadCategories } = useCategories();
  const { loadGoals, createGoal, updateGoal, deleteGoal, addContribution, getContributions } = useGoals();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [contributionGoal, setContributionGoal] = useState<Goal | null>(null);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);

  const [formData, setFormData] = useState<GoalInput>({
    name: '',
    target_amount: 0,
    current_amount: 0,
    target_date: null,
    category_id: null,
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadGoalsList();
  }, [includeCompleted]);

  useEffect(() => {
    if (editingGoal) {
      setFormData({
        name: editingGoal.name,
        target_amount: editingGoal.target_amount,
        current_amount: editingGoal.current_amount,
        target_date: editingGoal.target_date,
        category_id: editingGoal.category_id,
        notes: editingGoal.notes || '',
      });
    } else {
      resetForm();
    }
  }, [editingGoal]);

  useEffect(() => {
    if (contributionGoal) {
      loadContributions(contributionGoal.id);
    }
  }, [contributionGoal]);

  const loadGoalsList = async () => {
    try {
      setIsLoading(true);
      const data = await loadGoals(includeCompleted);
      setGoals(data);
    } catch (err) {
      console.error('Error loading goals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadContributions = async (goalId: number) => {
    try {
      const data = await getContributions(goalId);
      setContributions(data);
    } catch (err) {
      console.error('Error loading contributions:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      target_amount: 0,
      current_amount: 0,
      target_date: null,
      category_id: null,
      notes: '',
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || formData.target_amount <= 0) {
      setError('Please enter a goal name and target amount');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingGoal) {
        await updateGoal({ ...formData, id: editingGoal.id });
        setEditingGoal(null);
      } else {
        await createGoal(formData);
        setIsCreateModalOpen(false);
      }
      await loadGoalsList();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (goal: Goal) => {
    if (confirm(`Delete goal "${goal.name}"? This will also delete all contribution history.`)) {
      try {
        await deleteGoal(goal.id);
        await loadGoalsList();
      } catch (err) {
        console.error('Error deleting goal:', err);
      }
    }
  };

  const handleAddContribution = async (amount: number, date: string, notes: string) => {
    if (!contributionGoal) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await addContribution({
        goalId: contributionGoal.id,
        amount,
        date,
        notes,
      });
      await loadGoalsList();
      await loadContributions(contributionGoal.id);
      setContributionGoal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contribution');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-base-content/40';
  };

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="p-4 flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Savings Goals</h1>
          <p className="text-base-content/70 mt-1">Track your progress towards financial goals</p>
        </div>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-sm text-base-content/80">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
              className="w-4 h-4 text-primary border-base-300 rounded focus:ring-primary"
            />
            Show completed
          </label>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Goal
          </button>
        </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Goals List */}
      {isLoading ? (
        <div className="bg-base-100 rounded-lg shadow-sm p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-base-300 rounded"></div>
            ))}
          </div>
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-base-100 rounded-lg shadow-sm p-12 text-center">
          <Target className="w-12 h-12 text-base-content/50 mx-auto mb-3" />
          <p className="text-base-content/70 text-lg mb-4">
            {includeCompleted ? 'No goals found' : 'No active goals'}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="text-primary hover:text-primary font-medium"
          >
            Create your first goal
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const percentage = goal.progress || 0;
            const isCompleted = goal.is_completed;

            return (
              <div
                key={goal.id}
                className={`bg-base-100 rounded-lg shadow-sm p-6 ${isCompleted ? 'opacity-75' : ''}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-base-content">{goal.name}</h3>
                      {isCompleted && (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-base-content/70">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span>
                          ${goal.current_amount.toFixed(2)} / ${goal.target_amount.toFixed(2)}
                        </span>
                      </div>
                      {goal.target_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(goal.target_date), 'MMM d, yyyy')}</span>
                          {goal.days_remaining !== null && (
                            <span
                              className={
                                goal.days_remaining < 0
                                  ? 'text-red-600 font-medium'
                                  : goal.days_remaining < 30
                                  ? 'text-orange-600 font-medium'
                                  : ''
                              }
                            >
                              ({goal.days_remaining < 0 ? 'overdue' : `${goal.days_remaining} days left`})
                            </span>
                          )}
                        </div>
                      )}
                      {goal.category_name && (
                        <span className="px-2 py-1 bg-base-200 rounded text-xs">
                          {goal.category_name}
                        </span>
                      )}
                    </div>
                    {goal.notes && (
                      <p className="text-sm text-base-content/60 mt-2">{goal.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-4">
                      <p className="text-2xl font-bold text-primary">
                        {percentage.toFixed(1)}%
                      </p>
                      <p className="text-sm text-base-content/70">
                        ${(goal.target_amount - goal.current_amount).toFixed(2)} to go
                      </p>
                    </div>
                    {!isCompleted && (
                      <button
                        onClick={() => setContributionGoal(goal)}
                        className="p-2 text-primary hover:bg-primary/10 rounded transition-colors"
                        title="Add contribution"
                      >
                        <TrendingUp className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => setEditingGoal(goal)}
                      className="p-2 text-base-content/50 hover:text-primary transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(goal)}
                      className="p-2 text-base-content/50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="w-full bg-base-300 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full transition-all ${getProgressColor(percentage)}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetForm();
        }}
        title="Add Savings Goal"
        size="md"
      >
        <GoalForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsCreateModalOpen(false);
            resetForm();
          }}
          isSubmitting={isSubmitting}
          error={error}
          categories={categories}
          isEditing={false}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingGoal}
        onClose={() => {
          setEditingGoal(null);
          resetForm();
        }}
        title="Edit Goal"
        size="md"
      >
        <GoalForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onCancel={() => {
            setEditingGoal(null);
            resetForm();
          }}
          isSubmitting={isSubmitting}
          error={error}
          categories={categories}
          isEditing={true}
        />
      </Modal>

      {/* Add Contribution Modal */}
      <Modal
        isOpen={!!contributionGoal}
        onClose={() => {
          setContributionGoal(null);
          setError(null);
        }}
        title={`Add Contribution to ${contributionGoal?.name || ''}`}
        size="md"
      >
        {contributionGoal && (
          <div>
            <div className="mb-6 p-4 bg-base-200 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-base-content/70">Current Progress</span>
                <span className="font-semibold">
                  ${contributionGoal.current_amount.toFixed(2)} / ${contributionGoal.target_amount.toFixed(2)}
                </span>
              </div>
              <div className="w-full bg-base-300 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressColor(contributionGoal.progress || 0)}`}
                  style={{ width: `${Math.min(contributionGoal.progress || 0, 100)}%` }}
                />
              </div>
            </div>

            <ContributionForm
              goalId={contributionGoal.id}
              onSubmit={handleAddContribution}
              onCancel={() => {
                setContributionGoal(null);
                setError(null);
              }}
              isSubmitting={isSubmitting}
              error={error}
            />

            {contributions.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-semibold text-base-content/80 mb-3">Recent Contributions</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {contributions.slice(0, 5).map((contrib) => (
                    <div
                      key={contrib.id}
                      className="flex justify-between text-sm py-2 border-b border-base-200 last:border-0"
                    >
                      <div>
                        <span className="font-medium text-green-600">
                          +${contrib.amount.toFixed(2)}
                        </span>
                        {contrib.notes && (
                          <span className="text-base-content/60 ml-2">• {contrib.notes}</span>
                        )}
                      </div>
                      <span className="text-base-content/60">
                        {format(parseISO(contrib.date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
