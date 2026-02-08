import { ipcMain, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { getDatabase } from '../db';

let recordingWindow: BrowserWindow | null = null;
let playbackWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

// Current recording state
let currentRecording: {
  url: string;
  steps: any[];
  isRecording: boolean;
} | null = null;

// Playback state
let playbackState: {
  recipeId: string;
  currentStep: number;
  totalSteps: number;
  awaitingInput: boolean;
  inputResolver: ((value: string) => void) | null;
} | null = null;

export function setMainWindow(window: BrowserWindow) {
  mainWindow = window;
}

// Inject recording controls overlay into recording window
async function injectRecordingControls(window: BrowserWindow, isRecording: boolean = false) {
  if (!window || window.isDestroyed()) return;

  // Check if the page is ready
  const isReady = await window.webContents.executeJavaScript('typeof document !== "undefined" && document.readyState === "complete"').catch(() => false);
  if (!isReady) {
    console.log('[Automation] Page not ready for controls injection, skipping');
    return;
  }

  const overlayCode = `
    (function() {
      // Remove existing overlay if present
      const existing = document.getElementById('recording-controls');
      if (existing) existing.remove();

      // Add padding to body to make room for controls
      if (document.body) {
        document.body.style.paddingTop = '100px';
      }

      const overlay = document.createElement('div');
      overlay.id = 'recording-controls';
      const currentUrl = window.location ? window.location.href : 'about:blank';
      overlay.innerHTML = \`
        <style>
          body {
            padding-top: 100px !important;
          }

          #recording-controls {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 2147483647;
            background: #1f2937;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            pointer-events: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }

          #recording-controls * {
            pointer-events: auto;
            box-sizing: border-box;
          }

          #recording-controls-inner {
            display: flex;
            flex-direction: column;
            gap: 0;
          }

          #nav-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #374151;
            border-bottom: 1px solid #4b5563;
          }

          .nav-btn {
            background: #4b5563;
            color: #e5e7eb;
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            transition: all 0.2s;
          }

          .nav-btn:hover {
            background: #6b7280;
          }

          .nav-btn:active {
            transform: scale(0.95);
          }

          #url-input {
            flex: 1;
            background: #1f2937;
            border: 1px solid #4b5563;
            color: #f3f4f6;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            outline: none;
          }

          #url-input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
          }

          #go-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.2s;
          }

          #go-btn:hover {
            background: #2563eb;
          }

          #control-bar {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            background: #1f2937;
          }

          #recording-status {
            color: #60a5fa;
            font-weight: 600;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 120px;
          }

          #recording-status.recording {
            color: #f87171;
          }

          #recording-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #60a5fa;
          }

          #recording-status.recording #recording-indicator {
            background: #ef4444;
            animation: pulse 2s infinite;
          }

          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.6;
              transform: scale(1.2);
            }
          }

          #current-url-display {
            flex: 1;
            color: #9ca3af;
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .control-btn {
            background: #3b82f6;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            font-size: 13px;
            transition: all 0.2s;
            white-space: nowrap;
          }

          .control-btn:hover {
            background: #2563eb;
            transform: translateY(-1px);
          }

          .control-btn:active {
            transform: translateY(0);
          }

          #stop-btn {
            background: #ef4444;
            display: none;
          }

          #stop-btn:hover {
            background: #dc2626;
          }
        </style>

        <div id="recording-controls-inner">
          <div id="nav-bar">
            <button class="nav-btn" id="back-btn" title="Back">←</button>
            <button class="nav-btn" id="forward-btn" title="Forward">→</button>
            <button class="nav-btn" id="reload-btn" title="Reload">↻</button>
            <input
              type="text"
              id="url-input"
              placeholder="Enter URL (e.g., https://www.usaa.com)"
              value="\${currentUrl}"
            />
            <button id="go-btn">Go</button>
          </div>
          <div id="control-bar">
            <div id="recording-status">
              <span id="recording-indicator"></span>
              <span id="recording-text">Ready</span>
            </div>
            <div id="current-url-display">\${currentUrl}</div>
            <button id="start-btn" class="control-btn">Start Recording</button>
            <button id="stop-btn" class="control-btn">Stop & Save</button>
          </div>
        </div>
      \`;

      document.body.appendChild(overlay);

      // Update URL displays
      function updateUrls() {
        const urlInput = document.getElementById('url-input');
        const urlDisplay = document.getElementById('current-url-display');
        const currentUrl = window.location ? window.location.href : 'about:blank';
        if (urlInput && urlInput !== document.activeElement) {
          urlInput.value = currentUrl;
        }
        if (urlDisplay) {
          urlDisplay.textContent = currentUrl;
        }
      }
      setInterval(updateUrls, 500);

      // Navigation functions
      document.getElementById('back-btn').addEventListener('click', () => {
        console.log('__NAVIGATE_BACK__');
      });

      document.getElementById('forward-btn').addEventListener('click', () => {
        console.log('__NAVIGATE_FORWARD__');
      });

      document.getElementById('reload-btn').addEventListener('click', () => {
        console.log('__NAVIGATE_RELOAD__');
      });

      document.getElementById('go-btn').addEventListener('click', () => {
        const urlInput = document.getElementById('url-input');
        let url = urlInput.value.trim();
        if (!url) return;

        // Add https:// if no protocol specified
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }

        console.log('__NAVIGATE_TO__' + url);
      });

      // Enter key to navigate
      document.getElementById('url-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('go-btn').click();
        }
      });

      // Start recording button
      document.getElementById('start-btn').addEventListener('click', () => {
        const status = document.getElementById('recording-status');
        const text = document.getElementById('recording-text');
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');

        status.classList.add('recording');
        text.textContent = 'Recording';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';

        console.log('__START_RECORDING__');
      });

      // Stop recording button
      document.getElementById('stop-btn').addEventListener('click', () => {
        console.log('__STOP_RECORDING__');
      });

      // Set initial state based on recording status
      const isCurrentlyRecording = ${isRecording};
      if (isCurrentlyRecording) {
        const status = document.getElementById('recording-status');
        const text = document.getElementById('recording-text');
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');

        if (status) status.classList.add('recording');
        if (text) text.textContent = 'Recording';
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'block';
      }
    })();
  `;

  try {
    await window.webContents.executeJavaScript(overlayCode);
  } catch (error) {
    console.error('[Automation] Failed to inject recording controls:', error);
  }
}

// Show error notification in recording window
async function showErrorNotification(window: BrowserWindow, errorMessage: string) {
  if (!window || window.isDestroyed()) return;

  const errorCode = `
    (function() {
      // Remove any existing error
      const existing = document.getElementById('nav-error-notification');
      if (existing) existing.remove();

      const notification = document.createElement('div');
      notification.id = 'nav-error-notification';
      notification.innerHTML = \`
        <style>
          #nav-error-notification {
            position: fixed;
            top: 120px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2147483647;
            background: #dc2626;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            max-width: 500px;
            animation: slideDown 0.3s ease-out;
          }

          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }

          #nav-error-notification strong {
            display: block;
            margin-bottom: 4px;
            font-size: 15px;
          }

          #nav-error-close {
            position: absolute;
            top: 8px;
            right: 8px;
            background: transparent;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 4px 8px;
            opacity: 0.8;
          }

          #nav-error-close:hover {
            opacity: 1;
          }
        </style>

        <button id="nav-error-close">&times;</button>
        <strong>Navigation Failed</strong>
        <div>${JSON.stringify(errorMessage).slice(1, -1)}</div>
      \`;

      document.body.appendChild(notification);

      // Auto-remove after 8 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideDown 0.3s ease-out reverse';
          setTimeout(() => notification.remove(), 300);
        }
      }, 8000);

      // Close button
      document.getElementById('nav-error-close').addEventListener('click', () => {
        notification.remove();
      });
    })();
  `;

  try {
    await window.webContents.executeJavaScript(errorCode);
  } catch (error) {
    console.error('[Automation] Failed to show error notification:', error);
  }
}

// Inject playback progress overlay
// Show save dialog in recording window
async function showSaveDialog(window: BrowserWindow) {
  if (!window || window.isDestroyed()) return;

  const dialogCode = `
    (function() {
      // Create modal if it doesn't exist
      let modal = document.getElementById('save-recording-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'save-recording-modal';
        modal.innerHTML = \`
          <style>
            #save-recording-modal {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0,0,0,0.8);
              z-index: 10000000;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            #save-modal-content {
              background: white;
              border-radius: 12px;
              padding: 24px;
              max-width: 500px;
              width: 90%;
              box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            }

            #save-modal-content h2 {
              margin: 0 0 20px 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              font-size: 20px;
              color: #1f2937;
            }

            #save-modal-content label {
              display: block;
              margin-bottom: 6px;
              font-weight: 600;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              font-size: 13px;
              color: #374151;
            }

            #save-modal-content input {
              width: 100%;
              padding: 10px 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              margin-bottom: 16px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              font-size: 14px;
              box-sizing: border-box;
            }

            #save-modal-content input:focus {
              outline: none;
              border-color: #3b82f6;
              box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
            }

            #save-modal-actions {
              display: flex;
              gap: 12px;
              justify-content: flex-end;
              margin-top: 20px;
            }

            #save-modal-actions button {
              padding: 10px 20px;
              border: none;
              border-radius: 6px;
              font-weight: 600;
              cursor: pointer;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              font-size: 14px;
            }

            #cancel-save-btn {
              background: #e5e7eb;
              color: #374151;
            }

            #confirm-save-btn {
              background: #3b82f6;
              color: white;
            }
          </style>

          <div id="save-modal-content">
            <h2>Save Recording</h2>
            <div>
              <label for="recording-name-input">Name</label>
              <input
                type="text"
                id="recording-name-input"
                placeholder="e.g., Download USAA Transactions"
                required
              />
            </div>
            <div>
              <label for="recording-institution-input">Institution (optional)</label>
              <input
                type="text"
                id="recording-institution-input"
                placeholder="e.g., USAA, Chase, Bank of America"
              />
            </div>
            <div id="save-modal-actions">
              <button id="cancel-save-btn">Cancel</button>
              <button id="confirm-save-btn">Save</button>
            </div>
          </div>
        \`;
        document.body.appendChild(modal);

        // Focus name input
        setTimeout(() => {
          document.getElementById('recording-name-input').focus();
        }, 100);

        // Cancel button
        document.getElementById('cancel-save-btn').addEventListener('click', () => {
          modal.remove();
        });

        // Save button
        document.getElementById('confirm-save-btn').addEventListener('click', () => {
          const name = document.getElementById('recording-name-input').value.trim();
          const institution = document.getElementById('recording-institution-input').value.trim() || null;

          if (!name) {
            alert('Please enter a name for the recording');
            return;
          }

          console.log('__SAVE_RECORDING__' + JSON.stringify({ name, institution }));
          modal.remove();
        });

        // Enter to save
        document.getElementById('recording-name-input').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            document.getElementById('confirm-save-btn').click();
          }
        });
      }
    })();
  `;

  try {
    await window.webContents.executeJavaScript(dialogCode);
  } catch (error) {
    console.error('[Automation] Failed to show save dialog:', error);
  }
}

async function injectPlaybackControls(window: BrowserWindow) {
  if (!window || window.isDestroyed()) return;

  const overlayCode = `
    (function() {
      if (document.getElementById('playback-controls')) return;

      const overlay = document.createElement('div');
      overlay.id = 'playback-controls';
      overlay.innerHTML = \`
        <style>
          #playback-controls {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 999999;
            background: linear-gradient(to bottom, rgba(59,130,246,0.95), rgba(59,130,246,0.85), transparent);
            padding: 20px 20px 40px 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            pointer-events: none;
          }

          #playback-controls * {
            pointer-events: auto;
          }

          #playback-controls-inner {
            max-width: 1200px;
            margin: 0 auto;
          }

          #playback-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }

          #playback-status {
            color: white;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 15px;
          }

          #cancel-playback {
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 6px 14px;
            border-radius: 6px;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px;
            font-weight: 500;
          }

          #progress-bar-container {
            width: 100%;
            height: 10px;
            background: rgba(255,255,255,0.25);
            border-radius: 5px;
            overflow: hidden;
          }

          #progress-bar {
            height: 100%;
            background: white;
            border-radius: 5px;
            transition: width 0.3s ease;
            width: 0%;
          }

          .element-highlight {
            outline: 3px solid #fbbf24 !important;
            outline-offset: 2px;
            box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.3) !important;
          }
        </style>

        <div id="playback-controls-inner">
          <div id="playback-header">
            <div id="playback-status">Starting playback...</div>
            <button id="cancel-playback">Cancel</button>
          </div>
          <div id="progress-bar-container">
            <div id="progress-bar"></div>
          </div>
        </div>
      \`;

      document.body.appendChild(overlay);

      document.getElementById('cancel-playback').addEventListener('click', () => {
        console.log('__CANCEL_PLAYBACK__');
      });

      // Expose function to update progress
      window.updatePlaybackProgress = function(currentStep, totalSteps, step) {
        const statusEl = document.getElementById('playback-status');
        const progressBar = document.getElementById('progress-bar');

        if (statusEl) {
          const action = step.type === 'click' ? 'Clicking' :
                         step.type === 'input' ? 'Typing in' :
                         step.type === 'select' ? 'Selecting' : 'Executing';

          let target = step.selector;
          if (target.startsWith('label:')) target = target.substring(6);
          if (target.startsWith('placeholder:')) target = target.substring(12);

          statusEl.textContent = \`Step \${currentStep} of \${totalSteps}: \${action} "\${target.substring(0, 50)}\${target.length > 50 ? '...' : ''}"\`;
        }

        if (progressBar) {
          const percentage = (currentStep / totalSteps) * 100;
          progressBar.style.width = percentage + '%';
        }
      };
    })();
  `;

  try {
    await window.webContents.executeJavaScript(overlayCode);
  } catch (error) {
    console.error('[Automation] Failed to inject playback controls:', error);
  }
}

// Minimal, stealthy recorder script - only captures essentials, minimal interference
export const getRecorderScript = () => `
(function() {
  // Use Symbol for state to avoid detection via property enumeration
  const stateKey = Symbol.for('__rec__');

  // Exit if already injected
  if (window[stateKey]) return;
  window[stateKey] = { handlers: [], last: null };

  const state = window[stateKey];

  // Lightweight selector generation - cache results
  const selectorCache = new WeakMap();
  function getSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (selectorCache.has(el)) return selectorCache.get(el);

    let sel = '';

    // For form elements, prefer semantic attributes (most stable)
    if (el.matches?.('input,textarea,select')) {
      // Prefer name attribute
      if (el.name) {
        sel = el.tagName.toLowerCase() + '[name="' + CSS.escape(el.name) + '"]';
        if (document.querySelectorAll(sel).length === 1) {
          selectorCache.set(el, sel);
          return sel;
        }
      }

      // Try placeholder
      if (el.placeholder) {
        sel = 'placeholder:' + el.placeholder;
        selectorCache.set(el, sel);
        return sel;
      }

      // Try aria-label
      const ariaLabel = el.getAttribute?.('aria-label');
      if (ariaLabel) {
        sel = 'aria-label:' + ariaLabel;
        selectorCache.set(el, sel);
        return sel;
      }

      // Try associated label
      if (el.id) {
        const lbl = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (lbl?.textContent) {
          sel = 'label:' + lbl.textContent.trim();
          selectorCache.set(el, sel);
          return sel;
        }
      }
    }

    // Fallback: simple path (max 3 levels to keep it fast)
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

    sel = path.join(' > ');
    selectorCache.set(el, sel);
    return sel;
  }

  // Capture handler - uses capture phase with passive to avoid blocking
  function capture(e) {
    try {
      const t = e.target;
      if (!t?.tagName) return;

      const tag = t.tagName;
      let type = null;
      let data = null;

      // Only capture meaningful interactions
      if (e.type === 'click' && tag === 'BUTTON' || tag === 'A' || t.type === 'submit') {
        type = 'click';
        data = { selector: getSelector(t), element: tag };
      } else if (e.type === 'input' && (tag === 'INPUT' || tag === 'TEXTAREA')) {
        type = 'input';
        const val = t.type === 'password' ? '[REDACTED]' : t.value;
        const sel = getSelector(t);

        // Debounce inputs from same field
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

        // Send via console (least intrusive method)
        console.log('debug:evt:' + JSON.stringify(data));
      }
    } catch (err) {
      // Silently fail to avoid breaking page
    }
  }

  // Use capture phase + passive to minimize interference
  const opts = { capture: true, passive: true };
  document.addEventListener('click', capture, opts);
  document.addEventListener('input', capture, opts);
  document.addEventListener('change', capture, opts);

  state.handlers.push({ capture, opts });

  // Cleanup function
  window[Symbol.for('__rec_cleanup__')] = function() {
    try {
      state.handlers.forEach(h => {
        document.removeEventListener('click', h.capture, h.opts);
        document.removeEventListener('input', h.capture, h.opts);
        document.removeEventListener('change', h.capture, h.opts);
      });
      delete window[stateKey];
      delete window[Symbol.for('__rec_cleanup__')];
    } catch (err) {}
  };
})();
`;

export function registerAutomationHandlers(): void {
  // Start recording in a new standalone window
  ipcMain.handle('automation:start-recording', async (_, startUrl?: string) => {
    try {
      // Always start with Google - it's fast and reliable
      const url = 'https://www.google.com';
      console.log('[Automation] Starting recording window');

      if (recordingWindow && !recordingWindow.isDestroyed()) {
        recordingWindow.close();
      }

      currentRecording = {
        url: url,
        steps: [],
        isRecording: false
      };

      recordingWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'Bank Website - Recording Mode',
        backgroundColor: '#ffffff',
        webPreferences: {
          // Use persistent session to maintain cookies/localStorage
          partition: 'persist:recorder',

          // Enable web features that banks expect (same as old recorder)
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false, // Some banks need this
          webSecurity: true, // Keep enabled like the old recorder
          allowRunningInsecureContent: false,

          // Enable features banks may check for
          plugins: true,
          webgl: true,

          // Allow popups (some banks use them)
          javascript: true,
          images: true,

          // Enable session storage
          enablePreferredSizeMode: false,
        },

        // Make it look like a normal browser window
        autoHideMenuBar: false,

        // Show browser-like controls
        titleBarStyle: 'default',
      });

      // Set realistic user agent (same as old recorder)
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      recordingWindow.webContents.setUserAgent(userAgent);

      // Set additional headers to look more browser-like (same as old recorder)
      recordingWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = userAgent;
        details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
        details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
        details.requestHeaders['DNT'] = '1';
        details.requestHeaders['Upgrade-Insecure-Requests'] = '1';
        callback({ requestHeaders: details.requestHeaders });
      });

      // Listen for console messages to capture interactions and control signals
      recordingWindow.webContents.on('console-message', async (_, level, message) => {
        if (message === '__START_RECORDING__') {
          // Inject recorder script and mark as recording
          try {
            if (currentRecording) {
              // Capture the current URL when recording starts
              const currentUrl = recordingWindow!.webContents.getURL();
              currentRecording.url = currentUrl;
              currentRecording.isRecording = true;
              console.log('[Automation] Recording started at URL:', currentUrl);
            }
            await recordingWindow!.webContents.executeJavaScript(getRecorderScript());
          } catch (error) {
            console.error('[Automation] Failed to start recording:', error);
          }
        } else if (message === '__STOP_RECORDING__') {
          // Show save dialog
          console.log('[Automation] Stop recording requested, showing save dialog');
          await showSaveDialog(recordingWindow!);
        } else if (message.startsWith('__SAVE_RECORDING__')) {
          // Save the recording
          console.log('[Automation] Save recording message received:', message);
          try {
            const data = JSON.parse(message.substring(18));
            console.log('[Automation] Parsed save data:', data);

            if (currentRecording) {
              console.log('[Automation] Current recording has', currentRecording.steps.length, 'steps');
              const stepsJson = JSON.stringify(currentRecording.steps);
              const db = getDatabase();
              const result = db.prepare(
                `INSERT INTO export_recipes (name, institution, url, steps)
                 VALUES (?, ?, ?, ?)`
              ).run(data.name, data.institution, currentRecording.url, stepsJson);

              console.log('[Automation] Saved recording to database:', data.name, 'ID:', result.lastInsertRowid);

              // Notify main window
              if (mainWindow && !mainWindow.isDestroyed()) {
                console.log('[Automation] Sending recording-saved event to main window');
                mainWindow.webContents.send('automation:recording-saved');
              } else {
                console.warn('[Automation] Main window not available to send event');
              }

              // Close recording window
              if (recordingWindow && !recordingWindow.isDestroyed()) {
                console.log('[Automation] Closing recording window');
                recordingWindow.close();
              }

              recordingWindow = null;
              currentRecording = null;
              console.log('[Automation] Recording state cleared');
            } else {
              console.warn('[Automation] No current recording found');
            }
          } catch (error) {
            console.error('[Automation] Failed to save recording:', error);
          }
        } else if (message === '__NAVIGATE_BACK__') {
          if (recordingWindow && !recordingWindow.isDestroyed()) {
            recordingWindow.webContents.goBack();
          }
        } else if (message === '__NAVIGATE_FORWARD__') {
          if (recordingWindow && !recordingWindow.isDestroyed()) {
            recordingWindow.webContents.goForward();
          }
        } else if (message === '__NAVIGATE_RELOAD__') {
          if (recordingWindow && !recordingWindow.isDestroyed()) {
            recordingWindow.webContents.reload();
          }
        } else if (message.startsWith('__NAVIGATE_TO__')) {
          const url = message.substring(15);
          if (recordingWindow && !recordingWindow.isDestroyed()) {
            try {
              await recordingWindow.webContents.loadURL(url);
            } catch (error: any) {
              console.error('[Automation] Failed to navigate:', error);

              // Show user-friendly error message
              let errorMsg = 'Unable to load this page. ';
              if (error.code === 'ERR_FAILED') {
                errorMsg += 'The site may be blocking automated browsers or having connection issues. Try a different URL or check your internet connection.';
              } else if (error.code === 'ERR_NAME_NOT_RESOLVED') {
                errorMsg += 'Could not find this website. Check the URL and try again.';
              } else if (error.code === 'ERR_CONNECTION_REFUSED') {
                errorMsg += 'Connection was refused. The site may be down or blocking access.';
              } else {
                errorMsg += error.message || 'Unknown error occurred.';
              }

              await showErrorNotification(recordingWindow, errorMsg);
            }
          }
        } else if (message.startsWith('debug:evt:')) {
          try {
            const interaction = JSON.parse(message.substring(10));
            if (currentRecording) {
              currentRecording.steps.push(interaction);
              console.log('[Automation] Captured interaction:', interaction.type, interaction.selector);
            }
          } catch (err) {
            console.error('[Automation] Failed to parse interaction:', err);
          }
        }
      });

      // Track URL changes (only update if not yet recording - we want the start URL)
      recordingWindow.webContents.on('did-navigate', (_, url) => {
        if (currentRecording && !currentRecording.isRecording) {
          // Only update URL before recording starts (during navigation setup)
          currentRecording.url = url;
          console.log('[Automation] Navigated to:', url);
        }
      });

      recordingWindow.webContents.on('did-navigate-in-page', (_, url) => {
        if (currentRecording && !currentRecording.isRecording) {
          // Only update URL before recording starts
          currentRecording.url = url;
        }
      });

      recordingWindow.on('closed', () => {
        recordingWindow = null;
        currentRecording = null;
      });

      // Handle page load failures
      recordingWindow.webContents.on('did-fail-load', async (event, errorCode, errorDescription, validatedURL) => {
        // Ignore aborted loads and ERR_ABORTED (user navigating away)
        if (errorCode === -3 || errorCode === -2 && errorDescription.includes('aborted')) {
          return;
        }

        console.error('[Automation] Page failed to load:', errorCode, errorDescription, validatedURL);

        let errorMsg = 'Unable to load this page. ';
        if (errorCode === -2) {
          errorMsg += 'The site may be blocking automated browsers or having connection issues.';
        } else if (errorCode === -105) {
          errorMsg += 'Could not find this website. Check the URL and try again.';
        } else if (errorCode === -102) {
          errorMsg += 'Connection was refused. The site may be down or blocking access.';
        } else {
          errorMsg += errorDescription || 'Unknown error occurred.';
        }

        await showErrorNotification(recordingWindow!, errorMsg);
      });

      // Inject recording controls overlay after every page load
      recordingWindow.webContents.on('did-finish-load', async () => {
        const isRecording = currentRecording?.isRecording || false;
        await injectRecordingControls(recordingWindow!, isRecording);

        // Re-inject recorder script if currently recording
        if (currentRecording && currentRecording.isRecording) {
          try {
            await recordingWindow!.webContents.executeJavaScript(getRecorderScript());
            console.log('[Automation] Re-injected recorder script on page navigation');
          } catch (error) {
            console.error('[Automation] Failed to re-inject recorder script:', error);
          }
        }
      });

      // Also inject on navigation within the same page
      recordingWindow.webContents.on('did-navigate-in-page', async () => {
        const isRecording = currentRecording?.isRecording || false;
        await injectRecordingControls(recordingWindow!, isRecording);
      });

      // Load Google initially - it's fast and always works
      recordingWindow.webContents.loadURL(url).catch((error) => {
        console.log('[Automation] Failed to load Google:', error.message);
      });

      return { success: true };
    } catch (error) {
      console.error('[Automation] Failed to start recording:', error);
      throw error;
    }
  });

  // Stop recording window
  ipcMain.handle('automation:stop-recording-window', async () => {
    if (recordingWindow && !recordingWindow.isDestroyed()) {
      recordingWindow.close();
    }
    recordingWindow = null;
    currentRecording = null;
  });

  // Get current recording data (for save dialog in recording window)
  ipcMain.handle('automation:get-current-recording', async () => {
    return currentRecording;
  });

  // Start recording mode (inject script)
  ipcMain.handle('automation:start-recording-mode', async () => {
    if (!recordingWindow || recordingWindow.isDestroyed()) {
      throw new Error('Recording window not found');
    }

    try {
      await recordingWindow.webContents.executeJavaScript(getRecorderScript());
      console.log('[Automation] Recording mode activated');
      return { success: true };
    } catch (error) {
      console.error('[Automation] Failed to inject recorder script:', error);
      throw error;
    }
  });

  // Save recording
  ipcMain.handle('automation:save-recording', async (_, data: { name: string; institution: string | null }) => {
    if (!currentRecording) {
      throw new Error('No recording in progress');
    }

    try {
      const stepsJson = JSON.stringify(currentRecording.steps);

      const db = getDatabase();
      const result = db.prepare(
        `INSERT INTO export_recipes (name, institution, url, steps)
         VALUES (?, ?, ?, ?)`
      ).run(data.name, data.institution, currentRecording.url, stepsJson);

      console.log('[Automation] Saved recording:', data.name);

      // Notify main window
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('automation:recording-saved');
      }

      // Close recording window
      if (recordingWindow && !recordingWindow.isDestroyed()) {
        recordingWindow.close();
      }

      recordingWindow = null;
      currentRecording = null;

      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      console.error('[Automation] Failed to save recording:', error);
      throw error;
    }
  });

  // Play recording
  ipcMain.handle('automation:play-recording', async (_, recipeId: string) => {
    try {
      console.log('[Automation] Starting playback for recipe:', recipeId);

      // Load recipe from database
      const db = getDatabase();
      const recipe = db.prepare(
        'SELECT * FROM export_recipes WHERE id = ?'
      ).get(recipeId);

      if (!recipe) {
        throw new Error('Recipe not found');
      }

      const steps = JSON.parse(recipe.steps);

      if (playbackWindow && !playbackWindow.isDestroyed()) {
        playbackWindow.close();
      }

      playbackWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'Playback Mode',
        backgroundColor: '#ffffff',
        webPreferences: {
          partition: 'persist:recorder',
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          webSecurity: true
        },
        autoHideMenuBar: false,
        titleBarStyle: 'default'
      });

      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      playbackWindow.webContents.setUserAgent(userAgent);

      playbackState = {
        recipeId,
        currentStep: 0,
        totalSteps: steps.length,
        awaitingInput: false,
        inputResolver: null
      };

      // Listen for cancel action
      playbackWindow.webContents.on('console-message', (_, level, message) => {
        if (message === '__CANCEL_PLAYBACK__') {
          if (playbackWindow && !playbackWindow.isDestroyed()) {
            playbackWindow.close();
          }
          playbackWindow = null;
          playbackState = null;
        }
      });

      playbackWindow.on('closed', () => {
        playbackWindow = null;
        playbackState = null;
      });

      await playbackWindow.loadURL(recipe.url);

      // Inject playback controls after page loads
      playbackWindow.webContents.once('did-finish-load', async () => {
        await injectPlaybackControls(playbackWindow!);
      });

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Execute steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        playbackState.currentStep = i + 1;

        console.log(`[Automation] Executing step ${i + 1}/${steps.length}:`, step.type, step.selector);

        // Update progress overlay
        if (playbackWindow && !playbackWindow.isDestroyed()) {
          await playbackWindow.webContents.executeJavaScript(`
            if (window.updatePlaybackProgress) {
              window.updatePlaybackProgress(${i + 1}, ${steps.length}, ${JSON.stringify(step)});
            }
          `);
        }

        // Check if this step needs sensitive input
        if (step.type === 'input' && step.value === '[REDACTED]') {
          // Request input from main window
          playbackState.awaitingInput = true;

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('automation:playback-needs-input', {
              stepNumber: i + 1,
              totalSteps: steps.length,
              fieldLabel: step.fieldLabel || step.selector
            });
          }

          // Wait for input
          const userInput = await new Promise<string>((resolve) => {
            playbackState!.inputResolver = resolve;
          });

          step.value = userInput;
          playbackState.awaitingInput = false;
          playbackState.inputResolver = null;
        }

        // Execute the step
        await executeStep(playbackWindow, step);

        // Wait between steps
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('[Automation] Playback complete');

      // Notify main window
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('automation:playback-complete');
      }

      // Keep window open for 2 seconds to show completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (playbackWindow && !playbackWindow.isDestroyed()) {
        playbackWindow.close();
      }

      playbackWindow = null;
      playbackState = null;

      return { success: true };
    } catch (error) {
      console.error('[Automation] Playback failed:', error);

      if (playbackWindow && !playbackWindow.isDestroyed()) {
        playbackWindow.close();
      }

      playbackWindow = null;
      playbackState = null;

      throw error;
    }
  });

  // Provide sensitive input
  ipcMain.handle('automation:provide-sensitive-input', async (_, value: string) => {
    if (!playbackState || !playbackState.awaitingInput || !playbackState.inputResolver) {
      throw new Error('No input request pending');
    }

    playbackState.inputResolver(value);
    return { success: true };
  });
}

// Helper function to execute a single step
async function executeStep(window: BrowserWindow, step: any): Promise<void> {
  if (!window || window.isDestroyed()) {
    throw new Error('Window is destroyed');
  }

  const selector = step.selector;
  let retries = 3;
  let lastError = null;

  while (retries > 0) {
    try {
      let element = null;

      // Try different selector strategies
      if (selector.startsWith('label:')) {
        const labelText = selector.substring(6);
        element = await window.webContents.executeJavaScript(`
          (function() {
            const labels = Array.from(document.querySelectorAll('label'));
            const label = labels.find(l => l.textContent.trim() === ${JSON.stringify(labelText)});
            if (label) {
              const input = label.querySelector('input, textarea, select') ||
                           (label.getAttribute('for') && document.getElementById(label.getAttribute('for')));
              return input ? true : false;
            }
            return false;
          })()
        `);

        if (element) {
          if (step.type === 'click') {
            await window.webContents.executeJavaScript(`
              (function() {
                const labels = Array.from(document.querySelectorAll('label'));
                const label = labels.find(l => l.textContent.trim() === ${JSON.stringify(labelText)});
                if (label) {
                  const input = label.querySelector('input, textarea, select') ||
                               (label.getAttribute('for') && document.getElementById(label.getAttribute('for')));
                  if (input) input.click();
                }
              })()
            `);
          } else if (step.type === 'input') {
            await window.webContents.executeJavaScript(`
              (function() {
                const labels = Array.from(document.querySelectorAll('label'));
                const label = labels.find(l => l.textContent.trim() === ${JSON.stringify(labelText)});
                if (label) {
                  const input = label.querySelector('input, textarea') ||
                               (label.getAttribute('for') && document.getElementById(label.getAttribute('for')));
                  if (input) {
                    input.value = ${JSON.stringify(step.value)};
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }
              })()
            `);
          }
          return;
        }
      } else if (selector.startsWith('placeholder:')) {
        const placeholder = selector.substring(12);
        if (step.type === 'input') {
          await window.webContents.executeJavaScript(`
            (function() {
              const input = document.querySelector('[placeholder=${JSON.stringify(placeholder)}]');
              if (input) {
                input.value = ${JSON.stringify(step.value)};
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
            })()
          `);
          return;
        }
      } else {
        // Standard CSS selector
        const exists = await window.webContents.executeJavaScript(`
          document.querySelector(${JSON.stringify(selector)}) !== null
        `);

        if (exists) {
          if (step.type === 'click') {
            await window.webContents.executeJavaScript(`
              document.querySelector(${JSON.stringify(selector)}).click()
            `);
          } else if (step.type === 'input') {
            await window.webContents.executeJavaScript(`
              (function() {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (el) {
                  el.value = ${JSON.stringify(step.value)};
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                }
              })()
            `);
          } else if (step.type === 'select') {
            await window.webContents.executeJavaScript(`
              (function() {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (el) {
                  el.value = ${JSON.stringify(step.value)};
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                }
              })()
            `);
          }
          return;
        }
      }

      throw new Error('Element not found');
    } catch (error) {
      lastError = error;
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(`Failed to execute step after 3 retries: ${lastError}`);
}
