import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Tag, Download, Database, Palette, ScanSearch } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import Modal from '../components/ui/Modal';
import { ClaudeVisionTab } from '../components/automation/ClaudeVisionTab';
import { LocalAITab } from '../components/automation/LocalAITab';
import { useAutomationSettings } from '../hooks/useAutomationSettings';
import type { Account, Category } from '../types';

const THEMES = [
  'dark', 'light', 'money', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'synthwave', 'retro',
  'cyberpunk', 'valentine', 'halloween', 'garden', 'forest', 'aqua', 'lofi', 'pastel',
  'fantasy', 'wireframe', 'black', 'luxury', 'dracula', 'cmyk', 'autumn', 'business',
  'acid', 'lemonade', 'night', 'coffee', 'winter', 'dim', 'nord', 'sunset',
  'caramellatte', 'abyss', 'silk',
];

interface AccountFormProps {
  formData: {
    name: string;
    type: Account['type'];
    institution: string;
    balance: number;
    currency: string;
    is_active: boolean;
  };
  setFormData: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
  isEditing: boolean;
}

function AccountForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  isEditing,
}: AccountFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Account Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
          placeholder="e.g., Main Checking"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Institution *
        </label>
        <input
          type="text"
          value={formData.institution}
          onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
          placeholder="e.g., USAA, Chase, Bank of America"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">
            Account Type *
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as Account['type'] })}
            className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
          >
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="credit_card">Credit Card</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">
            Currency
          </label>
          <input
            type="text"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Starting Balance
        </label>
        <input
          type="number"
          step="0.01"
          value={formData.balance}
          onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          className="w-4 h-4 text-primary border-base-300 rounded focus:ring-primary"
        />
        <label htmlFor="is_active" className="ml-2 text-sm text-base-content/80">
          Active account
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 disabled:opacity-50 font-medium"
        >
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Account' : 'Create Account'}
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

interface CategoryFormProps {
  formData: { name: string; type: 'income' | 'expense' };
  setFormData: (data: { name: string; type: 'income' | 'expense' }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
  isEditing: boolean;
}

function CategoryForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  isEditing,
}: CategoryFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Category Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
          placeholder="e.g., Groceries, Rent, Salary"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Type *
        </label>
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value as 'income' | 'expense' })}
          className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content"
          disabled={isEditing}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 disabled:opacity-50 font-medium"
        >
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Category' : 'Create Category'}
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

const DEFAULT_SCRAPING_PROMPT = `You are analyzing a bank transaction page screenshot. Extract ONLY the visible posted transactions from this single viewport.

WHAT TO LOOK FOR:
- Transaction tables or lists showing financial activity
- Columns typically include: Date, Description/Merchant, Amount, Balance, Category
- Look for dollar amounts (positive or negative)
- Look for dates in any format (Feb 04, 02/04/2024, etc.)
- Look for merchant names or transaction descriptions
- Look for category labels (Shopping, Groceries, Fast Food, Gas/Fuel, Auto & Transport, Bills & Utilities, etc.)

CRITICAL RULES:
1. Extract ONLY transactions visible in THIS screenshot (typically 10-50 recent transactions)
2. Include ALL transactions - both posted/cleared AND pending/processing transactions
3. For pending/processing transactions, ALWAYS use empty string "" for the category field
4. For posted/cleared transactions, extract the category if visible, otherwise use empty string ""
5. Clean merchant names (remove prefixes like "ACH", "DEBIT", "POS", "CARD PURCHASE", etc.)
6. Use negative amounts for expenses (money going out)
7. Use positive amounts for income (money coming in)
8. Parse dates in any format you see (Month DD, YYYY or MM/DD/YYYY, etc.)
9. If you see a balance column, include it

IMPORTANT: If you cannot find ANY transaction data in the image:
- Return an empty array: []
- The page might be a login screen, loading screen, or error page
- The page might not have finished loading transaction data yet

Return ONLY a JSON array with this exact structure (no markdown, no explanation):
[
  {
    "date": "Feb 04, 2026",
    "description": "Shake Shack",
    "amount": "-28.50",
    "balance": "2380.52",
    "category": "Fast Food",
    "confidence": 95
  }
]

If the bank shows a category for the transaction, extract it exactly as shown. If no category is visible, use an empty string "".

Extract every visible transaction in the screenshot. Focus on the most recent transactions shown.`;

function PromptTab() {
  const { settings, loading, saving, updateSettings } = useAutomationSettings();
  const [localPrompt, setLocalPrompt] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLocalPrompt(settings.scraping_prompt || DEFAULT_SCRAPING_PROMPT);
      setIsDirty(false);
    }
  }, [loading, settings.scraping_prompt]);

  const handleSave = async () => {
    // Save empty string if the prompt matches the default (signals "use built-in default")
    const valueToSave = localPrompt === DEFAULT_SCRAPING_PROMPT ? '' : localPrompt;
    await updateSettings({ scraping_prompt: valueToSave });
    setIsDirty(false);
  };

  const handleReset = async () => {
    setLocalPrompt(DEFAULT_SCRAPING_PROMPT);
    await updateSettings({ scraping_prompt: '' });
    setIsDirty(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-md text-base-content/50" />
      </div>
    );
  }

  const isUsingDefault = !settings.scraping_prompt;

  return (
    <div className="space-y-4">
      <div className="bg-base-100 rounded-lg p-6">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-base-content">Scraping Prompt</h3>
          {isUsingDefault && (
            <span className="badge badge-ghost badge-sm">Default</span>
          )}
        </div>
        <p className="text-sm text-base-content/70 mb-4">
          Customize the prompt sent to the AI when scraping transactions. Edit it to fine-tune extraction for your specific bank.
        </p>

        <div className="mb-3 p-3 bg-info/10 border border-info/30 rounded-lg">
          <p className="text-xs text-base-content/70">
            The prompt must instruct the AI to return a JSON array with fields:
            <code className="mx-1 px-1 py-0.5 bg-base-300 rounded text-xs font-mono">date</code>
            <code className="mx-1 px-1 py-0.5 bg-base-300 rounded text-xs font-mono">description</code>
            <code className="mx-1 px-1 py-0.5 bg-base-300 rounded text-xs font-mono">amount</code>
            <code className="mx-1 px-1 py-0.5 bg-base-300 rounded text-xs font-mono">balance</code>
            <code className="mx-1 px-1 py-0.5 bg-base-300 rounded text-xs font-mono">category</code>
            <code className="mx-1 px-1 py-0.5 bg-base-300 rounded text-xs font-mono">confidence</code>
          </p>
        </div>

        <textarea
          value={localPrompt}
          onChange={(e) => {
            setLocalPrompt(e.target.value);
            setIsDirty(true);
          }}
          rows={18}
          className="w-full px-4 py-3 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-base-100 text-base-content font-mono text-sm resize-y"
        />

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={handleReset}
            disabled={isUsingDefault && !isDirty}
            className="btn btn-ghost btn-sm"
          >
            Reset to Default
          </button>
          <div className="flex items-center gap-3">
            {saving && <span className="text-xs text-success">Saved</span>}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="btn btn-primary btn-sm"
            >
              Save Prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { accounts, loadAccounts, createAccount, updateAccount, deleteAccount } = useAccounts();
  const { categories, loadCategories } = useCategories();

  // Theme state
  const [currentTheme, setCurrentTheme] = useState('dark');

  // Account state
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountFormData, setAccountFormData] = useState({
    name: '',
    type: 'checking' as Account['type'],
    institution: '',
    balance: 0,
    currency: 'USD',
    is_active: true,
  });

  // Category state
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearStatus, setClearStatus] = useState<string | null>(null);
  const [showClearCategoriesConfirm, setShowClearCategoriesConfirm] = useState(false);
  const [clearCategoriesStatus, setClearCategoriesStatus] = useState<string | null>(null);
  const [scrapingTab, setScrapingTab] = useState<'claude' | 'ollama' | 'prompt'>('claude');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    appearance: true, accounts: true, categories: true, scraping: true, data: true,
  });
  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  const isOpen = (key: string) => !collapsed[key]; // default open

  useEffect(() => {
    loadAccounts();
    loadCategories();
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const theme = await window.electron.invoke('settings:get', 'theme');
      if (theme) {
        setCurrentTheme(theme);
      }
    } catch (err) {
      console.error('Failed to load theme:', err);
    }
  };

  const handleThemeChange = async (theme: string) => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    try {
      await window.electron.invoke('settings:set', { key: 'theme', value: theme });
    } catch (err) {
      console.error('Failed to save theme:', err);
    }
  };

  useEffect(() => {
    if (editingAccount) {
      setAccountFormData({
        name: editingAccount.name,
        type: editingAccount.type,
        institution: editingAccount.institution,
        balance: editingAccount.balance,
        currency: editingAccount.currency,
        is_active: editingAccount.is_active,
      });
    } else {
      resetAccountForm();
    }
  }, [editingAccount]);

  useEffect(() => {
    if (editingCategory) {
      setCategoryFormData({
        name: editingCategory.name,
        type: editingCategory.type,
      });
    } else {
      resetCategoryForm();
    }
  }, [editingCategory]);

  const resetAccountForm = () => {
    setAccountFormData({
      name: '',
      type: 'checking',
      institution: '',
      balance: 0,
      currency: 'USD',
      is_active: true,
    });
    setError(null);
  };

  const resetCategoryForm = () => {
    setCategoryFormData({ name: '', type: 'expense' });
    setError(null);
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!accountFormData.name.trim() || !accountFormData.institution.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        await updateAccount({ ...accountFormData, id: editingAccount.id });
        setEditingAccount(null);
      } else {
        await createAccount(accountFormData);
        setIsCreateAccountOpen(false);
      }
      resetAccountForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async (account: Account) => {
    if (confirm(`Delete "${account.name}"? Associated transactions will also be deleted.`)) {
      try {
        await deleteAccount(account.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete account');
      }
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!categoryFormData.name.trim()) {
      setError('Please enter a category name');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await window.electron.invoke('categories:update', {
          id: editingCategory.id,
          name: categoryFormData.name,
          type: categoryFormData.type,
        });
        setEditingCategory(null);
      } else {
        await window.electron.invoke('categories:create', {
          name: categoryFormData.name,
          type: categoryFormData.type,
          parent_id: null,
          icon: null,
          color: null,
          is_system: false,
        });
        setIsCreateCategoryOpen(false);
      }
      await loadCategories();
      resetCategoryForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (category.is_system) {
      alert('System categories cannot be deleted.');
      return;
    }
    if (confirm(`Delete category "${category.name}"? Transactions using this category will become uncategorized.`)) {
      try {
        await window.electron.invoke('categories:delete', category.id);
        await loadCategories();
      } catch (err) {
        console.error('Error deleting category:', err);
      }
    }
  };

  const handleExportCSV = async () => {
    try {
      setExportStatus('Exporting...');
      const transactions = await window.electron.invoke('transactions:get-all', {});

      // Build CSV
      const headers = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Account', 'Status', 'Notes'];
      const rows = transactions.map((t: any) => [
        t.date,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.amount,
        t.type,
        `"${(t.category_name || 'Uncategorized').replace(/"/g, '""')}"`,
        `"${(t.account_name || '').replace(/"/g, '""')}"`,
        t.status,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ]);

      const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');

      // Create a download via Blob
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatus(`Exported ${transactions.length} transactions`);
      setTimeout(() => setExportStatus(null), 3000);
    } catch (err) {
      console.error('Export error:', err);
      setExportStatus('Export failed');
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  const handleClearAllTransactions = async () => {
    try {
      setClearStatus('Clearing...');
      const deletedCount = await window.electron.invoke('transactions:delete-all');
      setClearStatus(`Deleted ${deletedCount} transactions`);
      setShowClearConfirm(false);

      // Reload accounts to update balances
      await loadAccounts();

      setTimeout(() => setClearStatus(null), 3000);
    } catch (err) {
      console.error('Clear error:', err);
      setClearStatus('Clear failed');
      setTimeout(() => setClearStatus(null), 3000);
    }
  };

  const handleClearAllCategories = async () => {
    try {
      setClearCategoriesStatus('Clearing...');
      const deletedCount = await window.electron.invoke('categories:delete-all');
      setClearCategoriesStatus(`Deleted ${deletedCount} categories`);
      setShowClearCategoriesConfirm(false);

      // Reload categories
      await loadCategories();

      setTimeout(() => setClearCategoriesStatus(null), 3000);
    } catch (err) {
      console.error('Clear categories error:', err);
      setClearCategoriesStatus('Clear failed');
      setTimeout(() => setClearCategoriesStatus(null), 3000);
    }
  };

  const incomeCategories = categories.filter((c) => c.type === 'income');
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="p-4 flex-shrink-0">
        <h1 className="text-3xl font-bold text-base-content mb-2">Settings</h1>
        <p className="text-base-content/70 mb-4">Manage your accounts, categories, and data</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Appearance Section */}
        <div className={`collapse collapse-arrow bg-base-100 rounded-lg shadow-sm mb-6 ${isOpen('appearance') ? 'collapse-open' : 'collapse-close'}`}>
          <div className="collapse-title" onClick={() => toggle('appearance')}>
            <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Appearance
            </h2>
            <p className="text-sm text-base-content/70 mt-0.5">Choose a theme for the application</p>
          </div>
          <div className="collapse-content">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
              {THEMES.map((theme) => (
                <button
                  key={theme}
                  onClick={() => handleThemeChange(theme)}
                  data-theme={theme}
                  className={`glass rounded-lg overflow-hidden border transition-all hover:scale-105 ${
                    currentTheme === theme
                      ? 'border-primary/50 ring-2 ring-primary/30 shadow-lg shadow-primary/20'
                      : 'border-base-content/10 hover:border-base-content/20'
                  }`}
                >
                  <div className="p-2">
                    <div className="flex gap-1 mb-1.5">
                      <div className="rounded-full w-2.5 h-2.5 bg-primary shadow-sm" />
                      <div className="rounded-full w-2.5 h-2.5 bg-secondary shadow-sm" />
                      <div className="rounded-full w-2.5 h-2.5 bg-accent shadow-sm" />
                    </div>
                    <div className="flex gap-1">
                      <div className="rounded h-1.5 flex-1 bg-base-content/20" />
                      <div className="rounded h-1.5 flex-1 bg-base-content/10" />
                    </div>
                  </div>
                  <div className="bg-base-content/5 px-2 py-1">
                    <p className="text-[10px] font-medium text-base-content truncate text-center capitalize">
                      {theme}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

      {/* Accounts Section */}
        <div className={`collapse collapse-arrow bg-base-100 rounded-lg shadow-sm mb-6 ${isOpen('accounts') ? 'collapse-open' : 'collapse-close'}`}>
          <div className="collapse-title" onClick={() => toggle('accounts')}>
            <div className="flex items-center justify-between pr-4">
              <div>
                <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Accounts
                </h2>
                <p className="text-sm text-base-content/70 mt-0.5">Manage your bank accounts and credit cards</p>
              </div>
              {isOpen('accounts') && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsCreateAccountOpen(true); }}
                  className="btn btn-primary btn-sm gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Account
                </button>
              )}
            </div>
          </div>
          <div className="collapse-content">
            {accounts.length === 0 ? (
              <div className="text-center py-8 bg-base-200 rounded-lg">
                <Building2 className="w-10 h-10 text-base-content/50 mx-auto mb-2" />
                <p className="text-base-content/70 mb-2">No accounts yet</p>
                <button
                  onClick={() => setIsCreateAccountOpen(true)}
                  className="text-primary font-medium text-sm"
                >
                  Create your first account
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 border border-base-300 rounded-lg hover:border-base-content/30 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-base-content">{account.name}</h3>
                        <span className="badge badge-ghost badge-sm">{account.type.replace('_', ' ')}</span>
                        {!account.is_active && (
                          <span className="badge badge-error badge-sm">Inactive</span>
                        )}
                      </div>
                      <p className="text-sm text-base-content/70 mt-1">
                        {account.institution} &middot; ${account.balance.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingAccount(account)} className="btn btn-ghost btn-sm btn-circle">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteAccount(account)} className="btn btn-ghost btn-sm btn-circle text-error hover:bg-error/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Categories Section */}
        <div className={`collapse collapse-arrow bg-base-100 rounded-lg shadow-sm mb-6 ${isOpen('categories') ? 'collapse-open' : 'collapse-close'}`}>
          <div className="collapse-title" onClick={() => toggle('categories')}>
            <div className="flex items-center justify-between pr-4">
              <div>
                <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Categories
                </h2>
                <p className="text-sm text-base-content/70 mt-0.5">Organize your transactions into categories</p>
              </div>
              {isOpen('categories') && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsCreateCategoryOpen(true); }}
                  className="btn btn-primary btn-sm gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
              )}
            </div>
          </div>
          <div className="collapse-content">
            {/* Expense Categories */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-base-content/80 uppercase tracking-wide">Expense Categories</h3>
                <div className="badge badge-neutral badge-sm">{expenseCategories.length}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {expenseCategories.map((cat) => (
                  <div key={cat.id} className="card bg-base-200 shadow-sm">
                    <div className="card-body p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-error flex-shrink-0" />
                          <span className="font-medium text-sm text-base-content truncate" data-category-name={cat.name}>
                            {String(cat.name).trim()}
                          </span>
                          {Boolean(cat.is_system) && <div className="badge badge-ghost badge-xs flex-shrink-0">system</div>}
                        </div>
                        <div className="join">
                          <button onClick={() => setEditingCategory(cat)} className="btn btn-ghost btn-xs join-item" title="Edit category">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {!cat.is_system && (
                            <button onClick={() => handleDeleteCategory(cat)} className="btn btn-ghost btn-xs join-item text-error hover:bg-error/10" title="Delete category">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Income Categories */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-base-content/80 uppercase tracking-wide">Income Categories</h3>
                <div className="badge badge-neutral badge-sm">{incomeCategories.length}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {incomeCategories.map((cat) => (
                  <div key={cat.id} className="card bg-base-200 shadow-sm">
                    <div className="card-body p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                          <span className="font-medium text-sm text-base-content truncate" data-category-name={cat.name}>
                            {String(cat.name).trim()}
                          </span>
                          {Boolean(cat.is_system) && <div className="badge badge-ghost badge-xs flex-shrink-0">system</div>}
                        </div>
                        <div className="join">
                          <button onClick={() => setEditingCategory(cat)} className="btn btn-ghost btn-xs join-item" title="Edit category">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {!cat.is_system && (
                            <button onClick={() => handleDeleteCategory(cat)} className="btn btn-ghost btn-xs join-item text-error hover:bg-error/10" title="Delete category">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scraping Section */}
        <div className={`collapse collapse-arrow bg-base-100 rounded-lg shadow-sm mb-6 ${isOpen('scraping') ? 'collapse-open' : 'collapse-close'}`}>
          <div className="collapse-title" onClick={() => toggle('scraping')}>
            <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
              <ScanSearch className="w-5 h-5" />
              Scraping
            </h2>
          </div>
          <div className="collapse-content">
            {/* Tab bar */}
            <div className="tabs tabs-border -mx-4 mb-4">
              {([
                { key: 'claude', label: 'Claude Vision AI' },
                { key: 'ollama', label: 'Local AI (Ollama)' },
                { key: 'prompt', label: 'Prompt' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setScrapingTab(tab.key)}
                  className={`tab ${scrapingTab === tab.key ? 'tab-active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {scrapingTab === 'claude' && <ClaudeVisionTab />}
            {scrapingTab === 'ollama' && <LocalAITab />}
            {scrapingTab === 'prompt' && <PromptTab />}
          </div>
        </div>

        {/* Data Management Section */}
        <div className={`collapse collapse-arrow bg-base-100 rounded-lg shadow-sm mb-6 ${isOpen('data') ? 'collapse-open' : 'collapse-close'}`}>
          <div className="collapse-title" onClick={() => toggle('data')}>
            <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Management
            </h2>
            <p className="text-sm text-base-content/70 mt-0.5">Export data and manage database records</p>
          </div>
          <div className="collapse-content">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-base-300 rounded-lg">
                <div>
                  <h3 className="font-medium text-base-content">Export Transactions</h3>
                  <p className="text-sm text-base-content/70">Download all transactions as a CSV file</p>
                </div>
                <button onClick={handleExportCSV} className="btn btn-ghost gap-2">
                  <Download className="w-4 h-4" />
                  {exportStatus || 'Export CSV'}
                </button>
              </div>

              <div className="flex items-center justify-between p-4 border border-base-300 rounded-lg">
                <div>
                  <h3 className="font-medium text-base-content">Clear All Transactions</h3>
                  <p className="text-sm text-base-content/70">Permanently delete all transactions from the database</p>
                </div>
                <button onClick={() => setShowClearConfirm(true)} className="btn btn-ghost text-error gap-2">
                  <Trash2 className="w-4 h-4" />
                  {clearStatus || 'Clear All'}
                </button>
              </div>

              <div className="flex items-center justify-between p-4 border border-base-300 rounded-lg">
                <div>
                  <h3 className="font-medium text-base-content">Clear All Categories</h3>
                  <p className="text-sm text-base-content/70">Permanently delete all user-created categories (system categories are preserved)</p>
                </div>
                <button onClick={() => setShowClearCategoriesConfirm(true)} className="btn btn-ghost text-error gap-2">
                  <Trash2 className="w-4 h-4" />
                  {clearCategoriesStatus || 'Clear All'}
                </button>
              </div>

              <div className="flex items-center justify-between p-4 border border-base-300 rounded-lg">
                <div>
                  <h3 className="font-medium text-base-content">Database Location</h3>
                  <p className="text-sm text-base-content/70 font-mono">~/Library/Application Support/personal-finance/</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Modals */}
      <Modal
        isOpen={isCreateAccountOpen}
        onClose={() => { setIsCreateAccountOpen(false); resetAccountForm(); }}
        title="Add Account"
        size="md"
      >
        <AccountForm
          formData={accountFormData}
          setFormData={setAccountFormData}
          onSubmit={handleAccountSubmit}
          onCancel={() => { setIsCreateAccountOpen(false); resetAccountForm(); }}
          isSubmitting={isSubmitting}
          error={error}
          isEditing={false}
        />
      </Modal>

      <Modal
        isOpen={!!editingAccount}
        onClose={() => { setEditingAccount(null); resetAccountForm(); }}
        title="Edit Account"
        size="md"
      >
        <AccountForm
          formData={accountFormData}
          setFormData={setAccountFormData}
          onSubmit={handleAccountSubmit}
          onCancel={() => { setEditingAccount(null); resetAccountForm(); }}
          isSubmitting={isSubmitting}
          error={error}
          isEditing={true}
        />
      </Modal>

      {/* Category Modals */}
      <Modal
        isOpen={isCreateCategoryOpen}
        onClose={() => { setIsCreateCategoryOpen(false); resetCategoryForm(); }}
        title="Add Category"
        size="sm"
      >
        <CategoryForm
          formData={categoryFormData}
          setFormData={setCategoryFormData}
          onSubmit={handleCategorySubmit}
          onCancel={() => { setIsCreateCategoryOpen(false); resetCategoryForm(); }}
          isSubmitting={isSubmitting}
          error={error}
          isEditing={false}
        />
      </Modal>

      <Modal
        isOpen={!!editingCategory}
        onClose={() => { setEditingCategory(null); resetCategoryForm(); }}
        title="Edit Category"
        size="sm"
      >
        <CategoryForm
          formData={categoryFormData}
          setFormData={setCategoryFormData}
          onSubmit={handleCategorySubmit}
          onCancel={() => { setEditingCategory(null); resetCategoryForm(); }}
          isSubmitting={isSubmitting}
          error={error}
          isEditing={true}
        />
      </Modal>

      {/* Clear Transactions Confirmation Modal */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear All Transactions?"
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-error/10 border border-error/20 rounded-lg p-4">
            <p className="text-error font-medium mb-2">⚠️ Warning: This action cannot be undone!</p>
            <p className="text-sm text-base-content/70">
              All transactions will be permanently deleted from the database. Make sure you have exported your data if needed.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-4 py-2 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAllTransactions}
              className="px-4 py-2 bg-error text-error-content rounded-lg hover:bg-error/80 font-medium"
            >
              Clear All Transactions
            </button>
          </div>
        </div>
      </Modal>

      {/* Clear Categories Confirmation Modal */}
      <Modal
        isOpen={showClearCategoriesConfirm}
        onClose={() => setShowClearCategoriesConfirm(false)}
        title="Clear All Categories?"
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-error/10 border border-error/20 rounded-lg p-4">
            <p className="text-error font-medium mb-2">⚠️ Warning: This action cannot be undone!</p>
            <p className="text-sm text-base-content/70">
              All user-created categories will be permanently deleted. System categories will be preserved. Transactions will not be deleted, but their category assignments will be removed.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowClearCategoriesConfirm(false)}
              className="px-4 py-2 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAllCategories}
              className="px-4 py-2 bg-error text-error-content rounded-lg hover:bg-error/80 font-medium"
            >
              Clear All Categories
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
