// New BrowserView-based recording implementation
import { ipcMain, BrowserWindow, BrowserView } from 'electron';
import { getDatabase } from '../db';

let recordingWindow: BrowserWindow | null = null;
let recordingBrowserView: BrowserView | null = null;
let mainWindow: BrowserWindow | null = null;

// Current recording state
let currentRecording: {
  url: string;
  steps: any[];
  isRecording: boolean;
} | null = null;

// Simplified recorder script - NO UI filtering needed!
const getRecorderScript = () => `
(function() {
  const stateKey = Symbol.for('__rec__');
  if (window[stateKey]) return;
  window[stateKey] = { last: null };

  const state = window[stateKey];

  function getSelector(el) {
    if (!el || el.nodeType !== 1) return '';

    // For form elements, prefer semantic attributes
    if (el.matches?.('input,textarea,select')) {
      if (el.name) {
        const sel = el.tagName.toLowerCase() + '[name="' + CSS.escape(el.name) + '"]';
        if (document.querySelectorAll(sel).length === 1) return sel;
      }
      if (el.placeholder) return 'placeholder:' + el.placeholder;
      if (el.getAttribute?.('aria-label')) return 'aria-label:' + el.getAttribute('aria-label');
      if (el.id) {
        const lbl = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (lbl?.textContent) return 'label:' + lbl.textContent.trim();
      }
    }

    // Fallback: simple path
    const path = [];
    let curr = el;
    for (let i = 0; i < 3 && curr && curr.nodeType === 1; i++) {
      let part = curr.tagName.toLowerCase();
      if (curr.id) {
        part += '#' + CSS.escape(curr.id);
        path.unshift(part);
        break;
      }
      if (curr.className && typeof curr.className === 'string') {
        const cls = curr.className.trim().split(/\\s+/)[0];
        if (cls) part += '.' + CSS.escape(cls);
      }
      path.unshift(part);
      curr = curr.parentElement;
    }

    return path.join(' > ');
  }

  function capture(e) {
    try {
      const t = e.target;
      if (!t?.tagName) return;

      const tag = t.tagName;
      let type = null;
      let data = null;

      if (e.type === 'click' && (tag === 'BUTTON' || tag === 'A' || t.type === 'submit')) {
        type = 'click';
        data = { selector: getSelector(t), element: tag };
      } else if (e.type === 'input' && (tag === 'INPUT' || tag === 'TEXTAREA')) {
        type = 'input';
        const val = t.type === 'password' ? '[REDACTED]' : t.value;
        const sel = getSelector(t);

        if (state.last?.type === 'input' && state.last?.selector === sel &&
            Date.now() - state.last.timestamp < 800) return;

        data = {
          selector: sel,
          element: tag,
          value: val,
          fieldLabel: t.placeholder || t.name || t.getAttribute('aria-label') || ''
        };
      } else if (e.type === 'change' && tag === 'SELECT') {
        type = 'select';
        data = { selector: getSelector(t), element: tag, value: t.value };
      }

      if (type && data) {
        data.type = type;
        data.timestamp = Date.now();
        state.last = data;
        console.log('__INTERACTION__:' + JSON.stringify(data));
      }
    } catch (err) {}
  }

  const opts = { capture: true, passive: true };
  document.addEventListener('click', capture, opts);
  document.addEventListener('input', capture, opts);
  document.addEventListener('change', capture, opts);
})();
`;

export function createRecordingWindow(startUrl: string = 'https://www.google.com') {
  return new Promise<{ success: boolean }>((resolve) => {
    try {
      // Close existing window if any
      if (recordingWindow && !recordingWindow.isDestroyed()) {
        recordingWindow.close();
      }

      currentRecording = {
        url: startUrl,
        steps: [],
        isRecording: false
      };

      // Create main window with controls
      recordingWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'Export Recipe Recorder',
        backgroundColor: '#1f2937',
        webPreferences: {
          nodeIntegration: true, // Needed for controls to use IPC
          contextIsolation: false, // This is our own UI, not user content
        },
      });

      // Create controls HTML
      const controlsHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #1f2937;
      color: white;
      padding: 12px;
    }
    .controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .url-bar {
      display: flex;
      gap: 8px;
      flex: 1;
    }
    input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #4b5563;
      border-radius: 6px;
      background: #374151;
      color: white;
      font-size: 14px;
    }
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .nav-btn {
      padding: 8px 12px;
      background: #374151;
      color: white;
    }
    .nav-btn:hover { background: #4b5563; }
    .go-btn {
      background: #3b82f6;
      color: white;
    }
    .go-btn:hover { background: #2563eb; }
    .record-btn {
      background: #ef4444;
      color: white;
      min-width: 120px;
    }
    .record-btn.recording {
      background: #dc2626;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .status {
      padding: 4px 12px;
      background: #374151;
      border-radius: 6px;
      font-size: 12px;
      color: #9ca3af;
    }
    .status.recording {
      background: #7f1d1d;
      color: #fca5a5;
    }
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-overlay.show {
      display: flex;
    }
    .modal {
      background: #1f2937;
      border: 1px solid #4b5563;
      border-radius: 8px;
      padding: 24px;
      width: 400px;
      max-width: 90%;
    }
    .modal h2 {
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
    }
    .modal label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      color: #9ca3af;
    }
    .modal input {
      width: 100%;
      margin-bottom: 16px;
    }
    .modal-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .modal-actions button {
      min-width: 80px;
    }
    .cancel-btn {
      background: #374151;
      color: white;
    }
    .cancel-btn:hover {
      background: #4b5563;
    }
    .save-btn {
      background: #3b82f6;
      color: white;
    }
    .save-btn:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="controls">
    <div class="url-bar">
      <button class="nav-btn" onclick="goBack()">◄</button>
      <button class="nav-btn" onclick="goForward()">►</button>
      <button class="nav-btn" onclick="reload()">↻</button>
      <input type="text" id="url-input" placeholder="Enter URL..." value="${startUrl}">
      <button class="go-btn" onclick="navigate()">Go</button>
    </div>
    <div class="status" id="status">Ready</div>
    <button class="record-btn" id="record-btn" onclick="toggleRecording()">Start Recording</button>
  </div>

  <div class="modal-overlay" id="save-modal">
    <div class="modal">
      <h2>Save Recording</h2>
      <label>Recording Name *</label>
      <input type="text" id="recording-name" placeholder="e.g., Download USAA Transactions">
      <label>Institution (Optional)</label>
      <input type="text" id="recording-institution" placeholder="e.g., USAA, Chase">
      <div class="modal-actions">
        <button class="cancel-btn" onclick="cancelSave()">Cancel</button>
        <button class="save-btn" onclick="confirmSave()">Save</button>
      </div>
    </div>
  </div>

  <script>
    const { ipcRenderer } = require('electron');

    function navigate() {
      const url = document.getElementById('url-input').value;
      ipcRenderer.send('recording:navigate', url);
    }

    function goBack() {
      ipcRenderer.send('recording:back');
    }

    function goForward() {
      ipcRenderer.send('recording:forward');
    }

    function reload() {
      ipcRenderer.send('recording:reload');
    }

    function toggleRecording() {
      const isRecording = document.getElementById('record-btn').classList.contains('recording');
      if (isRecording) {
        // Hide browser view and show save modal
        ipcRenderer.send('recording:show-save-dialog');
        document.getElementById('save-modal').classList.add('show');
        document.getElementById('recording-name').focus();
      } else {
        // Start recording
        ipcRenderer.send('recording:toggle');
      }
    }

    function cancelSave() {
      document.getElementById('save-modal').classList.remove('show');
      document.getElementById('recording-name').value = '';
      document.getElementById('recording-institution').value = '';
      // Show browser view again
      ipcRenderer.send('recording:hide-save-dialog');
    }

    function confirmSave() {
      const name = document.getElementById('recording-name').value.trim();
      const institution = document.getElementById('recording-institution').value.trim();

      if (!name) {
        alert('Please enter a recording name');
        return;
      }

      ipcRenderer.send('recording:save', { name, institution });
      document.getElementById('save-modal').classList.remove('show');
    }

    // Listen for URL changes
    ipcRenderer.on('recording:url-changed', (_, url) => {
      document.getElementById('url-input').value = url;
    });

    // Listen for recording state changes
    ipcRenderer.on('recording:state-changed', (_, isRecording) => {
      const btn = document.getElementById('record-btn');
      const status = document.getElementById('status');

      if (isRecording) {
        btn.textContent = 'Stop & Save';
        btn.classList.add('recording');
        status.textContent = 'Recording...';
        status.classList.add('recording');
      } else {
        btn.textContent = 'Start Recording';
        btn.classList.remove('recording');
        status.textContent = 'Ready';
        status.classList.remove('recording');
      }
    });

    // Enter key to navigate
    document.getElementById('url-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') navigate();
    });

    // Enter key in save modal to confirm
    document.getElementById('recording-name').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') confirmSave();
    });
    document.getElementById('recording-institution').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') confirmSave();
    });
  </script>
</body>
</html>
      `;

      // Load controls HTML
      recordingWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(controlsHTML)}`);

      // Create BrowserView for the website
      recordingBrowserView = new BrowserView({
        webPreferences: {
          partition: 'persist:recorder',
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          webSecurity: true,
        },
      });

      // Set realistic user agent
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      recordingBrowserView.webContents.setUserAgent(userAgent);

      // Attach BrowserView
      recordingWindow.addBrowserView(recordingBrowserView);

      // Position BrowserView below controls (50px for control bar)
      const updateBounds = () => {
        if (recordingBrowserView && !recordingBrowserView.webContents.isDestroyed()) {
          const bounds = recordingWindow!.getContentBounds();
          recordingBrowserView.setBounds({
            x: 0,
            y: 50,
            width: bounds.width,
            height: bounds.height - 50,
          });
        }
      };

      updateBounds();
      recordingWindow.on('resize', updateBounds);

      // Load initial URL in BrowserView
      recordingBrowserView.webContents.loadURL(startUrl);

      // Handle URL changes
      recordingBrowserView.webContents.on('did-navigate', (_, url) => {
        recordingWindow!.webContents.send('recording:url-changed', url);
      });

      recordingBrowserView.webContents.on('did-navigate-in-page', (_, url) => {
        recordingWindow!.webContents.send('recording:url-changed', url);
      });

      // Listen for interactions from BrowserView
      recordingBrowserView.webContents.on('console-message', (_, level, message) => {
        if (message.startsWith('__INTERACTION__:')) {
          try {
            const interaction = JSON.parse(message.substring(16));
            if (currentRecording && currentRecording.isRecording) {
              currentRecording.steps.push(interaction);
              console.log('[Recorder] Captured:', interaction.type, interaction.selector);
            }
          } catch (e) {}
        }
      });

      // Handle navigation events in BrowserView
      recordingBrowserView.webContents.on('did-finish-load', async () => {
        const url = recordingBrowserView!.webContents.getURL();
        if (url.startsWith('http://') || url.startsWith('https://')) {
          // Re-inject recorder script if recording
          if (currentRecording && currentRecording.isRecording) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              await recordingBrowserView!.webContents.executeJavaScript(getRecorderScript());
              console.log('[Recorder] Script injected after navigation:', url);
            } catch (error) {
              console.error('[Recorder] Failed to inject script:', error);
            }
          }
        }
      });

      // Clean up on close
      recordingWindow.on('closed', () => {
        if (recordingBrowserView && !recordingBrowserView.webContents.isDestroyed()) {
          (recordingBrowserView.webContents as any).destroy();
        }
        recordingWindow = null;
        recordingBrowserView = null;
        currentRecording = null;
      });

      resolve({ success: true });
    } catch (error) {
      console.error('[Recorder] Failed to create window:', error);
      resolve({ success: false });
    }
  });
}

export function setMainWindow(window: BrowserWindow) {
  mainWindow = window;
}

export function registerRecordingHandlers() {
  // Start recording
  ipcMain.handle('automation:start-recording', async (_, startUrl?: string) => {
    return createRecordingWindow(startUrl);
  });

  // Navigation from controls
  ipcMain.on('recording:navigate', (_, url) => {
    if (recordingBrowserView && !recordingBrowserView.webContents.isDestroyed()) {
      let finalUrl = url.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
      }
      recordingBrowserView.webContents.loadURL(finalUrl);
    }
  });

  ipcMain.on('recording:back', () => {
    if (recordingBrowserView?.webContents.canGoBack()) {
      recordingBrowserView.webContents.goBack();
    }
  });

  ipcMain.on('recording:forward', () => {
    if (recordingBrowserView?.webContents.canGoForward()) {
      recordingBrowserView.webContents.goForward();
    }
  });

  ipcMain.on('recording:reload', () => {
    recordingBrowserView?.webContents.reload();
  });

  // Toggle recording
  ipcMain.on('recording:toggle', async () => {
    if (!currentRecording) return;

    // Start recording
    currentRecording.isRecording = true;
    currentRecording.url = recordingBrowserView!.webContents.getURL();
    currentRecording.steps = [];

    // Inject recorder script
    try {
      await recordingBrowserView!.webContents.executeJavaScript(getRecorderScript());
      console.log('[Recorder] Recording started');
    } catch (error) {
      console.error('[Recorder] Failed to start recording:', error);
    }

    // Update UI
    recordingWindow!.webContents.send('recording:state-changed', true);
  });

  // Show save dialog (hide BrowserView)
  ipcMain.on('recording:show-save-dialog', () => {
    if (recordingBrowserView && !recordingBrowserView.webContents.isDestroyed()) {
      // Move BrowserView off-screen
      recordingBrowserView.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
    }
  });

  // Hide save dialog (show BrowserView)
  ipcMain.on('recording:hide-save-dialog', () => {
    if (recordingBrowserView && !recordingBrowserView.webContents.isDestroyed() && recordingWindow) {
      // Restore BrowserView position
      const bounds = recordingWindow.getContentBounds();
      recordingBrowserView.setBounds({
        x: 0,
        y: 50,
        width: bounds.width,
        height: bounds.height - 50,
      });
    }
  });

  // Save recording
  ipcMain.on('recording:save', (_, data: { name: string; institution: string }) => {
    if (!currentRecording || currentRecording.steps.length === 0) {
      console.log('[Recorder] No steps to save');
      recordingWindow?.close();
      return;
    }

    try {
      const db = getDatabase();
      const stepsJson = JSON.stringify(currentRecording.steps);
      const result = db.prepare(
        `INSERT INTO export_recipes (name, institution, url, steps)
         VALUES (?, ?, ?, ?)`
      ).run(data.name, data.institution || null, currentRecording.url, stepsJson);

      console.log('[Recorder] Saved recording:', result.lastInsertRowid, 'with', currentRecording.steps.length, 'steps');

      // Notify main window
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('automation:recording-saved');
      }

      // Close recording window
      recordingWindow?.close();
    } catch (error) {
      console.error('[Recorder] Failed to save recording:', error);
    }
  });
}
