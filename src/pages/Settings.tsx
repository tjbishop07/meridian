import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Tag, Download, Database, Palette, ScanSearch, MessageSquare, Camera } from 'lucide-react';
import { PageSidebar } from '@/components/ui/PageSidebar';
import { usePageEntrance } from '../hooks/usePageEntrance';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import Modal from '../components/ui/Modal';
import { ClaudeVisionTab } from '../components/automation/ClaudeVisionTab';
import { LocalAITab } from '../components/automation/LocalAITab';
import { useAutomationSettings } from '../hooks/useAutomationSettings';
import type { Account, Category } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/FormField';
import { cn } from '@/lib/utils';

const THEMES = [
  'dark', 'light', 'money',
  'ghibli-studio', 'marvel', 'clean-slate', 'spotify',
  'neo-brutalism', 'marshmallow', 'art-deco', 'claude',
  'material-design', 'summer', 'vs-code',
];

const DARK_THEMES = new Set([
  'dark', 'ghibli-studio', 'marvel', 'clean-slate', 'spotify',
  'neo-brutalism', 'marshmallow', 'art-deco', 'claude',
  'material-design', 'summer', 'vs-code',
]);

const THEME_LABELS: Record<string, string> = {
  dark: 'Perplexity', light: 'Light', money: 'Money',
  'ghibli-studio': 'Ghibli', marvel: 'Marvel', 'clean-slate': 'Clean Slate',
  spotify: 'Spotify', 'neo-brutalism': 'Neo Brutal',
  marshmallow: 'Marshmallow', 'art-deco': 'Art Deco', claude: 'Claude',
  'material-design': 'Material', summer: 'Summer', 'vs-code': 'VS Code',
};

const THEME_PREVIEWS: Record<string, { bg: string; dots: string[]; text: string }> = {
  dark:             { bg: '#1c2030', dots: ['#5b9fd0', '#50b8c0', '#4878b8'], text: '#6888a8' },
  light:            { bg: '#f8fafc', dots: ['#4f46e5', '#16a34a', '#db2777'], text: '#475569' },
  money:            { bg: '#0f1f10', dots: ['#16a34a', '#065f46', '#4ade80'], text: '#86efac' },
  'ghibli-studio':  { bg: '#1d1308', dots: ['#6c7a3a', '#b07830', '#407c80'], text: '#aa9068' },
  marvel:           { bg: '#190d0a', dots: ['#aa3020', '#4858a0', '#c0a028'], text: '#907868' },
  'clean-slate':    { bg: '#181d38', dots: ['#7060e0', '#5848d0', '#3a45b8'], text: '#8090b8' },
  spotify:          { bg: '#0e1025', dots: ['#1db954', '#506090', '#40909c'], text: '#7080a8' },
  'neo-brutalism':  { bg: '#000000', dots: ['#d05030', '#d0c825', '#5558d0'], text: '#d8d8d8' },
  marshmallow:      { bg: '#262626', dots: ['#d070a0', '#b070c0', '#7090c8'], text: '#c0c0d8' },
  'art-deco':       { bg: '#383838', dots: ['#c8a020', '#a06030', '#887820'], text: '#d4c880' },
  claude:           { bg: '#2d2d2d', dots: ['#c07040', '#7860c0', '#907870'], text: '#b8a888' },
  'material-design':{ bg: '#180f18', dots: ['#5a40d0', '#409060', '#b050c0'], text: '#a898a8' },
  summer:           { bg: '#2a1f10', dots: ['#c06030', '#c8a030', '#c07030'], text: '#d4b888' },
  'vs-code':        { bg: '#181c2a', dots: ['#4878b0', '#407870', '#6858b0'], text: '#6080a8' },
};

const selectClass = 'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring text-sm disabled:opacity-50';

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

function AccountForm({ formData, setFormData, onSubmit, onCancel, isSubmitting, error, isEditing }: AccountFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <FormField label="Account Name" required>
        <Input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Main Checking"
          required
        />
      </FormField>

      <FormField label="Institution" required>
        <Input
          type="text"
          value={formData.institution}
          onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
          placeholder="e.g., USAA, Chase, Bank of America"
          required
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Account Type" required>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as Account['type'] })}
            className={selectClass}
          >
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="credit_card">Credit Card</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
          </select>
        </FormField>

        <FormField label="Currency">
          <Input
            type="text"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
          />
        </FormField>
      </div>

      <FormField label="Starting Balance">
        <Input
          type="number"
          step="0.01"
          value={formData.balance}
          onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })}
        />
      </FormField>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          className="w-4 h-4 rounded border-border text-primary focus:ring-ring"
        />
        <label htmlFor="is_active" className="text-sm text-muted-foreground cursor-pointer">
          Active account
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Account' : 'Create Account'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
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

function CategoryForm({ formData, setFormData, onSubmit, onCancel, isSubmitting, error, isEditing }: CategoryFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <FormField label="Category Name" required>
        <Input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Groceries, Rent, Salary"
          required
        />
      </FormField>

      <FormField label="Type" required>
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value as 'income' | 'expense' })}
          className={selectClass}
          disabled={isEditing}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </FormField>

      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Category' : 'Create Category'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
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

const DEFAULT_WELCOME_PROMPT =
  'Generate a single witty and funny welcome message for a personal finance app called Sprout. ' +
  'Make it money or finance related and humorous. Keep it under 120 characters. ' +
  'Return only the message text — no quotes, no explanation, no markdown.';

const DEFAULT_RECEIPT_PROMPT =
  'Analyze this receipt image and return ONLY a JSON object — no explanation, no markdown.\n\n' +
  'Available expense categories: {categories}\n\n' +
  '{\n' +
  '  "merchant": "store name or null",\n' +
  '  "date": "YYYY-MM-DD or null",\n' +
  '  "total": number or null,\n' +
  '  "tax": number or null,\n' +
  '  "items": [\n' +
  '    {\n' +
  '      "name": "item description",\n' +
  '      "amount": number,\n' +
  '      "category_name": "best match from category list, or null"\n' +
  '    }\n' +
  '  ]\n' +
  '}';

interface PromptEditorTabProps {
  settingKey: 'scraping_prompt' | 'prompt_welcome';
  defaultPrompt: string;
  title: string;
  description: string;
  hint?: React.ReactNode;
  rows?: number;
}

function PromptEditorTab({ settingKey, defaultPrompt, title, description, hint, rows = 14 }: PromptEditorTabProps) {
  const { settings, loading, saving, updateSettings } = useAutomationSettings();
  const [localPrompt, setLocalPrompt] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLocalPrompt((settings[settingKey] as string) || defaultPrompt);
      setIsDirty(false);
    }
  }, [loading, settings[settingKey]]);

  const handleSave = async () => {
    const valueToSave = localPrompt === defaultPrompt ? '' : localPrompt;
    await updateSettings({ [settingKey]: valueToSave });
    setIsDirty(false);
  };

  const handleReset = async () => {
    setLocalPrompt(defaultPrompt);
    await updateSettings({ [settingKey]: '' });
    setIsDirty(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const isUsingDefault = !settings[settingKey];

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg p-6 border border-border">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {isUsingDefault && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
              Default
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>

        {hint && (
          <div className="mb-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
            {hint}
          </div>
        )}

        <Textarea
          value={localPrompt}
          onChange={(e) => {
            setLocalPrompt(e.target.value);
            setIsDirty(true);
          }}
          rows={rows}
          className="font-mono text-sm resize-y"
        />

        <div className="flex items-center justify-between mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isUsingDefault && !isDirty}
          >
            Reset to Default
          </Button>
          <div className="flex items-center gap-3">
            {saving && <span className="text-xs text-success">Saved</span>}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              Save Prompt
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Receipt settings components ──────────────────────────────────────────────
function ReceiptModelTab() {
  const [aiModel, setAiModel] = useState('ollama');
  const [ollamaModel, setOllamaModel] = useState('llama3.2-vision');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    Promise.all([
      window.electron.invoke('settings:get', 'receipt_ai_model'),
      window.electron.invoke('settings:get', 'receipt_ollama_model'),
    ]).then(([model, olModel]) => {
      if (model) setAiModel(model);
      if (olModel) setOllamaModel(olModel);
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.electron.invoke('settings:set', { key: 'receipt_ai_model', value: aiModel });
      await window.electron.invoke('settings:set', { key: 'receipt_ollama_model', value: ollamaModel });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (err) {
      console.error('Failed to save receipt settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-lg p-6 border border-border space-y-4">
      <h3 className="text-lg font-semibold text-foreground">AI Model</h3>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Analysis Provider</label>
        <select
          value={aiModel}
          onChange={(e) => setAiModel(e.target.value)}
          className={selectClass}
        >
          <option value="ollama">Local AI (Ollama)</option>
          <option value="claude">Claude API</option>
        </select>
      </div>

      {aiModel === 'ollama' && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Ollama Model</label>
          <Input
            type="text"
            value={ollamaModel}
            onChange={(e) => setOllamaModel(e.target.value)}
            placeholder="e.g. llama3.2-vision"
          />
          <p className="text-xs text-muted-foreground">Must be a vision-capable model installed in Ollama.</p>
        </div>
      )}

      {aiModel === 'claude' && (
        <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
          <p className="text-xs text-muted-foreground">
            Uses the Claude API key configured in <strong>Scraping → Claude Vision AI</strong>.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        {savedMsg && <span className="text-xs text-success">Saved</span>}
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

function ReceiptPromptEditor() {
  const [prompt, setPrompt] = useState(DEFAULT_RECEIPT_PROMPT);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDefault, setIsDefault] = useState(true);

  useEffect(() => {
    window.electron.invoke('settings:get', 'receipt_prompt').then((val) => {
      if (val) {
        setPrompt(val);
        setIsDefault(false);
      } else {
        setPrompt(DEFAULT_RECEIPT_PROMPT);
        setIsDefault(true);
      }
      setIsDirty(false);
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const valueToSave = prompt === DEFAULT_RECEIPT_PROMPT ? '' : prompt;
      await window.electron.invoke('settings:set', { key: 'receipt_prompt', value: valueToSave });
      setIsDefault(valueToSave === '');
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to save receipt prompt:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setPrompt(DEFAULT_RECEIPT_PROMPT);
    await window.electron.invoke('settings:set', { key: 'receipt_prompt', value: '' });
    setIsDefault(true);
    setIsDirty(false);
  };

  return (
    <div className="bg-card rounded-lg p-6 border border-border space-y-4">
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-foreground">Receipt Analysis Prompt</h3>
        {isDefault && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
            Default
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Customize the prompt sent to the AI when analyzing receipt photos.
      </p>
      <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
        <p className="text-xs text-muted-foreground">
          Use <code className="px-1 py-0.5 bg-muted rounded font-mono">{'{categories}'}</code> as a placeholder for the category list. Return valid JSON only.
        </p>
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => { setPrompt(e.target.value); setIsDirty(true); }}
        rows={14}
        className="font-mono text-sm resize-y"
      />
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleReset} disabled={isDefault && !isDirty}>
          Reset to Default
        </Button>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-success">Saved</span>}
          <Button size="sm" onClick={handleSave} disabled={!isDirty || saving}>
            Save Prompt
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({
  id,
  icon,
  title,
  subtitle,
  headerAction,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="mb-14 pb-14 border-b border-border/20 last:border-0 last:mb-0 last:pb-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            {title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {headerAction && <div>{headerAction}</div>}
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { accounts, loadAccounts, createAccount, updateAccount, deleteAccount } = useAccounts();
  const { categories, loadCategories } = useCategories();

  const [currentTheme, setCurrentTheme] = useState('dark');

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
  const [promptsTab, setPromptsTab] = useState<'welcome'>('welcome');
  const [receiptTab, setReceiptTab] = useState<'model' | 'prompt'>('model');
  const { sidebarClass, contentClass } = usePageEntrance();

  useEffect(() => {
    loadAccounts();
    loadCategories();
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const theme = await window.electron.invoke('settings:get', 'theme');
      if (theme) setCurrentTheme(theme);
    } catch (err) {
      console.error('Failed to load theme:', err);
    }
  };

  const handleThemeChange = async (theme: string) => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (DARK_THEMES.has(theme)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
      setCategoryFormData({ name: editingCategory.name, type: editingCategory.type });
    } else {
      resetCategoryForm();
    }
  }, [editingCategory]);

  const resetAccountForm = () => {
    setAccountFormData({ name: '', type: 'checking', institution: '', balance: 0, currency: 'USD', is_active: true });
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
          parent_id: null, icon: null, color: null, is_system: false,
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
    if (category.is_system) { alert('System categories cannot be deleted.'); return; }
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
      const headers = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Account', 'Status', 'Notes'];
      const rows = transactions.map((t: any) => [
        t.date,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.amount, t.type,
        `"${(t.category_name || 'Uncategorized').replace(/"/g, '""')}"`,
        `"${(t.account_name || '').replace(/"/g, '""')}"`,
        t.status,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ]);
      const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
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

  const SECTIONS = [
    { id: 'appearance',      Icon: Palette,        label: 'Appearance' },
    { id: 'accounts',        Icon: Building2,       label: 'Accounts' },
    { id: 'categories',      Icon: Tag,             label: 'Categories' },
    { id: 'scraping',        Icon: ScanSearch,      label: 'Scraping' },
    { id: 'prompts',         Icon: MessageSquare,   label: 'Prompts' },
    { id: 'receipt_scanning', Icon: Camera,         label: 'Receipts' },
    { id: 'data',            Icon: Database,        label: 'Data' },
  ];

  return (
    <div className="flex h-full">
      <PageSidebar title="Settings" className={sidebarClass}>
        <div className="px-4 pt-4 pb-3 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/35 mb-3">
            Sections
          </p>
          <div className="space-y-1.5">
            {SECTIONS.map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all duration-150"
              >
                <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-muted/60">
                  <Icon className="w-3 h-3" />
                </div>
                <p className="text-xs font-medium leading-none">{label}</p>
              </button>
            ))}
          </div>
        </div>
      </PageSidebar>

      <div className={cn('flex-1 flex flex-col overflow-hidden', contentClass)}>
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-10 pt-8 pb-10">

        {/* ── Appearance ── */}
        <Section
          id="appearance"
          icon={<Palette className="w-4 h-4" />}
          title="Appearance"
          subtitle="Choose a theme for the application"
        >
          <div className="flex flex-wrap gap-3">
            {THEMES.map((theme) => {
              const preview = THEME_PREVIEWS[theme];
              return (
                <button
                  key={theme}
                  onClick={() => handleThemeChange(theme)}
                  className={cn(
                    'rounded-xl overflow-hidden border-2 transition-all hover:scale-105 w-24',
                    currentTheme === theme
                      ? 'border-primary shadow-lg shadow-primary/20'
                      : 'border-border hover:border-muted-foreground/40'
                  )}
                >
                  <div className="p-3" style={{ backgroundColor: preview.bg }}>
                    <div className="flex gap-1 mb-2">
                      {preview.dots.map((dot, i) => (
                        <div key={i} className="rounded-full w-2.5 h-2.5" style={{ backgroundColor: dot }} />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <div className="rounded h-1.5 flex-1" style={{ backgroundColor: preview.text, opacity: 0.25 }} />
                      <div className="rounded h-1.5 flex-1" style={{ backgroundColor: preview.text, opacity: 0.12 }} />
                    </div>
                  </div>
                  <div
                    className="px-2 py-1.5"
                    style={{ backgroundColor: preview.bg, borderTop: `1px solid ${preview.text}25` }}
                  >
                    <p
                      className="text-xs font-medium truncate text-center"
                      style={{ color: preview.text }}
                    >
                      {THEME_LABELS[theme] ?? theme}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Accounts ── */}
        <Section
          id="accounts"
          icon={<Building2 className="w-4 h-4" />}
          title="Accounts"
          subtitle="Manage your bank accounts and credit cards"
          headerAction={
            <Button size="sm" onClick={() => setIsCreateAccountOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          }
        >
          {accounts.length === 0 ? (
            <div className="text-center py-8 bg-muted/50 rounded-lg">
              <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground mb-2">No accounts yet</p>
              <button
                onClick={() => setIsCreateAccountOpen(true)}
                className="text-primary font-medium text-sm hover:underline"
              >
                Create your first account
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-muted-foreground/30 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-foreground">{account.name}</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                        {account.type.replace('_', ' ')}
                      </span>
                      {!account.is_active && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-destructive/10 text-destructive">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {account.institution} &middot; ${account.balance.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingAccount(account)}
                      className="p-2 text-muted-foreground hover:text-primary transition-colors rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(account)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Categories ── */}
        <Section
          id="categories"
          icon={<Tag className="w-4 h-4" />}
          title="Categories"
          subtitle="Organize your transactions into categories"
          headerAction={
            <Button size="sm" onClick={() => setIsCreateCategoryOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          }
        >
          {/* Expense Categories */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Expense Categories</h3>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                {expenseCategories.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {expenseCategories.map((cat) => (
                <div key={cat.id} className="bg-muted/50 rounded-lg p-3 border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
                      <span className="font-medium text-sm text-foreground truncate" data-category-name={cat.name}>
                        {String(cat.name).trim()}
                      </span>
                      {Boolean(cat.is_system) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground flex-shrink-0">
                          system
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => setEditingCategory(cat)}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors rounded"
                        title="Edit category"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {!cat.is_system && (
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                          title="Delete category"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Income Categories */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Income Categories</h3>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                {incomeCategories.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {incomeCategories.map((cat) => (
                <div key={cat.id} className="bg-muted/50 rounded-lg p-3 border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                      <span className="font-medium text-sm text-foreground truncate" data-category-name={cat.name}>
                        {String(cat.name).trim()}
                      </span>
                      {Boolean(cat.is_system) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground flex-shrink-0">
                          system
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => setEditingCategory(cat)}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors rounded"
                        title="Edit category"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {!cat.is_system && (
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                          title="Delete category"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Scraping ── */}
        <Section
          id="scraping"
          icon={<ScanSearch className="w-4 h-4" />}
          title="Scraping"
        >
          {/* Inner tab bar */}
          <div className="flex border-b border-border mb-6 -mx-6 px-6">
            {([
              { key: 'claude' as const, label: 'Claude Vision AI' },
              { key: 'ollama' as const, label: 'Local AI (Ollama)' },
              { key: 'prompt' as const, label: 'Prompt' },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setScrapingTab(tab.key)}
                className={cn(
                  'px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
                  scrapingTab === tab.key
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {scrapingTab === 'claude' && <ClaudeVisionTab />}
          {scrapingTab === 'ollama' && <LocalAITab />}
          {scrapingTab === 'prompt' && (
            <PromptEditorTab
              settingKey="scraping_prompt"
              defaultPrompt={DEFAULT_SCRAPING_PROMPT}
              title="Scraping Prompt"
              description="Customize the prompt sent to the AI when scraping transactions. Edit it to fine-tune extraction for your specific bank."
              hint={
                <p className="text-xs text-muted-foreground">
                  The prompt must instruct the AI to return a JSON array with fields:
                  {['date', 'description', 'amount', 'balance', 'category', 'confidence'].map((f) => (
                    <code key={f} className="mx-1 px-1 py-0.5 bg-muted rounded text-xs font-mono">{f}</code>
                  ))}
                </p>
              }
              rows={18}
            />
          )}
        </Section>

        {/* ── Prompts ── */}
        <Section
          id="prompts"
          icon={<MessageSquare className="w-4 h-4" />}
          title="Prompts"
          subtitle="Customize the AI prompts used throughout the app"
        >
          <div className="flex border-b border-border mb-6 -mx-6 px-6">
            {([{ key: 'welcome' as const, label: 'Welcome Message' }]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPromptsTab(tab.key)}
                className={cn(
                  'px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
                  promptsTab === tab.key
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {promptsTab === 'welcome' && (
            <PromptEditorTab
              settingKey="prompt_welcome"
              defaultPrompt={DEFAULT_WELCOME_PROMPT}
              title="Welcome Message Prompt"
              description="The prompt used to generate the witty welcome message shown in the ticker when the app starts. Requires Ollama to be running."
              hint={
                <p className="text-xs text-muted-foreground">
                  Ollama will generate one message per session using this prompt. If Ollama is unavailable, a plain date/time message is shown as a fallback.
                </p>
              }
              rows={6}
            />
          )}
        </Section>

        {/* ── Receipt Scanning ── */}
        <Section
          id="receipt_scanning"
          icon={<Camera className="w-4 h-4" />}
          title="Receipt Scanning"
          subtitle="Capture and analyze receipts with AI from your phone"
        >
          {/* Inner tab bar */}
          <div className="flex border-b border-border mb-6 -mx-6 px-6">
            {([
              { key: 'model' as const, label: 'Model' },
              { key: 'prompt' as const, label: 'Prompt' },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setReceiptTab(tab.key)}
                className={cn(
                  'px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
                  receiptTab === tab.key
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {receiptTab === 'model' && <ReceiptModelTab />}
          {receiptTab === 'prompt' && <ReceiptPromptEditor />}
        </Section>

        {/* ── Data Management ── */}
        <Section
          id="data"
          icon={<Database className="w-4 h-4" />}
          title="Data Management"
          subtitle="Export data and manage database records"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <h3 className="font-medium text-foreground">Export Transactions</h3>
                <p className="text-sm text-muted-foreground">Download all transactions as a CSV file</p>
              </div>
              <Button variant="ghost" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                {exportStatus || 'Export CSV'}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <h3 className="font-medium text-foreground">Clear All Transactions</h3>
                <p className="text-sm text-muted-foreground">Permanently delete all transactions from the database</p>
              </div>
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setShowClearConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                {clearStatus || 'Clear All'}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <h3 className="font-medium text-foreground">Clear All Categories</h3>
                <p className="text-sm text-muted-foreground">Permanently delete all user-created categories (system categories are preserved)</p>
              </div>
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setShowClearCategoriesConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                {clearCategoriesStatus || 'Clear All'}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <h3 className="font-medium text-foreground">Database Location</h3>
                <p className="text-sm text-muted-foreground font-mono">~/Library/Application Support/personal-finance/</p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* Account Modals */}
      <Modal isOpen={isCreateAccountOpen} onClose={() => { setIsCreateAccountOpen(false); resetAccountForm(); }} title="Add Account" size="md">
        <AccountForm formData={accountFormData} setFormData={setAccountFormData} onSubmit={handleAccountSubmit}
          onCancel={() => { setIsCreateAccountOpen(false); resetAccountForm(); }}
          isSubmitting={isSubmitting} error={error} isEditing={false} />
      </Modal>

      <Modal isOpen={!!editingAccount} onClose={() => { setEditingAccount(null); resetAccountForm(); }} title="Edit Account" size="md">
        <AccountForm formData={accountFormData} setFormData={setAccountFormData} onSubmit={handleAccountSubmit}
          onCancel={() => { setEditingAccount(null); resetAccountForm(); }}
          isSubmitting={isSubmitting} error={error} isEditing={true} />
      </Modal>

      {/* Category Modals */}
      <Modal isOpen={isCreateCategoryOpen} onClose={() => { setIsCreateCategoryOpen(false); resetCategoryForm(); }} title="Add Category" size="sm">
        <CategoryForm formData={categoryFormData} setFormData={setCategoryFormData} onSubmit={handleCategorySubmit}
          onCancel={() => { setIsCreateCategoryOpen(false); resetCategoryForm(); }}
          isSubmitting={isSubmitting} error={error} isEditing={false} />
      </Modal>

      <Modal isOpen={!!editingCategory} onClose={() => { setEditingCategory(null); resetCategoryForm(); }} title="Edit Category" size="sm">
        <CategoryForm formData={categoryFormData} setFormData={setCategoryFormData} onSubmit={handleCategorySubmit}
          onCancel={() => { setEditingCategory(null); resetCategoryForm(); }}
          isSubmitting={isSubmitting} error={error} isEditing={true} />
      </Modal>

      {/* Clear Transactions Confirmation */}
      <Modal isOpen={showClearConfirm} onClose={() => setShowClearConfirm(false)} title="Clear All Transactions?" size="sm">
        <div className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive font-medium mb-2">⚠️ Warning: This action cannot be undone!</p>
            <p className="text-sm text-muted-foreground">
              All transactions will be permanently deleted from the database. Make sure you have exported your data if needed.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClearAllTransactions}>Clear All Transactions</Button>
          </div>
        </div>
      </Modal>

      {/* Clear Categories Confirmation */}
      <Modal isOpen={showClearCategoriesConfirm} onClose={() => setShowClearCategoriesConfirm(false)} title="Clear All Categories?" size="sm">
        <div className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive font-medium mb-2">⚠️ Warning: This action cannot be undone!</p>
            <p className="text-sm text-muted-foreground">
              All user-created categories will be permanently deleted. System categories will be preserved. Transactions will not be deleted, but their category assignments will be removed.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowClearCategoriesConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClearAllCategories}>Clear All Categories</Button>
          </div>
        </div>
      </Modal>
      </div>
    </div>
  );
}
