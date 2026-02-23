// New BrowserView-based recording implementation
import { ipcMain, BrowserWindow, BrowserView } from 'electron';
import { getDatabase } from '../db';
let recordingWindow = null;
let recordingBrowserView = null;
let mainWindow = null;
// Current recording state
let currentRecording = null;
// Re-injection interval
let reinjectionInterval = null;
// Simplified recorder script - NO UI filtering needed!
const getRecorderScript = () => `
(function() {
  const stateKey = Symbol.for('__rec__');
  if (window[stateKey]) return;
  window[stateKey] = { last: null };

  const state = window[stateKey];

  // Timer for debounced input emission
  let inputTimers = {};

  function getSelector(el) {
    if (!el || el.nodeType !== 1) return '';

    // Helper to check if ID looks dynamic (long hex, UUIDs, etc.)
    function isDynamicId(id) {
      if (!id) return false;
      // Check for long hex strings, UUIDs, timestamps, etc.
      return /^[0-9a-f]{20,}/.test(id) || // Long hex
             /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/.test(id) || // UUID-like
             /^[0-9]{10,}/.test(id); // Timestamp-like
    }

    // For clickable elements (buttons, links), prefer text-based selectors
    if (el.matches?.('button,a') || el.getAttribute?.('role') === 'button') {
      const text = el.textContent?.trim();
      if (text && text.length > 0 && text.length < 100) {
        // Try to find the most meaningful class - check this element first
        let bestClass = null;

        if (el.className && typeof el.className === 'string') {
          const classes = el.className.trim().split(/\\s+/).filter(c => c && !c.startsWith('rds-') && !c.includes('layout'));
          bestClass = classes.find(c => c.includes('button') || c.includes('link') || c.includes('btn') || c.includes('product') || c.includes('name')) || classes[0];
        }

        // If no good class on the link, look for a meaningful class in children that contain the text
        if (!bestClass || bestClass.length > 50) {
          const textNodes = [];
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT, null);
          let node;
          while (node = walker.nextNode()) {
            if (node.textContent?.trim() === text && node.className && typeof node.className === 'string') {
              const childClasses = node.className.trim().split(/\\s+/).filter(c => c && !c.startsWith('rds-') && !c.includes('layout') && !c.includes('wrapper'));
              const meaningfulClass = childClasses.find(c => c.includes('name') || c.includes('label') || c.includes('text') || c.includes('product'));
              if (meaningfulClass && meaningfulClass.length < 50) {
                bestClass = meaningfulClass;
                break;
              }
            }
          }
        }

        if (bestClass) {
          return 'text:' + bestClass + ':' + text;
        }

        // Fallback to tag with text
        return 'text:' + el.tagName.toLowerCase() + ':' + text;
      }
    }

    // For form elements, prefer semantic attributes
    if (el.matches?.('input,textarea,select')) {
      if (el.name) {
        const sel = el.tagName.toLowerCase() + '[name="' + CSS.escape(el.name) + '"]';
        if (document.querySelectorAll(sel).length === 1) return sel;
      }
      if (el.placeholder) return 'placeholder:' + el.placeholder;
      if (el.getAttribute?.('aria-label')) return 'aria-label:' + el.getAttribute('aria-label');
      if (el.id && !isDynamicId(el.id)) {
        const lbl = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (lbl?.textContent) return 'label:' + lbl.textContent.trim();
      }
    }

    // Try to find a unique class-based selector (avoiding dynamic IDs)
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\\s+/);
      // Try each class to see if it's unique
      for (const cls of classes) {
        const sel = '.' + CSS.escape(cls);
        if (document.querySelectorAll(sel).length === 1) {
          return sel;
        }
      }
    }

    // Fallback: simple path (skip dynamic IDs)
    const path = [];
    let curr = el;
    for (let i = 0; i < 3 && curr && curr.nodeType === 1; i++) {
      let part = curr.tagName.toLowerCase();
      if (curr.id && !isDynamicId(curr.id)) {
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

      let type = null;
      let data = null;

      if (e.type === 'click') {
        // Find the actual clickable element (might be a parent of what was clicked)
        let clickTarget = t;

        // Check if clicked element or any parent (up to 5 levels) is clickable
        for (let i = 0; i < 5 && clickTarget; i++) {
          const tag = clickTarget.tagName;
          const isClickable = tag === 'BUTTON' ||
                             tag === 'A' ||
                             clickTarget.type === 'submit' ||
                             clickTarget.getAttribute?.('role') === 'button';

          if (isClickable) {
            type = 'click';
            data = { selector: getSelector(clickTarget), element: tag };
            break;
          }

          clickTarget = clickTarget.parentElement;
        }

        // If no clickable parent found, just record the direct target
        if (!data && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.type === 'submit')) {
          type = 'click';
          data = { selector: getSelector(t), element: t.tagName };
        }
      } else if (e.type === 'input' && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
        // For input events, just track the value - don't emit yet
        // Wait for the change/blur event to capture the final value
        return;
      } else if (e.type === 'change' || e.type === 'blur') {
        if (t.tagName === 'SELECT') {
          type = 'select';
          data = { selector: getSelector(t), element: t.tagName, value: t.value };
        } else if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') {
          // Change event = final value when field loses focus
          const sel = getSelector(t);

          // Clear any pending timer for this field
          if (inputTimers[sel]) {
            clearTimeout(inputTimers[sel]);
            delete inputTimers[sel];
          }

          const isSensitive = t.type === 'password' ||
                             t.autocomplete === 'current-password' ||
                             t.autocomplete === 'new-password' ||
                             t.name?.toLowerCase().includes('pin') ||
                             t.name?.toLowerCase().includes('password') ||
                             t.placeholder?.toLowerCase().includes('pin') ||
                             t.placeholder?.toLowerCase().includes('password');

          // Skip if we just recorded this exact value via timer or previous change
          if (state.last?.type === 'input' &&
              state.last?.selector === sel &&
              state.last?.value === t.value &&
              Date.now() - state.last.timestamp < 2000) return;

          type = 'input';
          data = {
            selector: sel,
            element: t.tagName,
            value: t.value,
            isSensitive: isSensitive,
            fieldLabel: t.placeholder || t.name || t.getAttribute('aria-label') || ''
          };
        }
      }

      if (type && data) {
        data.type = type;
        data.timestamp = Date.now();

        // For clicks, use the actual clickable element (not a child element)
        // If we clicked on a SPAN inside a BUTTON or A, use the parent
        let identificationTarget = t;
        if (type === 'click') {
          // Walk up to find the actual clickable parent
          let current = t;
          for (let i = 0; i < 5 && current; i++) {
            const tag = current.tagName;
            const isClickable = tag === 'BUTTON' ||
                               tag === 'A' ||
                               current.type === 'submit' ||
                               current.getAttribute?.('role') === 'button' ||
                               current.getAttribute?.('role') === 'link';

            if (isClickable) {
              identificationTarget = current;
              break;
            }
            current = current.parentElement;
          }
        }

        // Capture rich identification data for text-based playback
        const target = identificationTarget;
        const rect = target.getBoundingClientRect();

        // Get text content (cleaned)
        let text = target.textContent?.trim() || '';
        if (text.length > 100) text = text.substring(0, 100);

        // Get ARIA attributes
        const ariaLabel = target.getAttribute('aria-label') ||
                         (target.getAttribute('aria-labelledby') &&
                          document.getElementById(target.getAttribute('aria-labelledby'))?.textContent?.trim());

        // Get other attributes
        const placeholder = target.getAttribute('placeholder');
        const title = target.getAttribute('title');
        const role = target.getAttribute('role') || target.tagName.toLowerCase();

        // Find nearby labels
        const nearbyLabels = [];
        const labels = document.querySelectorAll('label');
        for (const label of labels) {
          const labelRect = label.getBoundingClientRect();
          const distance = Math.abs(labelRect.top - rect.top) + Math.abs(labelRect.left - rect.left);
          if (distance < 200) {
            nearbyLabels.push(label.textContent?.trim());
          }
        }

        // Also check for label associated by 'for' attribute
        if (target.id) {
          const associatedLabel = document.querySelector(\`label[for="\${target.id}"]\`);
          if (associatedLabel) {
            nearbyLabels.push(associatedLabel.textContent?.trim());
          }
        }

        // Capture href for links (helps validate navigation)
        const href = target.tagName === 'A' ? target.getAttribute('href') : null;

        // Get parent context for better matching
        const parent = target.parentElement;
        const parentRole = parent?.getAttribute('role') || parent?.tagName.toLowerCase();
        const parentClass = parent?.className && typeof parent.className === 'string'
          ? parent.className.split(/\\s+/).filter(c => c && c.length < 30)[0]
          : null;

        // Capture visual properties for validation
        const isVisible = rect.width > 0 && rect.height > 0 &&
                         window.getComputedStyle(target).visibility !== 'hidden' &&
                         window.getComputedStyle(target).display !== 'none';

        // Add identification data
        data.identification = {
          text,
          ariaLabel,
          placeholder,
          title,
          role,
          nearbyLabels: nearbyLabels.filter(l => l && l.length > 0),
          href: href, // Link destination for validation
          parentRole: parentRole, // Parent context
          parentClass: parentClass, // Parent class for structural matching
          isVisible: isVisible, // Visual state
          elementSize: {
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          coordinates: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            elementX: rect.left + rect.width / 2,
            elementY: rect.top + rect.height / 2
          },
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            scrollX: window.scrollX,
            scrollY: window.scrollY
          }
        };

        state.last = data;

        // Log actual value for debugging
        console.log('__INTERACTION__:' + JSON.stringify(data));

        // Show visual feedback for sensitive inputs
        if (data.isSensitive) {
          const indicator = document.createElement('div');
          indicator.textContent = '🔒 Saved: ' + data.value.length + ' chars';
          indicator.style.cssText = 'position:fixed;top:10px;right:10px;background:#10b981;color:white;padding:8px 16px;border-radius:6px;font-size:14px;font-weight:500;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
          document.body.appendChild(indicator);
          setTimeout(() => indicator.remove(), 1500);
        }
      }
    } catch (err) {}
  }

  const opts = { capture: true, passive: true };
  document.addEventListener('click', capture, opts);
  document.addEventListener('input', capture, opts);
  document.addEventListener('change', capture, opts);
  document.addEventListener('blur', capture, opts);
})();
`;
export function createRecordingWindow(startUrl = 'https://www.google.com', accountId = null) {
    return new Promise((resolve) => {
        try {
            // Close existing window if any
            if (recordingWindow && !recordingWindow.isDestroyed()) {
                recordingWindow.close();
            }
            currentRecording = {
                url: startUrl,
                steps: [],
                isRecording: false,
                accountId: accountId
            };
            // Create main window with controls
            recordingWindow = new BrowserWindow({
                width: 1400,
                height: 900,
                title: 'Export Recipe Recorder',
                backgroundColor: '#1f2937',
                webPreferences: {
                    nodeIntegration: true,
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
                    const bounds = recordingWindow.getContentBounds();
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
                recordingWindow.webContents.send('recording:url-changed', url);
            });
            recordingBrowserView.webContents.on('did-navigate-in-page', (_, url) => {
                recordingWindow.webContents.send('recording:url-changed', url);
            });
            // Listen for interactions from BrowserView
            recordingBrowserView.webContents.on('console-message', (_, level, message) => {
                // Log all [RECORDER] debug messages
                if (message.startsWith('[RECORDER]')) {
                    console.log(message);
                }
                if (message.startsWith('__INTERACTION__:')) {
                    try {
                        const interaction = JSON.parse(message.substring(16));
                        if (currentRecording && currentRecording.isRecording) {
                            currentRecording.steps.push(interaction);
                            console.log('[Recorder] Captured:', interaction.type, interaction.selector);
                        }
                    }
                    catch (e) { }
                }
            });
            // Helper function to inject recorder script
            const injectRecorderScript = async (eventName) => {
                console.log(`[Recorder] ${eventName} event fired`);
                if (!recordingBrowserView || recordingBrowserView.webContents.isDestroyed()) {
                    console.log('[Recorder] BrowserView is destroyed, skipping injection');
                    return;
                }
                const url = recordingBrowserView.webContents.getURL();
                console.log(`[Recorder] Current URL: ${url}`);
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    console.log('[Recorder] Not an HTTP(S) URL, skipping injection');
                    return;
                }
                // Only inject if currently recording
                if (!currentRecording) {
                    console.log('[Recorder] No current recording, skipping injection');
                    return;
                }
                if (!currentRecording.isRecording) {
                    console.log('[Recorder] Not currently recording, skipping injection');
                    return;
                }
                console.log(`[Recorder] Attempting to inject script after ${eventName}...`);
                // Small delay to let page stabilize
                await new Promise(resolve => setTimeout(resolve, 500));
                try {
                    await recordingBrowserView.webContents.executeJavaScript(getRecorderScript());
                    console.log(`[Recorder] ✓ Script successfully injected after ${eventName}:`, url);
                }
                catch (error) {
                    console.error(`[Recorder] ✗ Failed to inject script after ${eventName}:`, error);
                }
            };
            // Handle all navigation events to ensure script is always injected
            recordingBrowserView.webContents.on('did-finish-load', () => {
                injectRecorderScript('did-finish-load');
            });
            recordingBrowserView.webContents.on('did-navigate', () => {
                injectRecorderScript('did-navigate');
            });
            recordingBrowserView.webContents.on('did-navigate-in-page', () => {
                injectRecorderScript('did-navigate-in-page');
            });
            recordingBrowserView.webContents.on('dom-ready', () => {
                injectRecorderScript('dom-ready');
            });
            // Clean up on close
            recordingWindow.on('closed', () => {
                // Clear periodic re-injection interval
                if (reinjectionInterval) {
                    clearInterval(reinjectionInterval);
                    reinjectionInterval = null;
                    console.log('[Recorder] Periodic re-injection timer cleared on window close');
                }
                if (recordingBrowserView && !recordingBrowserView.webContents.isDestroyed()) {
                    recordingBrowserView.webContents.destroy();
                }
                recordingWindow = null;
                recordingBrowserView = null;
                currentRecording = null;
            });
            resolve({ success: true });
        }
        catch (error) {
            console.error('[Recorder] Failed to create window:', error);
            resolve({ success: false });
        }
    });
}
export function setMainWindow(window) {
    mainWindow = window;
}
export function registerRecordingHandlers() {
    // Start recording
    ipcMain.handle('automation:start-recording', async (_, startUrl, accountId) => {
        return createRecordingWindow(startUrl, accountId);
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
        if (!currentRecording)
            return;
        // Start recording
        currentRecording.isRecording = true;
        currentRecording.url = recordingBrowserView.webContents.getURL();
        currentRecording.steps = [];
        // Inject recorder script
        try {
            await recordingBrowserView.webContents.executeJavaScript(getRecorderScript());
            console.log('[Recorder] Recording started, initial script injected');
        }
        catch (error) {
            console.error('[Recorder] Failed to start recording:', error);
        }
        // Set up periodic re-injection (every 3 seconds as a safety net)
        if (reinjectionInterval) {
            clearInterval(reinjectionInterval);
        }
        reinjectionInterval = setInterval(async () => {
            if (!currentRecording?.isRecording || !recordingBrowserView || recordingBrowserView.webContents.isDestroyed()) {
                if (reinjectionInterval) {
                    clearInterval(reinjectionInterval);
                    reinjectionInterval = null;
                }
                return;
            }
            try {
                const url = recordingBrowserView.webContents.getURL();
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    await recordingBrowserView.webContents.executeJavaScript(getRecorderScript());
                    console.log('[Recorder] Periodic re-injection completed');
                }
            }
            catch (error) {
                console.error('[Recorder] Periodic re-injection failed:', error);
            }
        }, 3000);
        console.log('[Recorder] Periodic re-injection timer started (every 3 seconds)');
        // Update UI
        recordingWindow.webContents.send('recording:state-changed', true);
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
    ipcMain.on('recording:save', (_, data) => {
        // Stop recording and clear interval
        if (currentRecording) {
            currentRecording.isRecording = false;
        }
        if (reinjectionInterval) {
            clearInterval(reinjectionInterval);
            reinjectionInterval = null;
            console.log('[Recorder] Periodic re-injection timer stopped');
        }
        if (!currentRecording || currentRecording.steps.length === 0) {
            console.log('[Recorder] No steps to save');
            recordingWindow?.close();
            return;
        }
        try {
            // Log all recorded steps for debugging
            console.log('[Recorder] All recorded steps:');
            currentRecording.steps.forEach((step, i) => {
                if (step.type === 'input') {
                    console.log(`  ${i}: ${step.type} -> ${step.selector} = "${step.value}" (${step.value?.length || 0} chars) ${step.isSensitive ? '🔒' : ''}`);
                }
                else {
                    console.log(`  ${i}: ${step.type} -> ${step.selector}`);
                }
            });
            // Deduplicate consecutive input steps to the same field
            // Keep only the last value for each consecutive group
            const deduplicatedSteps = [];
            for (let i = 0; i < currentRecording.steps.length; i++) {
                const step = currentRecording.steps[i];
                const nextStep = currentRecording.steps[i + 1];
                // If this is an input step and the next step is also input to the same field, skip this one
                if (step.type === 'input' &&
                    nextStep?.type === 'input' &&
                    step.selector === nextStep.selector) {
                    console.log(`[Recorder] ❌ Skipping duplicate: ${step.selector} = "${step.value}" (keeping next: "${nextStep.value}")`);
                    continue; // Skip intermediate values
                }
                deduplicatedSteps.push(step);
            }
            console.log(`[Recorder] Deduplicated: ${currentRecording.steps.length} -> ${deduplicatedSteps.length} steps`);
            console.log('[Recorder] Final steps to save:');
            deduplicatedSteps.forEach((step, i) => {
                if (step.type === 'input') {
                    console.log(`  ${i}: ${step.type} -> ${step.selector} = "${step.value}" (${step.value?.length || 0} chars) ${step.isSensitive ? '🔒' : ''}`);
                }
                else {
                    console.log(`  ${i}: ${step.type} -> ${step.selector}`);
                }
            });
            const db = getDatabase();
            const stepsJson = JSON.stringify(deduplicatedSteps);
            const result = db.prepare(`INSERT INTO export_recipes (name, institution, url, steps, account_id)
         VALUES (?, ?, ?, ?, ?)`).run(data.name, data.institution || null, currentRecording.url, stepsJson, currentRecording.accountId || null);
            console.log('[Recorder] Saved recording:', result.lastInsertRowid, 'with', deduplicatedSteps.length, 'steps');
            // Notify main window
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('automation:recording-saved');
            }
            // Close recording window
            recordingWindow?.close();
        }
        catch (error) {
            console.error('[Recorder] Failed to save recording:', error);
        }
    });
}
