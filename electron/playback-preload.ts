import { contextBridge, ipcRenderer } from 'electron';

// Inject playback progress overlay
window.addEventListener('DOMContentLoaded', () => {
  const overlay = document.createElement('div');
  overlay.id = 'playback-controls';
  overlay.innerHTML = `
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
        transition: all 0.2s;
      }

      #cancel-playback:hover {
        background: rgba(255,255,255,0.3);
        border-color: rgba(255,255,255,0.4);
      }

      #progress-bar-container {
        width: 100%;
        height: 10px;
        background: rgba(255,255,255,0.25);
        border-radius: 5px;
        overflow: hidden;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
      }

      #progress-bar {
        height: 100%;
        background: white;
        border-radius: 5px;
        transition: width 0.3s ease;
        width: 0%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }

      .element-highlight {
        outline: 3px solid #fbbf24 !important;
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.3) !important;
        animation: highlight-pulse 1s ease-in-out;
      }

      @keyframes highlight-pulse {
        0%, 100% {
          outline-color: #fbbf24;
        }
        50% {
          outline-color: #f59e0b;
        }
      }
    </style>

    <div id="playback-controls-inner">
      <div id="playback-header">
        <div id="playback-status">Step 0 of 0: Starting...</div>
        <button id="cancel-playback">Cancel</button>
      </div>
      <div id="progress-bar-container">
        <div id="progress-bar"></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Cancel button
  document.getElementById('cancel-playback')?.addEventListener('click', () => {
    window.close();
  });
});

// Expose API to update progress
contextBridge.exposeInMainWorld('updatePlaybackProgress', (
  currentStep: number,
  totalSteps: number,
  step: any
) => {
  const statusEl = document.getElementById('playback-status');
  const progressBar = document.getElementById('progress-bar');

  if (statusEl) {
    const action = step.type === 'click' ? 'Clicking' :
                   step.type === 'input' ? 'Typing in' :
                   step.type === 'select' ? 'Selecting' : 'Executing';

    const target = step.selector.startsWith('label:') ?
                   step.selector.substring(6) :
                   step.selector.startsWith('placeholder:') ?
                   step.selector.substring(12) :
                   step.text || step.selector;

    statusEl.textContent = `Step ${currentStep} of ${totalSteps}: ${action} "${target.substring(0, 50)}${target.length > 50 ? '...' : ''}"`;
  }

  if (progressBar) {
    const percentage = (currentStep / totalSteps) * 100;
    progressBar.style.width = `${percentage}%`;
  }

  // Highlight the element being interacted with
  highlightElement(step.selector);
});

function highlightElement(selector: string) {
  // Remove previous highlights
  document.querySelectorAll('.element-highlight').forEach(el => {
    el.classList.remove('element-highlight');
  });

  try {
    let element = null;

    if (selector.startsWith('label:')) {
      const labelText = selector.substring(6);
      const labels = Array.from(document.querySelectorAll('label'));
      const label = labels.find(l => l.textContent?.trim() === labelText);
      if (label) {
        element = label.querySelector('input, textarea, select') as HTMLElement ||
                  (label.getAttribute('for') ? document.getElementById(label.getAttribute('for')!) : null);
      }
    } else if (selector.startsWith('placeholder:')) {
      const placeholder = selector.substring(12);
      element = document.querySelector(`[placeholder="${placeholder}"]`) as HTMLElement;
    } else if (selector.startsWith('aria-label:')) {
      const ariaLabel = selector.substring(11);
      element = document.querySelector(`[aria-label="${ariaLabel}"]`) as HTMLElement;
    } else {
      element = document.querySelector(selector) as HTMLElement;
    }

    if (element) {
      element.classList.add('element-highlight');

      // Scroll element into view
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Remove highlight after animation
      setTimeout(() => {
        element?.classList.remove('element-highlight');
      }, 1500);
    }
  } catch (error) {
    console.error('Failed to highlight element:', error);
  }
}
