# Troubleshooting Guide

## Electron API Not Available Error

If you see `Cannot read properties of undefined (reading 'invoke')`, this means `window.electron` is undefined.

### Quick Diagnostic Steps

1. **Start the app:**
   ```bash
   npm run dev
   ```

2. **Open DevTools** (should open automatically in dev mode)
   - On macOS: View → Toggle Developer Tools
   - Or press Cmd+Option+I

3. **Check the Console tab in DevTools** for:
   - ✅ "Preload script loaded successfully" - means preload worked
   - Check if `window.electron` is available:
     ```javascript
     console.log(window.electron)
     ```

4. **Navigate to the Test page:**
   - Click on the URL bar in the app
   - Go to: `/#/test`
   - This page will show you the API status

### Common Issues & Solutions

#### Issue 1: Preload script not found

**Symptoms:**
```
Error: Cannot find module '/path/to/preload.js'
```

**Solution:**
```bash
# Clean build
rm -rf dist-electron/
npm run dev
```

#### Issue 2: Native module error

**Symptoms:**
```
was compiled against a different Node.js version
```

**Solution:**
```bash
npx electron-rebuild
```

#### Issue 3: window.electron is undefined

**Possible Causes:**
1. Preload script didn't load
2. Context isolation issue
3. Sandbox mode blocking preload

**Debug Steps:**
1. Check DevTools console for "Preload script loaded successfully"
2. Verify preload.js exists in dist-electron/
3. Check main.ts has correct preload path

**Manual Test in DevTools Console:**
```javascript
// Should return an object with invoke method
window.electron

// Should return 'object'
typeof window.electron

// Should return 'function'
typeof window.electron.invoke
```

### Verification Checklist

Run these checks to verify everything is working:

1. **Files exist:**
   ```bash
   ls dist-electron/preload.js    # Should exist
   ls dist-electron/main.js       # Should exist
   ```

2. **Database initialized:**
   ```bash
   ls ~/Library/Application\ Support/personal-finance/finance.db
   ```

3. **Terminal output shows:**
   - "Database schema initialized successfully"
   - "Transaction IPC handlers registered"
   - "Account IPC handlers registered"
   - "Main window created"
   - "App initialized successfully"

4. **DevTools console shows:**
   - "Preload script loaded successfully"
   - No errors about missing modules

5. **Test API in DevTools console:**
   ```javascript
   // Should work without errors
   window.electron.invoke('accounts:get-all')
     .then(accounts => console.log('Accounts:', accounts))
     .catch(err => console.error('Error:', err));
   ```

### Still Having Issues?

1. **Clean everything and rebuild:**
   ```bash
   rm -rf node_modules/ dist/ dist-electron/
   npm install
   npm run dev
   ```

2. **Check Node.js version:**
   ```bash
   node --version  # Should be 18+
   ```

3. **Check Electron version:**
   ```bash
   npx electron --version  # Should be 33.x
   ```

4. **Enable verbose logging:**

   In `electron/db/index.ts`, the database already logs all SQL in development.

   Add more logging in `electron/preload.ts`:
   ```typescript
   console.log('Preload script starting...');
   console.log('contextBridge available:', !!contextBridge);
   console.log('ipcRenderer available:', !!ipcRenderer);
   // ... rest of code
   console.log('API exposed to window.electron');
   ```

### Working Configuration

Your app should have:

**electron/main.ts:**
```typescript
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
}
```

**vite.config.ts:**
```typescript
preload: {
  input: 'electron/preload.ts',
  vite: {
    build: {
      outDir: 'dist-electron',
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'preload.js'
        }
      }
    }
  }
}
```

### Expected Behavior

When everything is working:
1. App launches in new window
2. DevTools opens automatically (dev mode)
3. Console shows "Preload script loaded successfully"
4. `window.electron.invoke` is available
5. Transactions page loads without errors (even if empty)
6. Test page at `/#/test` shows API is available

### Getting Help

If you're still stuck:
1. Check the full terminal output for errors
2. Check DevTools console for errors
3. Verify all files in IMPLEMENTATION_STATUS.md exist
4. Review the commit history if using git
