import { contextBridge, ipcRenderer } from 'electron';

// Inject controls overlay into recording window
window.addEventListener('DOMContentLoaded', () => {
  // Create overlay HTML
  const overlay = document.createElement('div');
  overlay.id = 'recording-controls';
  overlay.innerHTML = `
    <style>
      #recording-controls {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 999999;
        background: linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.75), transparent);
        padding: 16px 20px 40px 20px;
        pointer-events: none;
      }

      #recording-controls * {
        pointer-events: auto;
      }

      #recording-controls-inner {
        display: flex;
        align-items: center;
        gap: 16px;
        max-width: 1200px;
        margin: 0 auto;
      }

      #recording-status {
        color: #ef4444;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 140px;
      }

      #recording-indicator {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ef4444;
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.5;
          transform: scale(1.1);
        }
      }

      #recording-url {
        flex: 1;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        cursor: text;
      }

      #recording-url:focus {
        outline: none;
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.3);
      }

      .recording-btn {
        background: #3b82f6;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        transition: all 0.2s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }

      .recording-btn:hover {
        background: #2563eb;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      }

      .recording-btn:active {
        transform: translateY(0);
      }

      .recording-btn.recording {
        background: #10b981;
      }

      .recording-btn.recording:hover {
        background: #059669;
      }

      #stop-recording-btn {
        background: #ef4444;
      }

      #stop-recording-btn:hover {
        background: #dc2626;
      }

      #save-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        z-index: 1000000;
        align-items: center;
        justify-content: center;
      }

      #save-modal.visible {
        display: flex;
      }

      #save-modal-content {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      }

      #save-modal h2 {
        margin: 0 0 20px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 20px;
        color: #1f2937;
      }

      #save-modal label {
        display: block;
        margin-bottom: 6px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        color: #374151;
      }

      #save-modal input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        margin-bottom: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        box-sizing: border-box;
      }

      #save-modal input:focus {
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

      #save-modal button {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        transition: all 0.2s;
      }

      #save-modal-cancel {
        background: #e5e7eb;
        color: #374151;
      }

      #save-modal-cancel:hover {
        background: #d1d5db;
      }

      #save-modal-save {
        background: #3b82f6;
        color: white;
      }

      #save-modal-save:hover {
        background: #2563eb;
      }

      #save-modal-save:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }
    </style>

    <div id="recording-controls-inner">
      <div id="recording-status">
        <span id="recording-indicator"></span>
        <span id="recording-text">Ready</span>
      </div>
      <input
        id="recording-url"
        readonly
        value="${window.location.href}"
      />
      <button id="record-btn" class="recording-btn">Start Recording</button>
      <button id="stop-recording-btn" class="recording-btn" style="display: none;">Save Recording</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Create save modal
  const modal = document.createElement('div');
  modal.id = 'save-modal';
  modal.innerHTML = `
    <div id="save-modal-content">
      <h2>Save Recording</h2>
      <div>
        <label for="recording-name">Name</label>
        <input
          type="text"
          id="recording-name"
          placeholder="e.g., Download USAA Transactions"
          required
        />
      </div>
      <div>
        <label for="recording-institution">Institution (optional)</label>
        <input
          type="text"
          id="recording-institution"
          placeholder="e.g., USAA, Chase, Bank of America"
        />
      </div>
      <div id="save-modal-actions">
        <button id="save-modal-cancel">Cancel</button>
        <button id="save-modal-save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // State
  let isRecording = false;

  // Update URL display
  const urlInput = document.getElementById('recording-url') as HTMLInputElement;
  const updateUrl = () => {
    if (urlInput) {
      urlInput.value = window.location.href;
    }
  };

  // Watch for URL changes
  setInterval(updateUrl, 1000);

  // Record button
  const recordBtn = document.getElementById('record-btn');
  const stopBtn = document.getElementById('stop-recording-btn');
  const statusText = document.getElementById('recording-text');
  const indicator = document.getElementById('recording-indicator');

  recordBtn?.addEventListener('click', async () => {
    isRecording = !isRecording;

    if (isRecording) {
      // Start recording
      try {
        await (window as any).electron.startRecordingMode();
        recordBtn.textContent = 'Recording...';
        recordBtn.classList.add('recording');
        stopBtn!.style.display = 'block';
        statusText!.textContent = 'Recording';
      } catch (error) {
        console.error('Failed to start recording:', error);
        isRecording = false;
      }
    } else {
      // Stop recording (shouldn't reach here, stop button handles this)
      recordBtn.textContent = 'Start Recording';
      recordBtn.classList.remove('recording');
      stopBtn!.style.display = 'none';
      statusText!.textContent = 'Ready';
    }
  });

  // Stop button
  stopBtn?.addEventListener('click', () => {
    // Show save modal
    const saveModal = document.getElementById('save-modal');
    saveModal?.classList.add('visible');

    const nameInput = document.getElementById('recording-name') as HTMLInputElement;
    nameInput?.focus();
  });

  // Save modal actions
  const saveModalCancel = document.getElementById('save-modal-cancel');
  const saveModalSave = document.getElementById('save-modal-save');
  const saveModal = document.getElementById('save-modal');

  saveModalCancel?.addEventListener('click', () => {
    saveModal?.classList.remove('visible');
  });

  saveModalSave?.addEventListener('click', async () => {
    const nameInput = document.getElementById('recording-name') as HTMLInputElement;
    const institutionInput = document.getElementById('recording-institution') as HTMLInputElement;

    const name = nameInput.value.trim();
    const institution = institutionInput.value.trim() || null;

    if (!name) {
      alert('Please enter a name for the recording');
      return;
    }

    try {
      await (window as any).electron.saveRecording({ name, institution });
      saveModal?.classList.remove('visible');
    } catch (error) {
      console.error('Failed to save recording:', error);
      alert('Failed to save recording: ' + error);
    }
  });

  // Allow Enter to save
  const nameInput = document.getElementById('recording-name') as HTMLInputElement;
  nameInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveModalSave?.click();
    }
  });
});

// Expose API to renderer
contextBridge.exposeInMainWorld('electron', {
  startRecordingMode: () => ipcRenderer.invoke('automation:start-recording-mode'),
  saveRecording: (data: { name: string; institution: string | null }) =>
    ipcRenderer.invoke('automation:save-recording', data)
});
