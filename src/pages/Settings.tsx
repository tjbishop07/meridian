import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Tag, Download, Database, Palette, Sparkles, CheckCircle, XCircle, Loader, RefreshCw } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { useOllama } from '../hooks/useOllama';
import Modal from '../components/ui/Modal';
import type { Account, Category } from '../types';

const THEMES = [
  'dark', 'light', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'synthwave', 'retro',
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

const AI_MODELS = [
  {
    name: 'llama3.2',
    displayName: 'Llama 3.2 (Text)',
    size: '~2GB',
    purpose: 'HTML analysis for transaction scraping',
    speed: 'Fast (2-5 sec)',
    recommended: true,
  },
  {
    name: 'llama3.2-vision',
    displayName: 'Llama 3.2 Vision',
    size: '~7GB',
    purpose: 'Screenshot-based transaction extraction',
    speed: 'Slower (5-10 sec)',
    recommended: false,
  },
  {
    name: 'mistral',
    displayName: 'Mistral 7B',
    size: '~4GB',
    purpose: 'Alternative text model',
    speed: 'Fast (2-4 sec)',
    recommended: false,
  },
];

export default function Settings() {
  const { accounts, loadAccounts, createAccount, updateAccount, deleteAccount } = useAccounts();
  const { categories, loadCategories } = useCategories();
  const {
    status: ollamaStatus,
    isChecking: isCheckingOllama,
    isPulling,
    pullingModel,
    pullPercentage,
    pullStatus,
    checkStatus: checkOllamaStatus,
    pullModel,
    openHomebrewInstall,
  } = useOllama();

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
        {/* AI & Models Section */}
        <div className="bg-base-100 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI & Models
              </h2>
              <p className="text-sm text-base-content/70">Manage Ollama and AI models for transaction scraping</p>
            </div>
            <button
              onClick={checkOllamaStatus}
              disabled={isCheckingOllama}
              className="flex items-center gap-2 px-4 py-2 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isCheckingOllama ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Ollama Status */}
          <div className="mb-6 p-4 bg-base-200 rounded-lg">
            <h3 className="font-semibold text-base-content mb-3">Ollama Status</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {ollamaStatus.installed ? (
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : (
                  <XCircle className="w-5 h-5 text-error" />
                )}
                <span className="text-sm text-base-content">
                  Ollama {ollamaStatus.installed ? 'installed' : 'not installed'}
                </span>
              </div>
              {ollamaStatus.installed && (
                <div className="flex items-center gap-3">
                  {ollamaStatus.running ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <XCircle className="w-5 h-5 text-error" />
                  )}
                  <span className="text-sm text-base-content">
                    Server {ollamaStatus.running ? 'running' : 'not running'}
                  </span>
                </div>
              )}
            </div>

            {!ollamaStatus.installed && (
              <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <p className="text-sm text-warning mb-2">Ollama is not installed.</p>
                <button
                  onClick={openHomebrewInstall}
                  className="text-sm text-primary hover:underline"
                >
                  Install via Homebrew →
                </button>
              </div>
            )}
          </div>

          {/* Available Models */}
          <div>
            <h3 className="font-semibold text-base-content mb-3">Available Models</h3>
            <div className="space-y-3">
              {AI_MODELS.map((model) => {
                // More precise matching: check if model name matches exactly (with or without tag)
                const isInstalled = ollamaStatus.availableModels.some(m => {
                  const modelBaseName = m.split(':')[0]; // Remove tag like ":latest"
                  return modelBaseName === model.name;
                });
                const isDownloading = isPulling && pullingModel === model.name;

                return (
                  <div
                    key={model.name}
                    className="p-4 border border-base-300 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-base-content">{model.displayName}</h4>
                          {isInstalled && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-success/20 text-success rounded">
                              Installed
                            </span>
                          )}
                          {model.recommended && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-base-content/70 mb-2">{model.purpose}</p>
                        <div className="flex gap-4 text-xs text-base-content/60">
                          <span>Size: {model.size}</span>
                          <span>Speed: {model.speed}</span>
                        </div>
                      </div>
                      <div>
                        {isInstalled ? (
                          <div className="flex items-center gap-2 text-success">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">Ready</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => pullModel(model.name)}
                            disabled={isDownloading || !ollamaStatus.running}
                            className="btn btn-sm btn-primary"
                          >
                            {isDownloading ? (
                              <>
                                <Loader className="w-4 h-4 animate-spin" />
                                Downloading...
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" />
                                Download
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Show progress if downloading this model */}
                    {isDownloading && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-base-content/70">{pullStatus}</span>
                          <span className="text-xs font-medium text-base-content">{pullPercentage}%</span>
                        </div>
                        <div className="w-full bg-base-300 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${pullPercentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Installed Models List */}
          {ollamaStatus.availableModels.length > 0 && (
            <div className="mt-6 p-4 bg-base-200 rounded-lg">
              <h3 className="font-semibold text-base-content mb-2">Installed Models</h3>
              <div className="flex flex-wrap gap-2">
                {ollamaStatus.availableModels.map((model) => (
                  <span
                    key={model}
                    className="px-3 py-1 text-xs font-medium bg-base-300 text-base-content rounded-full"
                  >
                    {model}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Appearance Section */}
      <div className="bg-base-100 rounded-lg shadow-sm p-6 mb-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Appearance
          </h2>
          <p className="text-sm text-base-content/70">Choose a theme for the application</p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
          {THEMES.map((theme) => (
            <button
              key={theme}
              onClick={() => handleThemeChange(theme)}
              data-theme={theme}
              className={`rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                currentTheme === theme
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-base-300'
              }`}
            >
              <div className="bg-base-100 p-2">
                <div className="flex gap-1 mb-1.5">
                  <div className="rounded-full w-2.5 h-2.5 bg-primary" />
                  <div className="rounded-full w-2.5 h-2.5 bg-secondary" />
                  <div className="rounded-full w-2.5 h-2.5 bg-accent" />
                </div>
                <div className="flex gap-1">
                  <div className="rounded h-1.5 flex-1 bg-base-content/20" />
                  <div className="rounded h-1.5 flex-1 bg-base-content/10" />
                </div>
              </div>
              <div className="bg-base-200 px-2 py-1">
                <p className="text-[10px] font-medium text-base-content truncate text-center capitalize">
                  {theme}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Section */}
      <div className="bg-base-100 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Accounts
            </h2>
            <p className="text-sm text-base-content/70">Manage your bank accounts and credit cards</p>
          </div>
          <button
            onClick={() => setIsCreateAccountOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-8 bg-base-200 rounded-lg">
            <Building2 className="w-10 h-10 text-base-content/50 mx-auto mb-2" />
            <p className="text-base-content/70 mb-2">No accounts yet</p>
            <button
              onClick={() => setIsCreateAccountOpen(true)}
              className="text-primary hover:text-primary font-medium text-sm"
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
                    <span className="px-2 py-0.5 text-xs font-medium bg-base-200 text-base-content/80 rounded">
                      {account.type.replace('_', ' ')}
                    </span>
                    {!account.is_active && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-base-content/70 mt-1">
                    {account.institution} &middot; ${account.balance.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingAccount(account)}
                    className="p-2 text-base-content/50 hover:text-primary transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(account)}
                    className="p-2 text-base-content/50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Categories Section */}
      <div className="bg-base-100 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Categories
            </h2>
            <p className="text-sm text-base-content/70">Organize your transactions into categories</p>
          </div>
          <button
            onClick={() => setIsCreateCategoryOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>

        {/* Expense Categories */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-base-content/80 uppercase tracking-wide mb-3">
            Expense Categories ({expenseCategories.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {expenseCategories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 border border-base-300 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-sm text-base-content">{cat.name}</span>
                  {cat.is_system && (
                    <span className="text-xs text-base-content/50">system</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingCategory(cat)}
                    className="p-1 text-base-content/50 hover:text-primary transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {!cat.is_system && (
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-1 text-base-content/50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Income Categories */}
        <div>
          <h3 className="text-sm font-semibold text-base-content/80 uppercase tracking-wide mb-3">
            Income Categories ({incomeCategories.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {incomeCategories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 border border-base-300 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm text-base-content">{cat.name}</span>
                  {cat.is_system && (
                    <span className="text-xs text-base-content/50">system</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingCategory(cat)}
                    className="p-1 text-base-content/50 hover:text-primary transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {!cat.is_system && (
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-1 text-base-content/50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Management Section */}
      <div className="bg-base-100 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold text-base-content mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Data Management
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-base-300 rounded-lg">
            <div>
              <h3 className="font-medium text-base-content">Export Transactions</h3>
              <p className="text-sm text-base-content/70">Download all transactions as a CSV file</p>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 font-medium"
            >
              <Download className="w-4 h-4" />
              {exportStatus || 'Export CSV'}
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
    </div>
  );
}
