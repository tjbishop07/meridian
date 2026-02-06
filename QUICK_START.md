# Quick Start Guide

## First Time Setup ✅ COMPLETE

You've already completed the initial setup! The app is ready to run.

## Starting the App

```bash
cd /Users/tom/development/personal-finance
npm run dev
```

This will:
1. Start the Vite development server
2. Compile Electron main and preload scripts
3. Launch the app in a new Electron window
4. Open DevTools for debugging

## Verifying Everything Works

### Step 1: Check Terminal Output

You should see:
```
✓ built in XXXms
Database schema initialized successfully
Transaction IPC handlers registered
Account IPC handlers registered
Main window created
App initialized successfully
```

### Step 2: Check the App Window

The Electron window should open showing:
- Sidebar with navigation (Dashboard, Transactions, Import, etc.)
- Dashboard page with welcome message
- DevTools panel open on the right

### Step 3: Check DevTools Console

In the DevTools Console tab, you should see:
```
Preload script loaded successfully
```

And you can test the API:
```javascript
window.electron.invoke('accounts:get-all')
```

This should return an empty array `[]` (no accounts created yet).

### Step 4: Test the Transactions Page

1. Click "Transactions" in the sidebar
2. You should see "No transactions yet" message
3. Check DevTools console - should show:
   ```
   Electron API available: {invoke: ƒ}
   ```

## Creating Your First Account

Open DevTools console and run:

```javascript
window.electron.invoke('accounts:create', {
  name: 'USAA Checking',
  type: 'checking',
  institution: 'USAA',
  balance: 0,
  currency: 'USD',
  is_active: true
}).then(account => {
  console.log('Account created:', account);
});
```

## Creating a Test Transaction

After creating an account (let's say it has ID 1):

```javascript
window.electron.invoke('transactions:create', {
  account_id: 1,
  date: '2025-12-31',
  description: 'Test Transaction',
  amount: 50.00,
  type: 'expense',
  status: 'cleared'
}).then(transaction => {
  console.log('Transaction created:', transaction);
});
```

Then refresh the Transactions page to see your new transaction!

## Checking the Database

The database is stored at:
```
~/Library/Application Support/personal-finance/finance.db
```

You can open it with DB Browser for SQLite or any SQLite client to inspect the data.

## What's Already Working

✅ **Foundation**
- Electron + React + Vite development environment
- TypeScript compilation
- Tailwind CSS styling
- Hot module replacement

✅ **Database**
- SQLite with 11 tables
- 18 pre-seeded categories
- All indexes and constraints
- Transaction duplicate detection

✅ **IPC Communication**
- Type-safe API via contextBridge
- Transaction CRUD operations
- Account CRUD operations
- Secure channel whitelisting

✅ **UI**
- Sidebar navigation
- Dashboard page
- Transactions page with live data loading
- Responsive layout

## Common Commands

```bash
# Start development server
npm run dev

# Stop the app
# Press Ctrl+C in terminal or close the Electron window

# Rebuild native modules (if needed)
npx electron-rebuild

# Clean build
rm -rf dist-electron/ && npm run dev

# View database location
echo ~/Library/Application\ Support/personal-finance/finance.db
```

## Keyboard Shortcuts in the App

- **Cmd+Option+I** (macOS) / **Ctrl+Shift+I** (Windows/Linux): Toggle DevTools
- **Cmd+R** (macOS) / **Ctrl+R** (Windows/Linux): Reload app
- **Cmd+Q** (macOS) / **Alt+F4** (Windows/Linux): Quit app

## Next Steps

Once you've verified everything works:

1. **Read DEVELOPMENT_GUIDE.md** for detailed implementation instructions
2. **Check IMPLEMENTATION_STATUS.md** to see what's complete
3. **Review TROUBLESHOOTING.md** if you encounter any issues

### Recommended Development Order:

1. Complete Phase 3: Transaction Management UI
   - Build Zustand store
   - Create transaction forms
   - Add filters and search

2. Phase 4: CSV Import
   - Import your 1,985 transactions from usaa-exports/
   - Build import wizard UI

3. Phase 5: Dashboard & Analytics
   - Monthly summaries
   - Charts and graphs

4. Phases 6-8: Budgets, Goals, Bills, Settings

## Getting Help

- **Terminal errors**: Check the terminal where you ran `npm run dev`
- **App errors**: Check DevTools Console in the Electron window
- **IPC errors**: See TROUBLESHOOTING.md
- **Database issues**: Check DEVELOPMENT_GUIDE.md

## Success Checklist

- [ ] App launches without errors
- [ ] DevTools shows "Preload script loaded successfully"
- [ ] `window.electron.invoke` is available in console
- [ ] Can create an account via DevTools
- [ ] Can create a transaction via DevTools
- [ ] Transactions page shows the new transaction

If all checks pass, you're ready to build! 🚀

## Project Structure Quick Reference

```
personal-finance/
├── electron/           # Main process (Node.js)
│   ├── main.ts        # App entry point
│   ├── preload.ts     # IPC bridge
│   ├── db/            # Database layer
│   └── ipc/           # IPC handlers
├── src/               # Renderer process (React)
│   ├── pages/         # Page components
│   ├── components/    # UI components
│   └── types/         # TypeScript types
├── dist-electron/     # Compiled Electron code (gitignored)
└── dist/              # Compiled React code (gitignored)
```

Happy coding! 🎉
