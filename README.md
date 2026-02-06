# Personal Finance Desktop App

A modern Electron desktop application for managing family finances, built with React, TypeScript, and SQLite.

## Project Status

**Phase 1 & 2 Complete: Foundation & Database ✓**

- ✅ Project structure created
- ✅ All dependencies installed and configured
- ✅ TypeScript configuration for both main and renderer processes
- ✅ Vite + Electron + React development environment working
- ✅ Tailwind CSS configured and ready
- ✅ SQLite database schema implemented
- ✅ Type-safe IPC communication established
- ✅ Basic UI with routing and layout
- ✅ Transaction and account management foundation

## Tech Stack

- **Desktop Framework**: Electron 33
- **Frontend**: React 18 + Vite 6
- **Styling**: Tailwind CSS 3
- **Database**: Better-SQLite3 (synchronous, fast)
- **State Management**: Zustand (ready to implement)
- **Routing**: React Router v6 (HashRouter)
- **Charts**: Recharts (ready for analytics)
- **CSV Parsing**: PapaParse (ready for imports)
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Database Schema

The app includes a comprehensive SQLite database with the following tables:

### Core Tables
- **accounts** - Bank accounts and credit cards
- **categories** - Hierarchical expense/income categories (18 default categories seeded)
- **transactions** - All financial transactions with duplicate detection
- **budgets** - Monthly category budgets
- **goals** - Savings goals with progress tracking
- **goal_contributions** - Individual contributions to goals
- **bills** - Recurring bills with reminders
- **bill_payments** - Payment history for bills
- **import_history** - CSV import tracking
- **settings** - App configuration
- **sync_metadata** - Future multi-device sync support

### Features
- Foreign key constraints with proper cascades
- Comprehensive indexes for performance
- Unique constraints for duplicate prevention
- Automatic timestamps with update triggers
- 18 pre-seeded categories (Income, Paycheck, Housing, Groceries, etc.)

## Project Structure

```
personal-finance/
├── electron/                    # Main process (Node.js)
│   ├── main.ts                 # Electron entry point ✓
│   ├── preload.ts              # IPC bridge (contextBridge) ✓
│   ├── db/
│   │   ├── index.ts            # SQLite connection manager ✓
│   │   ├── schema.ts           # Database schema initialization ✓
│   │   └── queries/
│   │       ├── accounts.ts     # Account CRUD ✓
│   │       └── transactions.ts # Transaction CRUD ✓
│   ├── ipc/
│   │   ├── accounts.ts         # Account IPC handlers ✓
│   │   └── transactions.ts     # Transaction IPC handlers ✓
│   └── services/               # CSV import services (Phase 4)
├── src/                        # Renderer process (React)
│   ├── types/
│   │   └── index.ts            # Complete TypeScript types ✓
│   ├── components/
│   │   └── layout/
│   │       ├── Layout.tsx      # Main layout ✓
│   │       └── Sidebar.tsx     # Navigation sidebar ✓
│   ├── pages/
│   │   ├── Dashboard.tsx       # Dashboard page (placeholder) ✓
│   │   └── Transactions.tsx    # Transactions list with IPC demo ✓
│   ├── App.tsx                 # Router setup ✓
│   ├── main.tsx                # React entry point ✓
│   └── index.css               # Tailwind styles ✓
├── usaa-exports/               # Existing transaction data
├── package.json                # Dependencies & scripts ✓
├── tsconfig.json               # TypeScript config ✓
├── vite.config.ts              # Vite + Electron config ✓
└── tailwind.config.js          # Tailwind config ✓
```

## Getting Started

### Prerequisites
- Node.js 18+ (with npm)
- macOS, Windows, or Linux

### Installation

```bash
# Install dependencies (includes automatic native module rebuild)
npm install

# Start development server
npm run dev
```

The app will launch in a new Electron window with:
- Vite dev server at http://localhost:5173
- Hot module replacement for instant updates
- DevTools open for debugging
- Database at: `~/Library/Application Support/personal-finance/finance.db` (macOS)

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

## Type-Safe IPC Communication

All communication between the React frontend and Electron backend is type-safe:

```typescript
// In React components
const transactions = await window.electron.invoke('transactions:get-all', {
  limit: 50,
  start_date: '2025-01-01'
});

const account = await window.electron.invoke('accounts:create', {
  name: 'USAA Checking',
  type: 'checking',
  institution: 'USAA',
  balance: 0,
  currency: 'USD',
  is_active: true
});
```

All IPC channels and their types are defined in `src/types/index.ts`.

## Current Features

✅ **Database Layer**
- Complete schema with all tables
- CRUD operations for transactions and accounts
- Duplicate detection for transactions
- Automatic timestamp updates
- Seeded default categories

✅ **IPC Communication**
- Type-safe IPC bridge via contextBridge
- Transaction handlers (get, create, update, delete, bulk)
- Account handlers (get, create, update, delete)
- Secure channel whitelisting

✅ **UI Foundation**
- Responsive layout with sidebar navigation
- React Router with HashRouter
- Dashboard page (placeholder)
- Transactions page with live IPC demo
- Tailwind CSS styling with custom theme

## Next Steps (Phase 3)

The next phase will implement:

1. **Zustand Store** - State management for app data
2. **Transaction Management** - Full CRUD UI with filters
3. **Account Management** - Account selector and management
4. **Custom Hooks** - useTransactions, useAccounts
5. **Better UI Components** - Tables, forms, modals

## Database Location

The SQLite database is stored in the OS-specific app data directory:
- **macOS**: `~/Library/Application Support/personal-finance/finance.db`
- **Windows**: `%APPDATA%/personal-finance/finance.db`
- **Linux**: `~/.config/personal-finance/finance.db`

You can inspect the database using any SQLite browser tool.

## Development Notes

### Native Module Rebuilding
The app uses `better-sqlite3`, which requires native compilation. The `postinstall` script automatically rebuilds native modules for Electron after `npm install`.

If you encounter module loading errors, manually rebuild:
```bash
npx electron-rebuild
```

### ESM vs CommonJS
This project uses ES modules. The main process uses ESM-compatible imports and `fileURLToPath` for `__dirname` equivalent.

### Hot Reload
Vite provides instant hot module replacement for React components. Changes to Electron main process require a restart (automatically handled by vite-plugin-electron).

## Architecture Highlights

- **Context Isolation**: Renderer process has no direct access to Node.js APIs
- **Type Safety**: Full TypeScript coverage across main/renderer boundary
- **Performance**: Indexed queries, WAL mode, connection pooling
- **Security**: IPC channel whitelisting, input validation
- **Extensibility**: Ready for CSV import, budgets, goals, bills, analytics

## License

MIT

## Author

Tom
