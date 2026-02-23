import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, Clock, AlertTriangle, CreditCard, Calendar, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { useCategories } from '../hooks/useCategories';
import { useBills } from '../hooks/useBills';
import Modal from '../components/ui/Modal';
import type { Bill, BillInput, Category, Account } from '../types';
import { Button } from '@/components/ui/button';
import { AccentButton } from '@/components/ui/accent-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/ui/FormField';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { PageSidebar } from '@/components/ui/PageSidebar';
import { usePageEntrance } from '../hooks/usePageEntrance';

interface BillFormProps {
  formData: BillInput;
  setFormData: (data: BillInput) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
  categories: Category[];
  accounts: Account[];
  isEditing: boolean;
}

function BillForm({ formData, setFormData, onSubmit, onCancel, isSubmitting, error, categories, accounts, isEditing }: BillFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      <FormField label="Bill Name" required>
        <Input type="text" value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Electric Bill, Netflix, Rent" required />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Amount" required>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input type="number" step="0.01" min="0" value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              className="pl-8" required />
          </div>
        </FormField>
        <FormField label="Due Day" required hint="Day of month (1-31)">
          <Input type="number" min="1" max="31" value={formData.due_day}
            onChange={(e) => setFormData({ ...formData, due_day: Number(e.target.value) })} required />
        </FormField>
      </div>
      <FormField label="Frequency" required>
        <select value={formData.frequency}
          onChange={(e) => setFormData({ ...formData, frequency: e.target.value as Bill['frequency'] })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring">
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </FormField>
      <FormField label="Category">
        <select value={formData.category_id || 0}
          onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) || undefined })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring">
          <option value={0}>None</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </FormField>
      <FormField label="Pay From Account">
        <select value={formData.account_id || 0}
          onChange={(e) => setFormData({ ...formData, account_id: Number(e.target.value) || undefined })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring">
          <option value={0}>None</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Checkbox id="autopay" checked={formData.is_autopay || false}
            onCheckedChange={(checked) => setFormData({ ...formData, is_autopay: !!checked })} />
          <Label htmlFor="autopay" className="text-sm cursor-pointer">Auto-pay enabled</Label>
        </div>
        <FormField label="Reminder (days)">
          <Input type="number" min="0" max="30" value={formData.reminder_days || 3}
            onChange={(e) => setFormData({ ...formData, reminder_days: Number(e.target.value) })} />
        </FormField>
      </div>
      <FormField label="Notes">
        <Textarea value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2} placeholder="Optional notes..." />
      </FormField>
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Bill' : 'Add Bill'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
      </div>
    </form>
  );
}

function BillCard({ bill, getDueStatus, onEdit, onDelete, onPay }: {
  bill: Bill;
  getDueStatus: (bill: Bill) => { color: string; bg: string; label: string; icon: any };
  onEdit: () => void; onDelete: () => void; onPay: () => void;
}) {
  const status = getDueStatus(bill);
  const StatusIcon = status.icon;
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className={cn('p-2 rounded-lg', status.bg)}>
            <StatusIcon className={cn('w-5 h-5', status.color)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{bill.name}</h3>
              {bill.is_autopay && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
                  <Zap className="w-3 h-3" />Auto
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="capitalize">{bill.frequency}</span>
              <span>Day {bill.due_day}</span>
              {bill.next_due_date && <span>Next: {format(new Date(bill.next_due_date), 'MMM d, yyyy')}</span>}
              {bill.notes && <span>• {bill.notes}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xl font-bold text-foreground">${bill.amount.toFixed(2)}</p>
            <p className={cn('text-sm font-medium', status.color)}>{status.label}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={onPay} className="p-2 text-success hover:bg-success/10 rounded transition-colors" title="Record payment">
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button onClick={onEdit} className="p-2 text-muted-foreground hover:text-primary transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Bills() {
  const { categories, loadCategories, getCategoriesByType } = useCategories();
  const expenseCategories = getCategoriesByType('expense');
  const { loadBills, createBill, updateBill, deleteBill, recordPayment } = useBills();

  const [bills, setBills] = useState<Bill[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);

  const [formData, setFormData] = useState<BillInput>({
    name: '', amount: 0, due_day: 1, frequency: 'monthly', is_autopay: false, reminder_days: 3, notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

  const { sidebarClass, contentClass } = usePageEntrance();
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => { loadCategories(); loadAccountsList(); }, []);
  useEffect(() => { loadBillsList(); }, [includeInactive]);

  useEffect(() => {
    if (editingBill) {
      setFormData({ name: editingBill.name, amount: editingBill.amount, due_day: editingBill.due_day,
        frequency: editingBill.frequency, category_id: editingBill.category_id || undefined,
        account_id: editingBill.account_id || undefined, is_autopay: editingBill.is_autopay,
        reminder_days: editingBill.reminder_days, notes: editingBill.notes || '' });
    } else { resetForm(); }
  }, [editingBill]);

  useEffect(() => {
    if (payingBill) { setPaymentAmount(payingBill.amount); setPaymentDate(format(new Date(), 'yyyy-MM-dd')); setPaymentNotes(''); }
  }, [payingBill]);

  const loadAccountsList = async () => {
    try { setAccounts(await window.electron.invoke('accounts:get-all')); }
    catch (err) { console.error('Error loading accounts:', err); }
  };

  const loadBillsList = async () => {
    try { setIsLoading(true); setBills(await loadBills(!includeInactive)); }
    catch (err) { console.error('Error loading bills:', err); }
    finally { setIsLoading(false); }
  };

  const resetForm = () => {
    setFormData({ name: '', amount: 0, due_day: 1, frequency: 'monthly', is_autopay: false, reminder_days: 3, notes: '' });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name || formData.amount <= 0 || !formData.due_day) { setError('Please fill in all required fields'); return; }
    if (formData.due_day < 1 || formData.due_day > 31) { setError('Due day must be between 1 and 31'); return; }
    setIsSubmitting(true);
    try {
      if (editingBill) { await updateBill({ ...formData, id: editingBill.id }); setEditingBill(null); }
      else { await createBill(formData); setIsCreateModalOpen(false); }
      await loadBillsList(); resetForm();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save bill'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (bill: Bill) => {
    if (confirm(`Delete bill "${bill.name}"?`)) {
      try { await deleteBill(bill.id); await loadBillsList(); }
      catch (err) { console.error('Error deleting bill:', err); }
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;
    setIsSubmitting(true); setError(null);
    try {
      await recordPayment({ bill_id: payingBill.id, amount: paymentAmount, date: paymentDate, notes: paymentNotes });
      setPayingBill(null); await loadBillsList();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to record payment'); }
    finally { setIsSubmitting(false); }
  };

  const getDueStatus = (bill: Bill) => {
    const days = bill.days_until_due || 0;
    if (days < 0) return { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Overdue', icon: AlertTriangle };
    if (days === 0) return { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Due Today', icon: AlertTriangle };
    if (days <= 3) return { color: 'text-warning', bg: 'bg-warning/10', label: `${days}d`, icon: Clock };
    if (days <= 7) return { color: 'text-warning', bg: 'bg-warning/10', label: `${days}d`, icon: Clock };
    return { color: 'text-success', bg: 'bg-success/10', label: `${days}d`, icon: Calendar };
  };

  const upcomingBills = bills.filter((b) => (b.days_until_due || 0) <= 7);
  const otherBills = bills.filter((b) => (b.days_until_due || 0) > 7);
  const totalMonthly = bills.filter((b) => b.is_active).reduce((sum, bill) => {
    if (bill.frequency === 'monthly') return sum + bill.amount;
    if (bill.frequency === 'quarterly') return sum + bill.amount / 3;
    if (bill.frequency === 'yearly') return sum + bill.amount / 12;
    return sum;
  }, 0);

  return (
    <div className="flex h-full">
      <PageSidebar title="Bills" className={sidebarClass}>
        <div className="px-3 pt-4 pb-3 space-y-2 border-b border-border/40">
          <AccentButton
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full justify-start text-xs h-8 px-3"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            New Bill
          </AccentButton>
        </div>
        <div className="px-4 pt-4 pb-3">
          <button
            onClick={() => setIncludeInactive(!includeInactive)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-150',
              includeInactive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            )}
          >
            <div className={cn(
              'w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors',
              includeInactive ? 'bg-primary/15' : 'bg-muted/60'
            )}>
              <Zap className="w-3 h-3" />
            </div>
            <p className="text-xs font-medium leading-none">Show inactive</p>
            {includeInactive && <div className="w-1.5 h-1.5 rounded-full bg-primary ml-auto shrink-0" />}
          </button>
        </div>
      </PageSidebar>

      <div className={cn('flex-1 flex flex-col overflow-hidden', contentClass)}>
      <div className="flex-1 overflow-y-auto px-10 pt-8 pb-10 space-y-6">
        {bills.length > 0 && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Monthly Summary</h2>
                <p className="text-sm text-muted-foreground">{bills.length} active bills</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">${totalMonthly.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">est. monthly total</p>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : bills.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <EmptyState message="No bills added yet" icon={<CreditCard className="w-12 h-12" />} />
          </div>
        ) : (
          <div className="space-y-6">
            {upcomingBills.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />Due Soon
                </h2>
                <div className="space-y-3">
                  {upcomingBills.map((bill) => (
                    <BillCard key={bill.id} bill={bill} getDueStatus={getDueStatus}
                      onEdit={() => setEditingBill(bill)} onDelete={() => handleDelete(bill)} onPay={() => setPayingBill(bill)} />
                  ))}
                </div>
              </div>
            )}
            {otherBills.length > 0 && (
              <div>
                {upcomingBills.length > 0 && <h2 className="text-lg font-semibold text-foreground mb-3">All Bills</h2>}
                <div className="space-y-3">
                  {otherBills.map((bill) => (
                    <BillCard key={bill.id} bill={bill} getDueStatus={getDueStatus}
                      onEdit={() => setEditingBill(bill)} onDelete={() => handleDelete(bill)} onPay={() => setPayingBill(bill)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); resetForm(); }} title="Add Bill" size="md">
        <BillForm formData={formData} setFormData={setFormData} onSubmit={handleSubmit}
          onCancel={() => { setIsCreateModalOpen(false); resetForm(); }}
          isSubmitting={isSubmitting} error={error} categories={expenseCategories} accounts={accounts} isEditing={false} />
      </Modal>

      <Modal isOpen={!!editingBill} onClose={() => { setEditingBill(null); resetForm(); }} title="Edit Bill" size="md">
        <BillForm formData={formData} setFormData={setFormData} onSubmit={handleSubmit}
          onCancel={() => { setEditingBill(null); resetForm(); }}
          isSubmitting={isSubmitting} error={error} categories={expenseCategories} accounts={accounts} isEditing={true} />
      </Modal>

      <Modal isOpen={!!payingBill} onClose={() => { setPayingBill(null); setError(null); }}
        title={`Record Payment for ${payingBill?.name || ''}`} size="sm">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
          <FormField label="Amount" required>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input type="number" step="0.01" min="0.01" value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))} className="pl-8" required />
            </div>
          </FormField>
          <FormField label="Date" required>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
          </FormField>
          <FormField label="Notes">
            <Textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
          </FormField>
          <div className="flex gap-3 pt-4">
            <Button type="submit" variant="success" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setPayingBill(null); setError(null); }} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
      </div>
    </div>
  );
}
