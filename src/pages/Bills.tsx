import { useEffect, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
  Calendar,
  Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { useCategories } from '../hooks/useCategories';
import { useBills } from '../hooks/useBills';
import Modal from '../components/ui/Modal';
import type { Bill, BillInput, Category, Account } from '../types';

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

function BillForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  categories,
  accounts,
  isEditing,
}: BillFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">Bill Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          placeholder="e.g., Electric Bill, Netflix, Rent"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Amount *</label>
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
          <label className="block text-sm font-medium text-base-content/80 mb-1">Due Day *</label>
          <input
            type="number"
            min="1"
            max="31"
            value={formData.due_day}
            onChange={(e) => setFormData({ ...formData, due_day: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            required
          />
          <p className="text-xs text-base-content/60 mt-1">Day of month (1-31)</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">Frequency *</label>
        <select
          value={formData.frequency}
          onChange={(e) =>
            setFormData({ ...formData, frequency: e.target.value as Bill['frequency'] })
          }
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">Category</label>
        <select
          value={formData.category_id || 0}
          onChange={(e) =>
            setFormData({ ...formData, category_id: Number(e.target.value) || undefined })
          }
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
        <label className="block text-sm font-medium text-base-content/80 mb-1">Pay From Account</label>
        <select
          value={formData.account_id || 0}
          onChange={(e) =>
            setFormData({ ...formData, account_id: Number(e.target.value) || undefined })
          }
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value={0}>None</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="autopay"
            checked={formData.is_autopay || false}
            onChange={(e) => setFormData({ ...formData, is_autopay: e.target.checked })}
            className="w-4 h-4 text-primary border-base-300 rounded focus:ring-primary"
          />
          <label htmlFor="autopay" className="ml-2 text-sm text-base-content/80">
            Auto-pay enabled
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Reminder (days)</label>
          <input
            type="number"
            min="0"
            max="30"
            value={formData.reminder_days || 3}
            onChange={(e) => setFormData({ ...formData, reminder_days: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">Notes</label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Bill' : 'Add Bill'}
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
    name: '',
    amount: 0,
    due_day: 1,
    frequency: 'monthly',
    is_autopay: false,
    reminder_days: 3,
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    loadCategories();
    loadAccounts();
  }, []);

  useEffect(() => {
    loadBillsList();
  }, [includeInactive]);

  useEffect(() => {
    if (editingBill) {
      setFormData({
        name: editingBill.name,
        amount: editingBill.amount,
        due_day: editingBill.due_day,
        frequency: editingBill.frequency,
        category_id: editingBill.category_id || undefined,
        account_id: editingBill.account_id || undefined,
        is_autopay: editingBill.is_autopay,
        reminder_days: editingBill.reminder_days,
        notes: editingBill.notes || '',
      });
    } else {
      resetForm();
    }
  }, [editingBill]);

  useEffect(() => {
    if (payingBill) {
      setPaymentAmount(payingBill.amount);
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setPaymentNotes('');
    }
  }, [payingBill]);

  const loadAccounts = async () => {
    try {
      const data = await window.electron.invoke('accounts:get-all');
      setAccounts(data);
    } catch (err) {
      console.error('Error loading accounts:', err);
    }
  };

  const loadBillsList = async () => {
    try {
      setIsLoading(true);
      const data = await loadBills(!includeInactive);
      setBills(data);
    } catch (err) {
      console.error('Error loading bills:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      amount: 0,
      due_day: 1,
      frequency: 'monthly',
      is_autopay: false,
      reminder_days: 3,
      notes: '',
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || formData.amount <= 0 || !formData.due_day) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.due_day < 1 || formData.due_day > 31) {
      setError('Due day must be between 1 and 31');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingBill) {
        await updateBill({ ...formData, id: editingBill.id });
        setEditingBill(null);
      } else {
        await createBill(formData);
        setIsCreateModalOpen(false);
      }
      await loadBillsList();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (bill: Bill) => {
    if (confirm(`Delete bill "${bill.name}"?`)) {
      try {
        await deleteBill(bill.id);
        await loadBillsList();
      } catch (err) {
        console.error('Error deleting bill:', err);
      }
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await recordPayment({
        bill_id: payingBill.id,
        amount: paymentAmount,
        date: paymentDate,
        notes: paymentNotes,
      });
      setPayingBill(null);
      await loadBillsList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDueStatus = (bill: Bill) => {
    const days = bill.days_until_due || 0;
    if (days < 0) return { color: 'text-red-600', bg: 'bg-red-50', label: 'Overdue', icon: AlertTriangle };
    if (days === 0) return { color: 'text-red-600', bg: 'bg-red-50', label: 'Due Today', icon: AlertTriangle };
    if (days <= 3) return { color: 'text-orange-600', bg: 'bg-orange-50', label: `${days}d`, icon: Clock };
    if (days <= 7) return { color: 'text-yellow-600', bg: 'bg-yellow-50', label: `${days}d`, icon: Clock };
    return { color: 'text-green-600', bg: 'bg-green-50', label: `${days}d`, icon: Calendar };
  };

  // Group bills: upcoming (due within 7 days) and the rest
  const upcomingBills = bills.filter((b) => (b.days_until_due || 0) <= 7);
  const otherBills = bills.filter((b) => (b.days_until_due || 0) > 7);

  const totalMonthly = bills
    .filter((b) => b.is_active)
    .reduce((sum, bill) => {
      if (bill.frequency === 'monthly') return sum + bill.amount;
      if (bill.frequency === 'quarterly') return sum + bill.amount / 3;
      if (bill.frequency === 'yearly') return sum + bill.amount / 12;
      return sum;
    }, 0);

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="p-4 flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Bills & Subscriptions</h1>
          <p className="text-base-content/70 mt-1">Track recurring bills and never miss a payment</p>
        </div>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-sm text-base-content/80">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="w-4 h-4 text-primary border-base-300 rounded focus:ring-primary"
            />
            Show inactive
          </label>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Bill
          </button>
        </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Monthly Summary */}
      {bills.length > 0 && (
        <div className="bg-base-100 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-base-content">Monthly Summary</h2>
              <p className="text-sm text-base-content/70">{bills.length} active bills</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-base-content">${totalMonthly.toFixed(2)}</p>
              <p className="text-sm text-base-content/70">est. monthly total</p>
            </div>
          </div>
        </div>
      )}

      {/* Bills List */}
      {isLoading ? (
        <div className="bg-base-100 rounded-lg shadow-sm p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-base-300 rounded"></div>
            ))}
          </div>
        </div>
      ) : bills.length === 0 ? (
        <div className="bg-base-100 rounded-lg shadow-sm p-12 text-center">
          <CreditCard className="w-12 h-12 text-base-content/50 mx-auto mb-3" />
          <p className="text-base-content/70 text-lg mb-4">No bills added yet</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="text-primary hover:text-primary font-medium"
          >
            Add your first bill
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming / Due Soon */}
          {upcomingBills.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-base-content mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Due Soon
              </h2>
              <div className="space-y-3">
                {upcomingBills.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    getDueStatus={getDueStatus}
                    onEdit={() => setEditingBill(bill)}
                    onDelete={() => handleDelete(bill)}
                    onPay={() => setPayingBill(bill)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Bills */}
          {otherBills.length > 0 && (
            <div>
              {upcomingBills.length > 0 && (
                <h2 className="text-lg font-semibold text-base-content mb-3">All Bills</h2>
              )}
              <div className="space-y-3">
                {otherBills.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    getDueStatus={getDueStatus}
                    onEdit={() => setEditingBill(bill)}
                    onDelete={() => handleDelete(bill)}
                    onPay={() => setPayingBill(bill)}
                  />
                ))}
              </div>
            </div>
          )}
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
        title="Add Bill"
        size="md"
      >
        <BillForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsCreateModalOpen(false);
            resetForm();
          }}
          isSubmitting={isSubmitting}
          error={error}
          categories={expenseCategories}
          accounts={accounts}
          isEditing={false}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingBill}
        onClose={() => {
          setEditingBill(null);
          resetForm();
        }}
        title="Edit Bill"
        size="md"
      >
        <BillForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onCancel={() => {
            setEditingBill(null);
            resetForm();
          }}
          isSubmitting={isSubmitting}
          error={error}
          categories={expenseCategories}
          accounts={accounts}
          isEditing={true}
        />
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={!!payingBill}
        onClose={() => {
          setPayingBill(null);
          setError(null);
        }}
        title={`Record Payment for ${payingBill?.name || ''}`}
        size="sm"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Notes</label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={2}
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPayingBill(null);
                setError(null);
              }}
              disabled={isSubmitting}
              className="px-4 py-2 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 disabled:opacity-50 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function BillCard({
  bill,
  getDueStatus,
  onEdit,
  onDelete,
  onPay,
}: {
  bill: Bill;
  getDueStatus: (bill: Bill) => { color: string; bg: string; label: string; icon: any };
  onEdit: () => void;
  onDelete: () => void;
  onPay: () => void;
}) {
  const status = getDueStatus(bill);
  const StatusIcon = status.icon;

  return (
    <div className="bg-base-100 rounded-lg shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className={`p-2 rounded-lg ${status.bg}`}>
            <StatusIcon className={`w-5 h-5 ${status.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base-content">{bill.name}</h3>
              {bill.is_autopay && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                  <Zap className="w-3 h-3" />
                  Auto
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-base-content/70 mt-1">
              <span className="capitalize">{bill.frequency}</span>
              <span>Day {bill.due_day}</span>
              {bill.next_due_date && (
                <span>Next: {format(new Date(bill.next_due_date), 'MMM d, yyyy')}</span>
              )}
              {bill.notes && <span className="text-base-content/50">• {bill.notes}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xl font-bold text-base-content">${bill.amount.toFixed(2)}</p>
            <p className={`text-sm font-medium ${status.color}`}>{status.label}</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={onPay}
              className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
              title="Record payment"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button
              onClick={onEdit}
              className="p-2 text-base-content/50 hover:text-primary transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-base-content/50 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
