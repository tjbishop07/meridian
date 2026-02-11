import { ipcMain, BrowserWindow, BrowserView, dialog } from 'electron';
import path from 'path';
import { getDatabase } from '../db';
import { registerRecordingHandlers, setMainWindow as setRecordingMainWindow } from './automation-browserview';

let recordingWindow: BrowserWindow | null = null;
let recordingBrowserView: BrowserView | null = null;
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
  setRecordingMainWindow(window);
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

// Inject sensitive input prompt
async function injectSensitiveInputPrompt(window: BrowserWindow, label: string, stepNumber: number, totalSteps: number): Promise<string> {
  if (!window || window.isDestroyed()) {
    throw new Error('Window is destroyed');
  }

  const promptCode = `
    (function() {
      return new Promise((resolve) => {
        // Remove existing prompt if present
        const existing = document.getElementById('sensitive-input-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'sensitive-input-overlay';
        overlay.innerHTML = \`
          <style>
            #sensitive-input-overlay {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              z-index: 2147483647;
              background: rgba(0, 0, 0, 0.8);
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              animation: fadeIn 0.2s ease-out;
            }

            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }

            #sensitive-input-box {
              background: white;
              border-radius: 12px;
              padding: 32px;
              max-width: 500px;
              width: 90%;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
              animation: slideUp 0.3s ease-out;
            }

            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            #sensitive-input-box h2 {
              margin: 0 0 8px 0;
              font-size: 24px;
              color: #1f2937;
              display: flex;
              align-items: center;
              gap: 12px;
            }

            #sensitive-input-box .step-info {
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 20px;
            }

            #sensitive-input-box .field-label {
              color: #374151;
              font-size: 15px;
              margin-bottom: 16px;
              padding: 12px;
              background: #f3f4f6;
              border-radius: 6px;
              border-left: 3px solid #3b82f6;
            }

            #sensitive-input-box .alert {
              background: #dbeafe;
              border: 1px solid #93c5fd;
              color: #1e40af;
              padding: 12px;
              border-radius: 6px;
              margin-bottom: 20px;
              font-size: 13px;
              display: flex;
              gap: 8px;
            }

            #sensitive-input-box input {
              width: 100%;
              padding: 14px;
              border: 2px solid #d1d5db;
              border-radius: 8px;
              font-size: 16px;
              box-sizing: border-box;
              margin-bottom: 20px;
              transition: border-color 0.2s;
            }

            #sensitive-input-box input:focus {
              outline: none;
              border-color: #3b82f6;
              box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            #sensitive-input-box button {
              width: 100%;
              padding: 14px 24px;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            }

            #sensitive-input-box button:hover:not(:disabled) {
              background: #2563eb;
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            }

            #sensitive-input-box button:active:not(:disabled) {
              transform: translateY(0);
            }

            #sensitive-input-box button:disabled {
              background: #9ca3af;
              cursor: not-allowed;
            }

            .lock-icon {
              display: inline-block;
              width: 28px;
              height: 28px;
              background: #fbbf24;
              border-radius: 50%;
              position: relative;
            }

            .lock-icon::before {
              content: '🔒';
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 14px;
            }
          </style>

          <div id="sensitive-input-box">
            <h2>
              <span class="lock-icon"></span>
              Sensitive Input Required
            </h2>
            <div class="step-info">Step ${stepNumber} of ${totalSteps}</div>
            <div class="field-label">${label.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            <div class="alert">
              <span>ℹ️</span>
              <div>
                <strong>Privacy Note:</strong> This value is not stored and only used for this playback session.
                ${label.toLowerCase().includes('pin') ? '<br><strong>For separate PIN boxes:</strong> Enter one digit at a time.' : ''}
              </div>
            </div>
            <input
              type="password"
              id="sensitive-value-input"
              placeholder="Enter value..."
              autocomplete="off"
            />
            <button id="submit-sensitive-value" disabled>Continue</button>
          </div>
        \`;

        document.body.appendChild(overlay);

        const input = document.getElementById('sensitive-value-input');
        const button = document.getElementById('submit-sensitive-value');

        // Focus input
        setTimeout(() => input.focus(), 100);

        // Enable button when input has value
        input.addEventListener('input', () => {
          button.disabled = !input.value.trim();
        });

        // Handle submit
        function submit() {
          const value = input.value.trim();
          if (value) {
            overlay.remove();
            resolve(value);
          }
        }

        button.addEventListener('click', submit);
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            submit();
          }
        });
      });
    })();
  `;

  try {
    const value = await window.webContents.executeJavaScript(promptCode);
    return value as string;
  } catch (error) {
    console.error('[Automation] Failed to inject sensitive input prompt:', error);
    throw error;
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

      // Ignore clicks on ALL injected UI elements
      // Check for parent containers first (using closest if available)
      if (t.closest) {
        if (t.closest('#recording-controls') ||
            t.closest('#playback-controls') ||
            t.closest('#save-modal')) {
          return;
        }
      }

      // Check specific IDs and classes
      if (t.id === 'stop-btn' ||
          t.id === 'start-btn' ||
          t.id === 'pause-btn' ||
          t.id === 'skip-btn' ||
          t.id === 'continue-btn' ||
          t.id === 'go-btn' ||
          t.id === 'reload-btn' ||
          t.id === 'back-btn' ||
          t.id === 'forward-btn' ||
          t.id === 'url-input' ||
          t.id === 'confirm-save-btn' ||
          t.id === 'cancel-save-btn' ||
          t.id === 'recording-name-input' ||
          t.id === 'recording-institution-input' ||
          t.id === 'recording-controls' ||
          t.id === 'playback-controls' ||
          t.id === 'save-modal') {
        return;
      }

      // Check classes
      if (t.classList && (t.classList.contains('control-btn') || t.classList.contains('nav-btn'))) {
        return;
      }

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
  // Register new BrowserView-based recording handlers
  registerRecordingHandlers();

  // OLD IMPLEMENTATION BELOW - Will be removed after testing
  // Start recording in a new standalone window with BrowserView
  ipcMain.handle('automation:start-recording-OLD', async (_, startUrl?: string) => {
    try {
      const url = startUrl || 'https://www.google.com';
      console.log('[Automation] Starting recording window with BrowserView');

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

            // Filter out interactions from save dialogs or app UI
            // These will have selectors that match our app's UI elements
            const isAppUI = interaction.selector?.includes('e.g., Download USAA Transactions') ||
                           interaction.selector?.includes('recording-name-input') ||
                           interaction.selector?.includes('recording-institution-input') ||
                           interaction.selector?.includes('modal') ||
                           interaction.selector?.includes('btn btn-') ||
                           interaction.selector?.startsWith('#recording-') ||
                           interaction.selector?.startsWith('#save-') ||
                           interaction.selector?.startsWith('#nav-') ||
                           interaction.selector?.startsWith('#sensitive-');

            if (isAppUI) {
              console.log('[Automation] Filtered out app UI interaction:', interaction.selector);
              return;
            }

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
        const currentUrl = recordingWindow!.webContents.getURL();

        // Only inject on actual web pages, not internal pages
        if (!currentUrl.startsWith('http://') && !currentUrl.startsWith('https://')) {
          console.log('[Automation] Skipping injection on non-web page:', currentUrl);
          return;
        }

        // Wait a bit for page to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));

        const isRecording = currentRecording?.isRecording || false;
        console.log('[Automation] Page loaded, isRecording:', isRecording, 'URL:', currentUrl);

        await injectRecordingControls(recordingWindow!, isRecording);

        // Re-inject recorder script if currently recording
        if (currentRecording && currentRecording.isRecording) {
          try {
            console.log('[Automation] Re-injecting recorder script for:', currentUrl);
            await recordingWindow!.webContents.executeJavaScript(getRecorderScript());
            console.log('[Automation] ✓ Recorder script re-injected successfully');
          } catch (error) {
            console.error('[Automation] ✗ Failed to re-inject recorder script:', error);
          }
        }
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

      // Set up automatic re-injection on ALL navigation events
      const autoInjectControls = async () => {
        if (!playbackWindow || playbackWindow.isDestroyed()) return;

        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
          await injectPlaybackControls(playbackWindow);
          console.log('[Automation] Auto-injected playback controls after navigation');

          // Restore progress if we're in the middle of playback
          if (playbackState && playbackState.currentStep > 0) {
            const currentStep = playbackState.currentStep;
            const totalSteps = steps.length;
            await playbackWindow.webContents.executeJavaScript(`
              if (window.updatePlaybackProgress) {
                const statusEl = document.getElementById('playback-status');
                if (statusEl) {
                  statusEl.textContent = 'Step ${currentStep} of ${totalSteps}: Waiting for page...';
                }
              }
            `);
            console.log('[Automation] Restored progress indicator');
          }
        } catch (error) {
          console.error('[Automation] Failed to auto-inject controls:', error);
        }
      };

      // Listen for ALL navigation events and re-inject controls
      playbackWindow.webContents.on('did-navigate', autoInjectControls);
      playbackWindow.webContents.on('did-navigate-in-page', autoInjectControls);
      playbackWindow.webContents.on('did-finish-load', autoInjectControls);
      playbackWindow.webContents.on('dom-ready', autoInjectControls);

      console.log('[Automation] Set up automatic control re-injection on navigation events');

      await playbackWindow.loadURL(recipe.url);

      // Wait for initial page to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Execute steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        playbackState.currentStep = i + 1;

        console.log(`\n[Automation] ======================================`);
        console.log(`[Automation] Step ${i + 1}/${steps.length}`);
        console.log(`[Automation] Type: ${step.type}`);
        console.log(`[Automation] Selector: ${step.selector}`);
        console.log(`[Automation] Element: ${step.element}`);
        if (step.type === 'input') {
          const valuePreview = step.isSensitive ? '[SENSITIVE]' : step.value;
          console.log(`[Automation] Value: "${step.value}" (${step.value?.length || 0} chars) ${step.isSensitive ? '🔒' : ''}`);
          console.log(`[Automation] Value type: ${typeof step.value}`);
          console.log(`[Automation] Value preview: ${valuePreview}`);
        }
        console.log(`[Automation] ======================================\n`);

        // Update progress overlay
        if (playbackWindow && !playbackWindow.isDestroyed()) {
          try {
            await playbackWindow.webContents.executeJavaScript(`
              if (window.updatePlaybackProgress) {
                window.updatePlaybackProgress(${i + 1}, ${steps.length}, ${JSON.stringify(step)});
              }
            `);
          } catch (err) {
            console.log('[Automation] Could not update progress overlay (non-critical)');
          }
        }

        // Check if this step needs sensitive input
        console.log('[Automation] Checking if step needs sensitive input:', {
          type: step.type,
          value: step.value,
          valueType: typeof step.value,
          isRedacted: step.value === '[REDACTED]',
          isEmpty: !step.value || step.value === '',
          fieldLabel: step.fieldLabel
        });

        const needsSensitiveInput = step.type === 'input' && (
          step.value === '[REDACTED]' ||
          step.value === '' ||
          step.value === null ||
          step.value === undefined
        );

        if (needsSensitiveInput) {
          console.log('[Automation] Requesting sensitive input for step', i + 1);

          // Show input prompt directly in the playback window
          try {
            const userInput = await injectSensitiveInputPrompt(
              playbackWindow!,
              step.fieldLabel || step.selector,
              i + 1,
              steps.length
            );

            console.log('[Automation] Received sensitive input, length:', userInput.length);
            step.value = userInput;

            // Verify overlay is completely removed
            await playbackWindow!.webContents.executeJavaScript(`
              (function() {
                const overlay = document.getElementById('sensitive-input-overlay');
                if (overlay) {
                  overlay.remove();
                  console.log('[Automation] Force-removed lingering overlay');
                }
              })()
            `);

            // Wait for overlay to be fully removed and page to be interactive
            await new Promise(resolve => setTimeout(resolve, 800));
          } catch (error) {
            console.error('[Automation] Failed to get sensitive input:', error);
            throw new Error('Failed to get sensitive input from user');
          }
        }

        // Get current URL before executing step
        const urlBefore = playbackWindow.webContents.getURL();

        // Track if step execution succeeded
        let stepSucceeded = false;

        // Execute the step with error handling
        try {
          await executeStep(playbackWindow, step);
          stepSucceeded = true;
        } catch (error) {
          console.error(`[Automation] Step ${i + 1} failed:`, error instanceof Error ? error.message : String(error));

          // Check if navigation occurred during step execution (click succeeded, just interrupted)
          const urlAfterError = playbackWindow.webContents.getURL();
          if (urlBefore !== urlAfterError) {
            console.log(`[Automation] Navigation detected during step execution - treating as success`);
            console.log(`[Automation] ${urlBefore} -> ${urlAfterError}`);
            stepSucceeded = true;
            // Don't show error dialog, continue to navigation handling below
          }

          // Only show error dialog if step truly failed (no navigation occurred)
          if (!stepSucceeded) {
            // Show error in playback window and ask user what to do
            const userChoice = await playbackWindow.webContents.executeJavaScript(`
            (function() {
              return new Promise((resolve) => {
                // Remove any existing error dialog
                const existing = document.getElementById('step-error-dialog');
                if (existing) existing.remove();

                const dialog = document.createElement('div');
                dialog.id = 'step-error-dialog';
                dialog.innerHTML = \`
                  <style>
                    #step-error-dialog {
                      position: fixed;
                      top: 0;
                      left: 0;
                      right: 0;
                      bottom: 0;
                      z-index: 2147483648;
                      background: rgba(0, 0, 0, 0.9);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    }

                    #step-error-box {
                      background: white;
                      border-radius: 12px;
                      padding: 32px;
                      max-width: 600px;
                      width: 90%;
                      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                    }

                    #step-error-box h2 {
                      margin: 0 0 16px 0;
                      font-size: 24px;
                      color: #dc2626;
                    }

                    #step-error-box .error-details {
                      background: #fef2f2;
                      border: 1px solid #fecaca;
                      padding: 16px;
                      border-radius: 8px;
                      margin: 16px 0;
                      font-size: 13px;
                      color: #991b1b;
                      max-height: 200px;
                      overflow-y: auto;
                    }

                    #step-error-box .button-group {
                      display: flex;
                      gap: 12px;
                      margin-top: 24px;
                    }

                    #step-error-box button {
                      flex: 1;
                      padding: 12px 24px;
                      border: none;
                      border-radius: 8px;
                      font-size: 16px;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.2s;
                    }

                    #skip-btn {
                      background: #f59e0b;
                      color: white;
                    }

                    #skip-btn:hover {
                      background: #d97706;
                    }

                    #abort-btn {
                      background: #dc2626;
                      color: white;
                    }

                    #abort-btn:hover {
                      background: #b91c1c;
                    }
                  </style>

                  <div id="step-error-box">
                    <h2>⚠️ Step Failed</h2>
                    <p>Step ${i + 1} of ${steps.length} failed to execute.</p>
                    <div class="error-details">
                      <strong>Element:</strong> ${JSON.stringify(step.selector).slice(1, -1)}<br>
                      <strong>Action:</strong> ${step.type}<br>
                      <strong>Error:</strong> ${(error instanceof Error ? error.message : String(error)).replace(/</g, '&lt;')}
                    </div>
                    <p><strong>What would you like to do?</strong></p>
                    <div class="button-group">
                      <button id="skip-btn">Skip & Continue</button>
                      <button id="abort-btn">Abort Playback</button>
                    </div>
                  </div>
                \`;

                document.body.appendChild(dialog);

                document.getElementById('skip-btn').addEventListener('click', () => {
                  dialog.remove();
                  resolve('skip');
                });

                document.getElementById('abort-btn').addEventListener('click', () => {
                  dialog.remove();
                  resolve('abort');
                });
              });
            })()
          `);

            if (userChoice === 'abort') {
              throw error; // Re-throw to stop playback
            } else {
              console.log(`[Automation] User chose to skip step ${i + 1}, continuing...`);
              // Continue to next step
            }
          }
        }

        // Check if navigation occurred after ANY step (not just clicks)
        // Only check if we haven't already detected navigation during step execution
        if (stepSucceeded) {
          // Wait a bit to see if navigation starts
          await new Promise(resolve => setTimeout(resolve, 1500));

          const urlAfter = playbackWindow.webContents.getURL();
          if (urlBefore !== urlAfter) {
            console.log('[Automation] Navigation detected after', step.type, ':', urlBefore, '->', urlAfter);

          // Wait for page to fully load
          console.log('[Automation] Waiting for page to stop loading...');
          await new Promise((resolve) => {
            const checkLoading = () => {
              if (!playbackWindow || playbackWindow.isDestroyed()) {
                resolve(null);
                return;
              }
              if (!playbackWindow.webContents.isLoading()) {
                resolve(null);
              } else {
                setTimeout(checkLoading, 100);
              }
            };
            checkLoading();
          });

          console.log('[Automation] Page load complete, waiting for content to render...');

          // Wait for document.readyState to be complete
          await new Promise((resolve) => {
            const checkReadyState = async () => {
              if (!playbackWindow || playbackWindow.isDestroyed()) {
                resolve(null);
                return;
              }
              try {
                const isComplete = await playbackWindow.webContents.executeJavaScript(
                  'document.readyState === "complete"'
                );
                if (isComplete) {
                  resolve(null);
                } else {
                  setTimeout(checkReadyState, 100);
                }
              } catch (err) {
                resolve(null);
              }
            };
            checkReadyState();
          });

          // Wait additional time for JavaScript/AJAX to execute and render dynamic content
          console.log('[Automation] Document ready, waiting for dynamic content...');
          await new Promise(resolve => setTimeout(resolve, 3500));

          // Re-inject playback controls
          console.log('[Automation] Re-injecting playback controls after navigation');
          await injectPlaybackControls(playbackWindow);

          // Re-update progress after re-injection
          try {
            await playbackWindow.webContents.executeJavaScript(`
              if (window.updatePlaybackProgress) {
                window.updatePlaybackProgress(${i + 1}, ${steps.length}, ${JSON.stringify(step)});
              }
            `);
            console.log('[Automation] Progress updated after re-injection');
          } catch (err) {
            console.log('[Automation] Could not update progress after re-injection');
          }

            console.log('[Automation] Navigation complete, continuing playback');
          }
        }

        // Wait between steps
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[Automation] Playback complete! Successfully executed all ${steps.length} steps.`);

      // Update progress one last time
      if (playbackWindow && !playbackWindow.isDestroyed()) {
        await playbackWindow.webContents.executeJavaScript(`
          if (window.updatePlaybackProgress) {
            const status = document.getElementById('playback-status');
            if (status) {
              status.textContent = 'Playback Complete! ✓';
              status.style.color = '#10b981';
            }
          }
        `).catch(() => {});
      }

      // Notify main window
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('automation:playback-complete');
      }

      // Keep window open for 3 seconds to show completion
      await new Promise(resolve => setTimeout(resolve, 3000));

      if (playbackWindow && !playbackWindow.isDestroyed()) {
        playbackWindow.close();
      }

      playbackWindow = null;
      playbackState = null;

      return { success: true };
    } catch (error) {
      console.error('[Automation] Playback failed:', error);
      console.error('[Automation] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

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
  let retries = 5; // Increased from 3 to 5 retries
  let lastError = null;

  console.log(`[executeStep] Starting execution for: ${selector} (${step.type})`);

  while (retries > 0) {
    try {
      let element = null;
      const retryNumber = 6 - retries;
      console.log(`[executeStep] Attempt ${retryNumber}/5 for: ${selector}`);

      // Wait for page to be ready before attempting
      if (window.webContents.isLoading()) {
        console.log(`[executeStep] Page is loading, waiting...`);
        await new Promise((resolve) => {
          const checkLoading = () => {
            if (!window || window.isDestroyed() || !window.webContents.isLoading()) {
              resolve(null);
            } else {
              setTimeout(checkLoading, 100);
            }
          };
          checkLoading();
        });
        console.log(`[executeStep] Page loaded, continuing...`);
      }

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
              (async function() {
                const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                const labels = Array.from(document.querySelectorAll('label'));
                const label = labels.find(l => l.textContent.trim() === ${JSON.stringify(labelText)});
                if (label) {
                  const input = label.querySelector('input, textarea') ||
                               (label.getAttribute('for') && document.getElementById(label.getAttribute('for')));
                  if (input) {
                    // Focus first
                    input.focus();
                    await wait(200);

                    // Use native setter for framework compatibility
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                      window.HTMLInputElement.prototype,
                      'value'
                    ).set;
                    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                      window.HTMLTextAreaElement.prototype,
                      'value'
                    ).set;

                    const setter = input.tagName === 'TEXTAREA' ? nativeTextAreaValueSetter : nativeInputValueSetter;

                    // Clear first
                    setter.call(input, '');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    await wait(100);

                    // Set new value
                    setter.call(input, ${JSON.stringify(step.value)});

                    // Dispatch comprehensive events
                    input.dispatchEvent(new InputEvent('input', {
                      bubbles: true,
                      cancelable: true,
                      data: ${JSON.stringify(step.value)},
                      inputType: 'insertText'
                    }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
                    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

                    await wait(200);
                    input.blur();
                    await wait(300);
                  }
                }
              })()
            `);
          }
          return;
        }
      } else if (selector.startsWith('text:')) {
        // Find element by text content (format: text:ClassNameOrTag:Text Content)
        const parts = selector.substring(5).split(':', 2);
        const classOrTag = parts[0];
        const textContent = parts[1] || parts[0]; // If no colon, treat whole thing as text

        console.log(`[executeStep] Parsing text selector: class/tag="${classOrTag}", text="${textContent}"`);

        // Add timeout to prevent hanging
        const executeWithTimeout = (promise: Promise<any>, timeoutMs: number) => {
          return Promise.race([
            promise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('executeJavaScript timeout')), timeoutMs)
            )
          ]);
        };

        let result;
        try {
          result = await executeWithTimeout(
            window.webContents.executeJavaScript(`
          (async function() {
            const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            // Determine if it's a tag name or class name
            const isTagName = ${JSON.stringify(['button', 'a', 'div', 'span', 'input', 'select', 'textarea'].includes(classOrTag.toLowerCase()))};
            const selector = isTagName ? ${JSON.stringify(classOrTag)} : ${JSON.stringify(classOrTag.startsWith('.') ? classOrTag : '.' + classOrTag)};

            console.log('[executeStep-page] Looking for selector:', selector);
            const elements = Array.from(document.querySelectorAll(selector));
            console.log('[executeStep-page] Found', elements.length, 'elements with selector');

            // Log what we found
            if (elements.length > 0) {
              console.log('[executeStep-page] Element texts:', elements.map(el => el.textContent?.trim().substring(0, 50)));
            }

            // Find the one with matching text content
            const element = elements.find(el => el.textContent?.trim() === ${JSON.stringify(textContent)});

            if (element) {
              console.log('[executeStep-page] Found matching element!');
              if (${JSON.stringify(step.type)} === 'click') {
                console.log('[executeStep-page] Scrolling element into view...');
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await wait(500);
                console.log('[executeStep-page] Clicking element...');
                element.click();
                console.log('[executeStep-page] Click completed!');
                await wait(500);
              }
              return { success: true };
            }
            console.log('[executeStep-page] No element found with exact text match:', ${JSON.stringify(textContent)});
            return { success: false, elementCount: elements.length };
          })()
        `),
            10000  // 10 second timeout (increased from 5)
          );
        } catch (error) {
          console.error(`[executeStep] executeJavaScript failed:`, error instanceof Error ? error.message : error);
          result = { success: false, elementCount: 0 };
        }

        console.log(`[executeStep] Result:`, result);

        if (result.success) {
          return;
        } else {
          console.log(`[executeStep] Failed: found ${result.elementCount} elements with class/tag, but none matched text`);
        }
      } else if (selector.startsWith('placeholder:')) {
        const placeholder = selector.substring(12);
        if (step.type === 'input') {
          const found = await window.webContents.executeJavaScript(`
            (async function() {
              const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
              const input = document.querySelector('[placeholder=${JSON.stringify(placeholder)}]');
              if (input) {
                // Focus first
                input.focus();
                await wait(200);

                // Use native setter for framework compatibility
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                  window.HTMLInputElement.prototype,
                  'value'
                ).set;
                const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                  window.HTMLTextAreaElement.prototype,
                  'value'
                ).set;

                const setter = input.tagName === 'TEXTAREA' ? nativeTextAreaValueSetter : nativeInputValueSetter;

                // Clear first
                setter.call(input, '');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                await wait(100);

                // Set new value
                setter.call(input, ${JSON.stringify(step.value)});

                // Dispatch comprehensive events
                input.dispatchEvent(new InputEvent('input', {
                  bubbles: true,
                  cancelable: true,
                  data: ${JSON.stringify(step.value)},
                  inputType: 'insertText'
                }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

                await wait(200);
                input.blur();
                await wait(300);

                return true;
              }
              return false;
            })()
          `);
          if (found) {
            return;
          }
        }
      } else {
        // Standard CSS selector

        // Special handling: if selector points to an option element, extract value and select on parent
        if (selector.includes('option')) {
          console.log('[executeStep] Detected option selector, extracting value...');
          const result = await window.webContents.executeJavaScript(`
            (function() {
              const option = document.querySelector(${JSON.stringify(selector)});
              if (!option) return { found: false };

              const select = option.closest('select');
              if (!select) return { found: false };

              // Set the select to this option's value
              select.value = option.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));

              return {
                found: true,
                selectId: select.id,
                optionValue: option.value,
                optionText: option.textContent.trim()
              };
            })()
          `);

          if (result.found) {
            console.log(`[executeStep] Selected option: "${result.optionText}" (value: ${result.optionValue}) in select#${result.selectId}`);
            return;
          }
        }

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
              (async function() {
                const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                const el = document.querySelector(${JSON.stringify(selector)});
                if (el) {
                  // Focus first
                  el.focus();
                  await wait(200);

                  // Use native setter for framework compatibility
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    'value'
                  ).set;
                  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype,
                    'value'
                  ).set;

                  const setter = el.tagName === 'TEXTAREA' ? nativeTextAreaValueSetter : nativeInputValueSetter;

                  // Clear first
                  setter.call(el, '');
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  await wait(100);

                  // Set new value
                  setter.call(el, ${JSON.stringify(step.value)});

                  // Dispatch comprehensive events
                  el.dispatchEvent(new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    data: ${JSON.stringify(step.value)},
                    inputType: 'insertText'
                  }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
                  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

                  await wait(200);
                  el.blur();
                  await wait(300);
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

      // Log diagnostic information about what's on the page
      const diagnostics = await window.webContents.executeJavaScript(`
        (function() {
          const inputs = Array.from(document.querySelectorAll('input, textarea'));
          const selects = Array.from(document.querySelectorAll('select'));
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));

          return {
            url: window.location.href,
            title: document.title,
            readyState: document.readyState,
            totalInputs: inputs.length,
            visibleInputs: inputs.filter(el => el.offsetParent !== null).length,
            totalSelects: selects.length,
            visibleSelects: selects.filter(el => el.offsetParent !== null).length,
            totalButtons: buttons.length,
            inputs: inputs.slice(0, 5).map(el => ({
              type: el.type,
              name: el.name,
              placeholder: el.placeholder,
              id: el.id,
              visible: el.offsetParent !== null
            })),
            selects: selects.map(el => ({
              name: el.name,
              id: el.id,
              options: el.options.length,
              visible: el.offsetParent !== null,
              disabled: el.disabled
            })),
            buttons: buttons.slice(0, 5).map(el => ({
              text: el.textContent?.trim().substring(0, 30),
              type: el.type,
              id: el.id,
              visible: el.offsetParent !== null
            }))
          };
        })()
      `);

      console.log('[Automation] Page diagnostics:');
      console.log('  URL:', diagnostics.url);
      console.log('  Title:', diagnostics.title);
      console.log('  Ready State:', diagnostics.readyState);
      console.log('  Inputs:', diagnostics.totalInputs, '(', diagnostics.visibleInputs, 'visible)');
      console.log('  Selects:', diagnostics.totalSelects, '(', diagnostics.visibleSelects, 'visible)');
      console.log('  Buttons:', diagnostics.totalButtons);
      if (diagnostics.selects.length > 0) {
        console.log('  Available select elements:', diagnostics.selects);
      }
      if (diagnostics.inputs.length > 0) {
        console.log('  Sample inputs:', diagnostics.inputs);
      }
      throw new Error(`Element not found: ${selector} (type: ${step.type})`);
    } catch (error) {
      lastError = error;
      retries--;
      const attemptNum = 6 - retries;
      console.log(`[Automation] Step execution failed, retry ${attemptNum}/5:`, {
        selector: step.selector,
        type: step.type,
        error: error instanceof Error ? error.message : String(error)
      });
      if (retries > 0) {
        // Increase wait time progressively: 1s, 1.5s, 2s, 2.5s, 3s
        const waitTime = 1000 + (attemptNum * 500);
        console.log(`[Automation] Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  console.error('[Automation] Step execution failed after all retries:', {
    selector: step.selector,
    type: step.type,
    element: step.element,
    error: lastError instanceof Error ? lastError.message : String(lastError)
  });
  throw new Error(`Failed to execute step after 5 retries: ${lastError}`);
}
