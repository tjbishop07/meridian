# Development Guide

This guide helps you continue building the Personal Finance app from where we left off.

## Current State

**Phases Complete**: 1 (Foundation), 2 (Database & IPC)
**Phase In Progress**: 3 (Basic UI - 60% done)
**App Status**: ✅ Fully functional with database and IPC working

## Quick Start

```bash
# 1. Start the app
npm run dev

# 2. The app will open in an Electron window
# 3. Navigate to Transactions page to see IPC working
# 4. Check console logs for database operations
```

## Next Steps: Complete Phase 3

### 1. Create Zustand Store (`src/store/index.ts`)

```typescript
import { create } from 'zustand';
import type { Transaction, Account, Category } from '../types';

interface AppState {
  // Data
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  selectedAccountId: number | null;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  loadTransactions: (filters?: any) => Promise<void>;
  loadAccounts: () => Promise<void>;
  loadCategories: () => Promise<void>;
  setSelectedAccount: (id: number | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  transactions: [],
  accounts: [],
  categories: [],
  selectedAccountId: null,
  isLoading: false,
  error: null,

  loadTransactions: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const transactions = await window.electron.invoke('transactions:get-all', filters);
      set({ transactions, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  // ... implement other actions
}));
```

### 2. Create Transaction Hook (`src/hooks/useTransactions.ts`)

```typescript
import { useStore } from '../store';
import type { CreateTransactionInput, UpdateTransactionInput } from '../types';

export function useTransactions() {
  const store = useStore();

  const createTransaction = async (data: CreateTransactionInput) => {
    try {
      const transaction = await window.electron.invoke('transactions:create', data);
      await store.loadTransactions(); // Refresh list
      return transaction;
    } catch (error) {
      console.error('Failed to create transaction:', error);
      throw error;
    }
  };

  const updateTransaction = async (data: UpdateTransactionInput) => {
    // Similar implementation
  };

  const deleteTransaction = async (id: number) => {
    // Similar implementation
  };

  return {
    transactions: store.transactions,
    isLoading: store.isLoading,
    error: store.error,
    loadTransactions: store.loadTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
```

### 3. Build Transaction Form Component

Create `src/components/transactions/TransactionForm.tsx`:
- Form inputs for all transaction fields
- Date picker (using date-fns)
- Account selector dropdown
- Category selector dropdown
- Amount input with type (income/expense) toggle
- Description and notes fields
- Form validation

### 4. Build Transaction Modal Component

Create `src/components/transactions/TransactionModal.tsx`:
- Modal wrapper (consider using Headless UI or custom)
- Embed TransactionForm
- Handle create/edit modes
- Submit and cancel actions

### 5. Update Transactions Page

Enhance `src/pages/Transactions.tsx`:
- Use Zustand store instead of local state
- Add "Add Transaction" button that opens modal
- Add edit button on each row
- Add delete button with confirmation
- Add filters (date range, account, category, search)
- Add pagination if needed

## Adding New IPC Handlers

When you need new IPC functionality:

### 1. Add to Types (`src/types/index.ts`)

```typescript
export interface ElectronAPI {
  // Add your new method signature
  invoke(channel: 'categories:get-all'): Promise<Category[]>;
}
```

### 2. Create Query Module (`electron/db/queries/categories.ts`)

```typescript
import { getDatabase } from '../index';
import type { Category } from '../../../src/types';

export function getAllCategories(): Category[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM categories ORDER BY name').all() as Category[];
}
```

### 3. Create IPC Handler (`electron/ipc/categories.ts`)

```typescript
import { ipcMain } from 'electron';
import * as categoryQueries from '../db/queries/categories';

export function registerCategoryHandlers(): void {
  ipcMain.handle('categories:get-all', async () => {
    try {
      return categoryQueries.getAllCategories();
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  });
}
```

### 4. Register in Main Process (`electron/main.ts`)

```typescript
import { registerCategoryHandlers } from './ipc/categories';

// In app.whenReady()
registerCategoryHandlers();
```

### 5. Whitelist Channel in Preload (`electron/preload.ts`)

```typescript
const validChannels = [
  // ... existing channels
  'categories:get-all',
];
```

### 6. Use in React

```typescript
const categories = await window.electron.invoke('categories:get-all');
```

## Implementing Phase 4: CSV Import

### Step 1: Create CSV Format Detector

File: `electron/services/csv-detector.ts`

```typescript
import fs from 'fs';
import Papa from 'papaparse';
import type { CSVFormat } from '../../src/types';

const formats: CSVFormat[] = [
  {
    name: 'USAA',
    institution: 'USAA',
    columns: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      category: 'Category',
      status: 'Status',
    },
    dateFormat: 'YYYY-MM-DD',
    amountMultiplier: 1,
  },
  // Add more bank formats here
];

export async function detectFormat(filePath: string): Promise<CSVFormat | null> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse(content, { header: true, preview: 5 });

  if (!result.data || result.data.length === 0) {
    return null;
  }

  const headers = Object.keys(result.data[0]);

  // Try to match headers with known formats
  for (const format of formats) {
    const requiredColumns = Object.values(format.columns);
    const matchCount = requiredColumns.filter(col => headers.includes(col)).length;

    if (matchCount >= 3) { // At least 3 columns match
      return format;
    }
  }

  return null;
}
```

### Step 2: Create Import IPC Handlers

Follow the pattern above to create import handlers.

### Step 3: Build Import Wizard UI

Create a multi-step wizard in `src/pages/Import.tsx`:
1. File selection (drag & drop or file picker)
2. Format detection and confirmation
3. Preview with duplicate detection
4. Review and confirm
5. Import and show results

## Database Inspection

Use a SQLite browser to inspect the database:

```bash
# macOS location
open ~/Library/Application\ Support/personal-finance/

# Use DB Browser for SQLite or similar tool
# Download: https://sqlitebrowser.org/
```

Useful queries:

```sql
-- Check seeded categories
SELECT * FROM categories;

-- Count transactions
SELECT COUNT(*) FROM transactions;

-- View accounts
SELECT * FROM accounts;

-- Check import history
SELECT * FROM import_history ORDER BY import_date DESC;
```

## Debugging Tips

### Enable Verbose SQL Logging

In `electron/db/index.ts`, the database is initialized with verbose logging in development:

```typescript
verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
```

All SQL queries will be logged to the console.

### Check IPC Communication

Open DevTools (automatically opens in dev mode) and check:
1. Console for errors
2. Network tab won't show IPC (it's internal)
3. Use `console.log` in your React components
4. Check main process output in terminal

### Inspect Database State

```typescript
// In React component (DevTools console)
const accounts = await window.electron.invoke('accounts:get-all');
console.log(accounts);
```

## Common Issues

### Issue: Native module error

```
The module 'better_sqlite3.node' was compiled against a different Node.js version
```

**Solution**:
```bash
npx electron-rebuild
```

### Issue: IPC channel not found

```
Error: Invalid IPC channel: xyz
```

**Solution**: Add the channel to the whitelist in `electron/preload.ts`

### Issue: Database locked

```
Error: database is locked
```

**Solution**: Close all connections, restart the app. SQLite uses WAL mode which should prevent this.

## Testing Data Import

Once you implement the CSV import (Phase 4):

```bash
# Your existing data
ls usaa-exports/

# Should show: fixed-2005.csv with ~2000 transactions
```

## Code Style Guide

- Use TypeScript strict mode (already configured)
- Use async/await instead of promises
- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic to hooks
- Use Tailwind utility classes
- Follow existing naming conventions

## Performance Tips

- Use React.memo for expensive components
- Implement virtual scrolling for long transaction lists (react-window)
- Debounce search inputs
- Use pagination for large datasets
- Optimize SQLite queries with EXPLAIN QUERY PLAN

## Building for Production

```bash
# Build the app
npm run build

# Output will be in release/ directory
# Installers for your OS will be created
```

## Next Major Milestones

1. **Complete Phase 3** - Full transaction management UI
2. **Complete Phase 4** - Import existing USAA data (~2000 transactions)
3. **Complete Phase 5** - Dashboard with charts showing real data
4. **Complete Phase 6** - Set up budgets for spending categories
5. **Complete Phase 7** - Track savings goals and recurring bills
6. **Complete Phase 8** - Polish, settings, and cross-platform testing

## Resources

- [Electron Docs](https://www.electronjs.org/docs/latest)
- [React Docs](https://react.dev)
- [Zustand Docs](https://zustand-demo.pmnd.rs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Better SQLite3 Docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- [Recharts Examples](https://recharts.org/en-US/examples)

## Questions?

If you get stuck:
1. Check the existing code for similar patterns
2. Review the type definitions in `src/types/index.ts`
3. Look at the database schema in `electron/db/schema.ts`
4. Check the implementation plan in `IMPLEMENTATION_STATUS.md`

Happy coding! 🚀
