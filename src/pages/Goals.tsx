import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, TrendingUp, Target, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useCategories } from '../hooks/useCategories';
import { useGoals } from '../hooks/useGoals';
import Modal from '../components/ui/Modal';
import type { Goal, GoalInput, Category, GoalContribution } from '../types';
import { Button } from '@/components/ui/button';
import { AccentButton } from '@/components/ui/accent-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/ui/FormField';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSidebar } from '@/components/ui/PageSidebar';
import { usePageEntrance } from '../hooks/usePageEntrance';
import { cn } from '@/lib/utils';

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

function GoalForm({ formData, setFormData, onSubmit, onCancel, isSubmitting, error, categories, isEditing }: GoalFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      <FormField label="Goal Name" required>
        <Input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Emergency Fund, Vacation, New Car"
          required
        />
      </FormField>
      <FormField label="Target Amount" required>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input type="number" step="0.01" min="0" value={formData.target_amount}
            onChange={(e) => setFormData({ ...formData, target_amount: Number(e.target.value) })}
            className="pl-8" required />
        </div>
      </FormField>
      <FormField label="Current Amount">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input type="number" step="0.01" min="0" value={formData.current_amount || 0}
            onChange={(e) => setFormData({ ...formData, current_amount: Number(e.target.value) })}
            className="pl-8" />
        </div>
      </FormField>
      <FormField label="Target Date">
        <Input type="date" value={formData.target_date || ''}
          onChange={(e) => setFormData({ ...formData, target_date: e.target.value })} />
      </FormField>
      <FormField label="Category">
        <select
          value={formData.category_id || 0}
          onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) || null })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring"
        >
          <option value={0}>None</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Notes">
        <Textarea value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3} placeholder="Optional notes about this goal..." />
      </FormField>
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Goal' : 'Create Goal'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
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
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(amount, date, notes); };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      <FormField label="Contribution Amount" required>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input type="number" step="0.01" min="0.01" value={amount}
            onChange={(e) => setAmount(Number(e.target.value))} className="pl-8" required />
        </div>
      </FormField>
      <FormField label="Date" required>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </FormField>
      <FormField label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
      </FormField>
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Adding...' : 'Add Contribution'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
      </div>
    </form>
  );
}

const getProgressColor = (percentage: number) => {
  if (percentage >= 100) return 'bg-success';
  if (percentage >= 75) return 'bg-primary';
  if (percentage >= 50) return 'bg-warning';
  return 'bg-muted-foreground/40';
};

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
    name: '', target_amount: 0, current_amount: 0,
    target_date: null, category_id: null, notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sidebarClass, contentClass } = usePageEntrance();

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadGoalsList(); }, [includeCompleted]);

  useEffect(() => {
    if (editingGoal) {
      setFormData({
        name: editingGoal.name, target_amount: editingGoal.target_amount,
        current_amount: editingGoal.current_amount, target_date: editingGoal.target_date,
        category_id: editingGoal.category_id, notes: editingGoal.notes || '',
      });
    } else { resetForm(); }
  }, [editingGoal]);

  useEffect(() => {
    if (contributionGoal) loadContributions(contributionGoal.id);
  }, [contributionGoal]);

  const loadGoalsList = async () => {
    try { setIsLoading(true); setGoals(await loadGoals(includeCompleted)); }
    catch (err) { console.error('Error loading goals:', err); }
    finally { setIsLoading(false); }
  };

  const loadContributions = async (goalId: number) => {
    try { setContributions(await getContributions(goalId)); }
    catch (err) { console.error('Error loading contributions:', err); }
  };

  const resetForm = () => {
    setFormData({ name: '', target_amount: 0, current_amount: 0, target_date: null, category_id: null, notes: '' });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name || formData.target_amount <= 0) { setError('Please enter a goal name and target amount'); return; }
    setIsSubmitting(true);
    try {
      if (editingGoal) { await updateGoal({ ...formData, id: editingGoal.id }); setEditingGoal(null); }
      else { await createGoal(formData); setIsCreateModalOpen(false); }
      await loadGoalsList();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally { setIsSubmitting(false); }
  };

  const handleDelete = async (goal: Goal) => {
    if (confirm(`Delete goal "${goal.name}"? This will also delete all contribution history.`)) {
      try { await deleteGoal(goal.id); await loadGoalsList(); }
      catch (err) { console.error('Error deleting goal:', err); }
    }
  };

  const handleAddContribution = async (amount: number, date: string, notes: string) => {
    if (!contributionGoal) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await addContribution({ goalId: contributionGoal.id, amount, date, notes });
      await loadGoalsList();
      await loadContributions(contributionGoal.id);
      setContributionGoal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contribution');
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="flex h-full">
      <PageSidebar title="Goals" className={sidebarClass}>
        <div className="px-3 pt-4 pb-3 space-y-2 border-b border-border/40">
          <AccentButton
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full justify-start text-xs h-8 px-3"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            New Goal
          </AccentButton>
        </div>
        <div className="px-4 pt-4 pb-3">
          <button
            onClick={() => setIncludeCompleted(!includeCompleted)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-150',
              includeCompleted
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            )}
          >
            <div className={cn(
              'w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors',
              includeCompleted ? 'bg-primary/15' : 'bg-muted/60'
            )}>
              <CheckCircle2 className="w-3 h-3" />
            </div>
            <p className="text-xs font-medium leading-none">Show completed</p>
            {includeCompleted && <div className="w-1.5 h-1.5 rounded-full bg-primary ml-auto shrink-0" />}
          </button>
        </div>
      </PageSidebar>

      <div className={cn('flex-1 flex flex-col overflow-hidden', contentClass)}>
      <div className="flex-1 overflow-y-auto px-10 pt-8 pb-10">
        {isLoading ? (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : goals.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <EmptyState message={includeCompleted ? 'No goals found' : 'No active goals'}
              icon={<Target className="w-12 h-12" />} />
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const percentage = goal.progress || 0;
              const isCompleted = goal.is_completed;
              return (
                <div key={goal.id}
                  className={`bg-card rounded-xl border border-border shadow-sm p-6 ${isCompleted ? 'opacity-75' : ''}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{goal.name}</h3>
                        {isCompleted && <CheckCircle2 className="w-5 h-5 text-success" />}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          <span>${goal.current_amount.toFixed(2)} / ${goal.target_amount.toFixed(2)}</span>
                        </div>
                        {goal.target_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{format(new Date(goal.target_date), 'MMM d, yyyy')}</span>
                            {goal.days_remaining != null && (
                              <span className={goal.days_remaining < 0 ? 'text-destructive font-medium' : goal.days_remaining < 30 ? 'text-warning font-medium' : ''}>
                                ({goal.days_remaining < 0 ? 'overdue' : `${goal.days_remaining} days left`})
                              </span>
                            )}
                          </div>
                        )}
                        {goal.category_name && (
                          <span className="px-2 py-1 bg-muted rounded text-xs">{goal.category_name}</span>
                        )}
                      </div>
                      {goal.notes && <p className="text-sm text-muted-foreground mt-2">{goal.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
                        <p className="text-2xl font-bold text-primary">{percentage.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">
                          ${(goal.target_amount - goal.current_amount).toFixed(2)} to go
                        </p>
                      </div>
                      {!isCompleted && (
                        <button onClick={() => setContributionGoal(goal)}
                          className="p-2 text-primary hover:bg-primary/10 rounded transition-colors" title="Add contribution">
                          <TrendingUp className="w-5 h-5" />
                        </button>
                      )}
                      <button onClick={() => setEditingGoal(goal)}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(goal)}
                        className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-4">
                    <div className={`h-4 rounded-full transition-all ${getProgressColor(percentage)}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); resetForm(); }} title="Add Savings Goal" size="md">
        <GoalForm formData={formData} setFormData={setFormData} onSubmit={handleSubmit}
          onCancel={() => { setIsCreateModalOpen(false); resetForm(); }}
          isSubmitting={isSubmitting} error={error} categories={categories} isEditing={false} />
      </Modal>

      <Modal isOpen={!!editingGoal} onClose={() => { setEditingGoal(null); resetForm(); }} title="Edit Goal" size="md">
        <GoalForm formData={formData} setFormData={setFormData} onSubmit={handleSubmit}
          onCancel={() => { setEditingGoal(null); resetForm(); }}
          isSubmitting={isSubmitting} error={error} categories={categories} isEditing={true} />
      </Modal>

      <Modal isOpen={!!contributionGoal} onClose={() => { setContributionGoal(null); setError(null); }}
        title={`Add Contribution to ${contributionGoal?.name || ''}`} size="md">
        {contributionGoal && (
          <div>
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Current Progress</span>
                <span className="font-semibold">
                  ${contributionGoal.current_amount.toFixed(2)} / ${contributionGoal.target_amount.toFixed(2)}
                </span>
              </div>
              <div className="w-full bg-muted/50 rounded-full h-2">
                <div className={`h-2 rounded-full ${getProgressColor(contributionGoal.progress || 0)}`}
                  style={{ width: `${Math.min(contributionGoal.progress || 0, 100)}%` }} />
              </div>
            </div>
            <ContributionForm goalId={contributionGoal.id} onSubmit={handleAddContribution}
              onCancel={() => { setContributionGoal(null); setError(null); }}
              isSubmitting={isSubmitting} error={error} />
            {contributions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground/80 mb-3">Recent Contributions</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {contributions.slice(0, 5).map((contrib) => (
                    <div key={contrib.id}
                      className="flex justify-between text-sm py-2 border-b border-border/50 last:border-0">
                      <div>
                        <span className="font-medium text-success">+${contrib.amount.toFixed(2)}</span>
                        {contrib.notes && <span className="text-muted-foreground ml-2">• {contrib.notes}</span>}
                      </div>
                      <span className="text-muted-foreground">{format(parseISO(contrib.date), 'MMM d, yyyy')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      </div>
    </div>
  );
}
