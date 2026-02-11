// Database Models

export interface Account {
  id: number;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'other';
  institution: string;
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  parent_id: number | null;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  created_at: string;
}

export interface Transaction {
  id: number;
  account_id: number;
  category_id: number | null;
  date: string;
  description: string;
  original_description: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  status: 'pending' | 'cleared' | 'reconciled';
  notes: string | null;
  external_id: string | null;
  linked_transaction_id: number | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  account_name?: string;
  category_name?: string;
  linked_account_name?: string;
}

export interface Budget {
  id: number;
  category_id: number;
  month: string; // YYYY-MM format
  amount: number;
  rollover: boolean;
  notes: string | null;
  created_at: string;

  // Joined/computed fields
  category_name?: string;
  spent?: number;
  remaining?: number;
}

export interface Goal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  category_id: number | null;
  is_completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Joined/computed fields
  category_name?: string;
  progress?: number;
  days_remaining?: number;
}

export interface GoalContribution {
  id: number;
  goal_id: number;
  amount: number;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface Bill {
  id: number;
  name: string;
  amount: number;
  category_id: number | null;
  due_day: number; // 1-31
  frequency: 'monthly' | 'quarterly' | 'yearly';
  account_id: number | null;
  is_autopay: boolean;
  reminder_days: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Computed fields
  next_due_date?: string;
  days_until_due?: number;
}

export interface BillPayment {
  id: number;
  bill_id: number;
  transaction_id: number | null;
  date: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

export interface ImportHistory {
  id: number;
  filename: string;
  account_id: number;
  import_date: string;
  format: string;
  rows_imported: number;
  rows_skipped: number;
  date_range_start: string | null;
  date_range_end: string | null;
}

export interface Settings {
  key: string;
  value: string;
  updated_at: string;
}

// API Request/Response Types

export interface TransactionFilters {
  account_id?: number;
  category_id?: number;
  type?: 'income' | 'expense' | 'transfer';
  start_date?: string;
  end_date?: string;
  search?: string;
  status?: Transaction['status'];
  limit?: number;
  offset?: number;
}

export interface CreateTransactionInput {
  account_id: number;
  category_id?: number;
  date: string;
  description: string;
  original_description?: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  status?: Transaction['status'];
  notes?: string;
  // For transfers only
  to_account_id?: number;
}

export interface UpdateTransactionInput {
  id: number;
  category_id?: number;
  description?: string;
  amount?: number;
  date?: string;
  status?: Transaction['status'];
  notes?: string;
  type?: 'income' | 'expense' | 'transfer';
  to_account_id?: number;
  account_id?: number;
}

export interface BudgetInput {
  category_id: number;
  month: string;
  amount: number;
  rollover?: boolean;
  notes?: string;
}

export interface GoalInput {
  name: string;
  target_amount: number;
  current_amount?: number;
  target_date?: string;
  category_id?: number;
  notes?: string;
}

export interface BillInput {
  name: string;
  amount: number;
  category_id?: number;
  due_day: number;
  frequency: Bill['frequency'];
  account_id?: number;
  is_autopay?: boolean;
  reminder_days?: number;
  notes?: string;
}

// CSV Import Types

export interface CSVFormat {
  name: string;
  institution: string;
  columns: {
    date: string;
    description: string;
    amount: string;
    category?: string;
    status?: string;
  };
  dateFormat: string;
  amountMultiplier: number; // -1 for inverted amounts
}

export interface ParsedCSVRow {
  date: string;
  description: string;
  original_description: string;
  amount: number;
  category?: string;
  status?: string;
}

export interface ImportPreview {
  format: CSVFormat;
  rows: ParsedCSVRow[];
  duplicates: Array<{
    csvRow: ParsedCSVRow;
    existingTransaction: Transaction;
    matchType: 'exact' | 'fuzzy';
    confidence: number;
  }>;
  errors: Array<{
    row: number;
    error: string;
  }>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  history_id: number;
}

// Analytics Types

export interface MonthlyStats {
  month: string;
  income: number;
  expenses: number;
  net: number;
  transaction_count: number;
}

export interface CategoryBreakdown {
  category_id: number;
  category_name: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface DashboardData {
  currentMonth: MonthlyStats;
  previousMonth: MonthlyStats;
  topExpenseCategories: CategoryBreakdown[];
  upcomingBills: Array<Bill & { days_until_due: number }>;
  budgetProgress: Array<Budget & { spent: number; remaining: number; percentage: number }>;
  goalProgress: Array<Goal & { progress: number }>;
  recentTransactions: Transaction[];
}

export interface SpendingTrend {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

// Export Recipe/Automation Types

export interface RecordingStep {
  type: 'click' | 'type' | 'select' | 'navigate' | 'wait';
  selector?: string;
  value?: string;
  url?: string;
  delay?: number;
  description?: string;
}

export interface ExportRecipe {
  id: string;
  name: string;
  institution: string | null;
  url: string;
  steps: RecordingStep[];
  created_at: string;
  updated_at: string;
}

// Electron IPC API

export interface ElectronAPI {
  // Transactions
  invoke(channel: 'transactions:get-all', filters?: TransactionFilters): Promise<Transaction[]>;
  invoke(channel: 'transactions:get-by-id', id: number): Promise<Transaction | null>;
  invoke(channel: 'transactions:create', data: CreateTransactionInput): Promise<Transaction>;
  invoke(channel: 'transactions:update', data: UpdateTransactionInput): Promise<Transaction>;
  invoke(channel: 'transactions:delete', id: number): Promise<void>;
  invoke(channel: 'transactions:bulk-create', data: CreateTransactionInput[]): Promise<number>;

  // Accounts
  invoke(channel: 'accounts:get-all'): Promise<Account[]>;
  invoke(channel: 'accounts:get-by-id', id: number): Promise<Account | null>;
  invoke(channel: 'accounts:create', data: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Promise<Account>;
  invoke(channel: 'accounts:update', data: Partial<Account> & { id: number }): Promise<Account>;
  invoke(channel: 'accounts:delete', id: number): Promise<void>;

  // Categories
  invoke(channel: 'categories:get-all'): Promise<Category[]>;
  invoke(channel: 'categories:get-tree'): Promise<Category[]>;
  invoke(channel: 'categories:create', data: Omit<Category, 'id' | 'created_at'>): Promise<Category>;
  invoke(channel: 'categories:update', data: Partial<Category> & { id: number }): Promise<Category>;
  invoke(channel: 'categories:delete', id: number): Promise<void>;

  // Budgets
  invoke(channel: 'budgets:get-by-month', month: string): Promise<Budget[]>;
  invoke(channel: 'budgets:create', data: BudgetInput): Promise<Budget>;
  invoke(channel: 'budgets:update', data: Partial<BudgetInput> & { id: number }): Promise<Budget>;
  invoke(channel: 'budgets:delete', id: number): Promise<void>;

  // Goals
  invoke(channel: 'goals:get-all', includeCompleted?: boolean): Promise<Goal[]>;
  invoke(channel: 'goals:get-by-id', id: number): Promise<Goal | null>;
  invoke(channel: 'goals:create', data: GoalInput): Promise<Goal>;
  invoke(channel: 'goals:update', data: Partial<GoalInput> & { id: number }): Promise<Goal>;
  invoke(channel: 'goals:delete', id: number): Promise<void>;
  invoke(channel: 'goals:add-contribution', data: { goal_id: number; amount: number; date?: string; notes?: string }): Promise<GoalContribution>;

  // Bills
  invoke(channel: 'bills:get-all', activeOnly?: boolean): Promise<Bill[]>;
  invoke(channel: 'bills:get-upcoming', days: number): Promise<Bill[]>;
  invoke(channel: 'bills:create', data: BillInput): Promise<Bill>;
  invoke(channel: 'bills:update', data: Partial<BillInput> & { id: number }): Promise<Bill>;
  invoke(channel: 'bills:delete', id: number): Promise<void>;
  invoke(channel: 'bills:record-payment', data: { bill_id: number; amount: number; date?: string; transaction_id?: number; notes?: string }): Promise<BillPayment>;

  // Import
  invoke(channel: 'import:detect-format', filePath: string): Promise<CSVFormat | null>;
  invoke(channel: 'import:preview', data: { filePath: string; accountId: number; format: CSVFormat }): Promise<ImportPreview>;
  invoke(channel: 'import:execute', data: { accountId: number; rows: ParsedCSVRow[]; skipDuplicates: boolean; filename: string; format: string }): Promise<ImportResult>;

  // Analytics
  invoke(channel: 'analytics:dashboard', month: string): Promise<DashboardData>;
  invoke(channel: 'analytics:spending-trends', months: number): Promise<SpendingTrend[]>;
  invoke(channel: 'analytics:category-breakdown', data: { start_date: string; end_date: string; type: 'income' | 'expense' }): Promise<CategoryBreakdown[]>;

  // Settings
  invoke(channel: 'settings:get', key: string): Promise<string | null>;
  invoke(channel: 'settings:set', data: { key: string; value: string }): Promise<void>;
  invoke(channel: 'settings:get-all'): Promise<Settings[]>;

  // File operations
  invoke(channel: 'dialog:open-file', options: { filters: Array<{ name: string; extensions: string[] }> }): Promise<string | null>;

  // Browser
  invoke(channel: 'browser:attach', url: string): Promise<{ success: boolean }>;
  invoke(channel: 'browser:detach'): Promise<{ success: boolean }>;
  invoke(channel: 'browser:show'): Promise<{ success: boolean }>;
  invoke(channel: 'browser:hide'): Promise<{ success: boolean }>;
  invoke(channel: 'browser:navigate', url: string): Promise<{ success: boolean }>;
  invoke(channel: 'browser:back'): Promise<{ success: boolean }>;
  invoke(channel: 'browser:forward'): Promise<{ success: boolean }>;
  invoke(channel: 'browser:reload'): Promise<{ success: boolean }>;
  invoke(channel: 'browser:start-recording'): Promise<{ success: boolean }>;
  invoke(channel: 'browser:stop-recording'): Promise<{ success: boolean; recording?: any }>;
  invoke(channel: 'browser:execute-step', step: any): Promise<{ success: boolean; error?: string }>;
  invoke(channel: 'browser:prompt-sensitive-input', label: string, stepNumber: number, totalSteps: number): Promise<string>;

  // Automation
  invoke(channel: 'automation:start-recording', startUrl?: string): Promise<{ success: boolean }>;
  invoke(channel: 'automation:save-recording', data: { name: string; institution: string | null; url: string; steps: string }): Promise<void>;
  invoke(channel: 'automation:play-recording', recipeId: string): Promise<void>;
  invoke(channel: 'automation:provide-sensitive-input', value: string): Promise<void>;

  // Export Recipes
  invoke(channel: 'export-recipes:get-all'): Promise<ExportRecipe[]>;
  invoke(channel: 'export-recipes:get-by-id', id: string): Promise<ExportRecipe | null>;
  invoke(channel: 'export-recipes:create', data: { name: string; institution: string | null; url: string; steps: string }): Promise<ExportRecipe>;
  invoke(channel: 'export-recipes:update', data: { id: string | number; name?: string; institution?: string | null; steps?: any[] }): Promise<void>;
  invoke(channel: 'export-recipes:delete', id: string): Promise<void>;

  // Puppeteer Scraper
  invoke(channel: 'puppeteer:find-chrome'): Promise<{ found: boolean; path?: string; error?: string }>;
  invoke(channel: 'puppeteer:start-browser', options: { startUrl: string; chromePath?: string; useUserProfile?: boolean }): Promise<{ success: boolean; error?: string }>;
  invoke(channel: 'puppeteer:start-recording'): Promise<{ success: boolean; url?: string; error?: string }>;
  invoke(channel: 'puppeteer:stop-recording'): Promise<{ success: boolean; steps?: any[]; error?: string }>;
  invoke(channel: 'puppeteer:execute-recipe', recipe: { steps: any[]; extractionScript?: string }): Promise<{ success: boolean; transactions?: any[]; count?: number; error?: string }>;
  invoke(channel: 'puppeteer:extract-transactions'): Promise<{ success: boolean; transactions?: any[]; count?: number; error?: string }>;
  invoke(channel: 'puppeteer:close-browser'): Promise<{ success: boolean; error?: string }>;

  // Ollama
  invoke(channel: 'ollama:check-status'): Promise<{ installed: boolean; running: boolean; hasVisionModel: boolean; availableModels: string[]; error?: string }>;
  invoke(channel: 'ollama:check-homebrew'): Promise<{ installed: boolean }>;
  invoke(channel: 'ollama:open-homebrew-install'): Promise<void>;
  invoke(channel: 'ollama:install'): Promise<{ success: boolean; error?: string }>;
  invoke(channel: 'ollama:start-server'): Promise<{ success: boolean; error?: string }>;
  invoke(channel: 'ollama:pull-model', modelName: string): Promise<{ success: boolean; error?: string }>;
  invoke(channel: 'ollama:open-download-page'): Promise<void>;
  invoke(channel: 'ollama:generate', data: { model: string; prompt: string; stream?: boolean }): Promise<{ success: boolean; response?: string; error?: string }>;

  // AI Scraper
  invoke(channel: 'ai-scraper:check-model'): Promise<{ installed: boolean }>;
  invoke(channel: 'ai-scraper:open-browser', options: { accountId: number; startUrl: string }): Promise<{ success: boolean; error?: string }>;
  invoke(channel: 'ai-scraper:execute', accountId: number): Promise<{ success: boolean; transactions?: any[]; error?: string }>;
  invoke(channel: 'ai-scraper:execute-html', accountId: number): Promise<{ success: boolean; transactions?: any[]; error?: string }>;

  // Scraper
  invoke(channel: 'scraper:open-browser', options: { accountId: number; startUrl: string }): Promise<{ success: boolean; error?: string }>;

  // Event listeners
  on(channel: 'csv:downloaded', callback: (data: { filePath: string; fileName: string }) => void): void;
  on(channel: 'recorder:interaction', callback: (interaction: any) => void): void;
  on(channel: 'browser:loading', callback: (isLoading: boolean) => void): void;
  on(channel: 'browser:url-changed', callback: (url: string) => void): void;
  on(channel: 'browser:error', callback: (error: { code: number; description: string; url: string }) => void): void;
  on(channel: 'automation:recording-saved', callback: () => void): void;
  on(channel: 'automation:playback-complete', callback: () => void): void;
  on(channel: 'automation:playback-needs-input', callback: (data: { stepNumber: number; totalSteps: number; fieldLabel: string }) => void): void;
  on(channel: 'scraper:transactions-found', callback: (data: { accountId: number; transactions: any[] }) => void): void;
  on(channel: 'ollama:pull-progress', callback: (data: string) => void): void;
  on(channel: 'ollama:install-progress', callback: (data: string) => void): void;
  removeListener(channel: string, callback: (...args: any[]) => void): void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
