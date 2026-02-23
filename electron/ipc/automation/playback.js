import { extractIdentification, generateElementFinderScript } from './element-finder';
import { generateConfidenceElementFinderScript } from './element-finder-v2';
import { getDatabase } from '../../db';
import { getAutomationSettings } from '../../db/queries/automation-settings';
// Track the last known URL to detect navigation
let lastPageUrl = null;
let pageJustLoaded = false;
/**
 * Reset page tracking state (call this when starting a new playback)
 */
export function resetPageTracking() {
    lastPageUrl = null;
    pageJustLoaded = true;
    console.log('[executeStep] Page tracking reset');
}
/**
 * Execute a single automation step with retry logic
 * Uses text-based identification with coordinate fallback for resilient playback
 */
export async function executeStep(window, step) {
    const db = getDatabase();
    const settings = getAutomationSettings(db);
    const maxAttempts = settings.retry_attempts;
    const baseDelay = settings.retry_delay_ms;
    // Track URL changes to detect navigation
    const currentUrl = window.webContents.getURL();
    if (currentUrl !== lastPageUrl) {
        console.log('[executeStep] Page changed, marking as fresh load');
        pageJustLoaded = true;
        lastPageUrl = currentUrl;
    }
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await executeStepInternal(window, step);
            // After successful step on same page, it's no longer a fresh load
            if (pageJustLoaded) {
                pageJustLoaded = false;
            }
            return; // Success!
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`[executeStep] Attempt ${attempt}/${maxAttempts} failed:`, errorMessage);
            if (attempt === maxAttempts) {
                // Last attempt failed
                throw new Error(`Failed after ${maxAttempts} attempts: ${errorMessage}`);
            }
            // Exponential backoff: 2s, 4s, 8s, etc.
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`[executeStep] Waiting ${delay}ms before retry...`);
            await wait(delay);
            // Check if page is still responsive
            const isResponsive = await checkPageResponsive(window);
            if (!isResponsive) {
                throw new Error('Page became unresponsive');
            }
        }
    }
}
/**
 * Internal step execution without retry logic
 */
async function executeStepInternal(window, step) {
    if (!window || window.isDestroyed()) {
        throw new Error('Window is destroyed');
    }
    console.log(`[executeStep] Executing ${step.type}`);
    // Extract identification data (handles both old and new recording formats)
    const identification = extractIdentification(step);
    // CLICK
    if (step.type === 'click') {
        await executeClickStep(window, identification);
        // Wait for navigation/page load after clicks
        await waitForPageLoad(window, 5000);
        return;
    }
    // INPUT
    if (step.type === 'input') {
        // Wait for element to appear before trying to input
        await waitForElement(window, identification, 10000);
        await executeInputStep(window, identification, step.value);
        return;
    }
    // SELECT
    if (step.type === 'select') {
        // Wait for element to appear before trying to select
        await waitForElement(window, identification, 10000);
        await executeSelectStep(window, identification, step.value);
        return;
    }
    // If we get here, unsupported step type
    throw new Error(`Unsupported step type: ${step.type}`);
}
/**
 * Execute a click step using text-based identification with coordinate fallback
 */
async function executeClickStep(window, identification) {
    console.log(`[executeStep] Finding element to click using text-based identification`);
    // Only restore scroll position if we're on the same page (not just after navigation)
    // This prevents interfering with natural page load scroll behavior
    if (identification.viewport && !pageJustLoaded) {
        const currentScroll = await window.webContents.executeJavaScript('window.scrollY');
        const targetScroll = identification.viewport.scrollY || 0;
        if (Math.abs(currentScroll - targetScroll) > 100) {
            console.log(`[executeStep] Restoring scroll position: ${currentScroll}px -> ${targetScroll}px`);
            await window.webContents.executeJavaScript(`
        window.scrollTo({
          top: ${targetScroll},
          left: ${identification.viewport.scrollX || 0},
          behavior: 'instant'
        });
      `);
            await wait(300);
        }
    }
    else if (pageJustLoaded) {
        console.log(`[executeStep] Skipping scroll restoration - page just loaded`);
    }
    try {
        // Use confidence-based finder for more reliable matching
        const finderScript = generateConfidenceElementFinderScript(identification);
        const result = await window.webContents.executeJavaScript(`
      (function() {
        // Capture console logs to return them
        const logs = [];
        const originalLog = console.log;
        const originalError = console.error;
        console.log = (...args) => {
          logs.push({ level: 'log', message: args.join(' ') });
          originalLog.apply(console, args);
        };
        console.error = (...args) => {
          logs.push({ level: 'error', message: args.join(' ') });
          originalError.apply(console, args);
        };

        try {
          // Find the element with confidence scoring
          const element = ${finderScript};

          // Restore console
          console.log = originalLog;
          console.error = originalError;

          if (!element) {
            return {
              success: false,
              error: 'No high-confidence element match found (confidence < 70%)',
              logs: logs,
              pageUrl: window.location.href,
              pageTitle: document.title
            };
          }

          console.log('[Click] Found element:', element.tagName, element.textContent?.substring(0, 30));

          // Highlight element briefly for visual feedback
          const originalOutline = element.style.outline;
          element.style.outline = '3px solid #10b981';
          setTimeout(() => { element.style.outline = originalOutline; }, 500);

          // Scroll element into view if needed
          element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });

          // Wait a moment for scroll to complete
          setTimeout(() => {}, 100);

          // Click the element
          element.click();

          return {
            success: true,
            element: element.tagName,
            text: element.textContent?.substring(0, 50),
            href: element.getAttribute('href'),
            logs: logs
          };
        } catch (err) {
          console.log = originalLog;
          console.error = originalError;
          throw err;
        }
      })()
    `);
        // Log browser console output
        if (result.logs && result.logs.length > 0) {
            console.log(`[executeStep] Browser console output:`);
            for (const log of result.logs) {
                if (log.level === 'error') {
                    console.error(`  ${log.message}`);
                }
                else {
                    console.log(`  ${log.message}`);
                }
            }
        }
        if (result.success) {
            console.log(`[executeStep] ✓ Click succeeded on ${result.element} ("${result.text}")`);
            return;
        }
        else {
            throw new Error(result.error);
        }
    }
    catch (error) {
        console.log(`[executeStep] ❌ Click failed:`, error);
        throw new Error(`Click failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Execute click using coordinate-based mouse events (for cross-origin iframes)
 */
async function executeClickWithCoordinates(window, identification) {
    if (!identification.coordinates) {
        throw new Error('No coordinates available for coordinate-based click');
    }
    console.log('[executeStep] Using coordinate-based click (cross-origin iframe workaround)');
    const { x, y } = identification.coordinates;
    const { webContents } = window;
    // Only restore scroll position if we're on the same page (not just after navigation)
    if (identification.viewport && !pageJustLoaded) {
        const targetScrollY = identification.viewport.scrollY || 0;
        console.log(`[executeStep] Scrolling to recorded position: ${targetScrollY}px`);
        await webContents.executeJavaScript(`
      window.scrollTo({
        top: ${targetScrollY},
        left: ${identification.viewport.scrollX || 0},
        behavior: 'instant'
      });
    `);
        await wait(500); // Wait for scroll to complete
    }
    else if (pageJustLoaded) {
        console.log(`[executeStep] Skipping scroll restoration - page just loaded`);
    }
    // Perform mouse click at coordinates
    await webContents.sendInputEvent({
        type: 'mouseDown',
        x: Math.round(x),
        y: Math.round(y),
        button: 'left',
        clickCount: 1,
    });
    await wait(50);
    await webContents.sendInputEvent({
        type: 'mouseUp',
        x: Math.round(x),
        y: Math.round(y),
        button: 'left',
        clickCount: 1,
    });
    console.log('[executeStep] ✓ Coordinate-based click complete');
}
/**
 * Execute input using coordinate-based clicking (for cross-origin iframes)
 */
async function executeInputWithCoordinates(window, identification, value) {
    if (!identification.coordinates) {
        throw new Error('No coordinates available for coordinate-based input');
    }
    console.log('[executeStep] Using coordinate-based input (cross-origin iframe workaround)');
    const { x, y } = identification.coordinates;
    const { webContents } = window;
    // Only restore scroll position if we're on the same page (not just after navigation)
    if (identification.viewport && !pageJustLoaded) {
        const targetScrollY = identification.viewport.scrollY || 0;
        console.log(`[executeStep] Scrolling to recorded position: ${targetScrollY}px`);
        await webContents.executeJavaScript(`
      window.scrollTo({
        top: ${targetScrollY},
        left: ${identification.viewport.scrollX || 0},
        behavior: 'instant'
      });
    `);
        await wait(500); // Wait for scroll to complete
    }
    else if (pageJustLoaded) {
        console.log(`[executeStep] Skipping scroll restoration - page just loaded`);
    }
    // Click at coordinates to focus the input
    await webContents.sendInputEvent({
        type: 'mouseDown',
        x: Math.round(x),
        y: Math.round(y),
        button: 'left',
        clickCount: 1,
    });
    await wait(50);
    await webContents.sendInputEvent({
        type: 'mouseUp',
        x: Math.round(x),
        y: Math.round(y),
        button: 'left',
        clickCount: 1,
    });
    await wait(200);
    // Clear any existing value (select all + delete)
    await webContents.sendInputEvent({
        type: 'keyDown',
        keyCode: 'A',
        modifiers: process.platform === 'darwin' ? ['meta'] : ['control'],
    });
    await wait(50);
    await webContents.sendInputEvent({
        type: 'keyUp',
        keyCode: 'A',
        modifiers: process.platform === 'darwin' ? ['meta'] : ['control'],
    });
    await wait(50);
    // Type the value character by character
    if (value) {
        for (const char of value) {
            await webContents.sendInputEvent({
                type: 'char',
                keyCode: char,
            });
            await wait(50); // Realistic typing speed
        }
    }
    console.log('[executeStep] ✓ Coordinate-based input complete');
}
/**
 * Execute an input step using text-based identification with coordinate fallback
 */
async function executeInputStep(window, identification, value) {
    console.log(`[executeStep] Finding input element using text-based identification`);
    console.log(`[executeStep] Identification data:`, JSON.stringify(identification, null, 2));
    try {
        // Use confidence-based finder for more reliable matching
        const finderScript = generateConfidenceElementFinderScript(identification);
        console.log(`[executeStep] Executing confidence-based element finder in browser...`);
        const result = await window.webContents.executeJavaScript(`
      (async function() {
        // Find the element with confidence scoring
        const element = ${finderScript};

        if (!element) {
          console.log('[Input] No high-confidence element match found');
          return {
            success: false,
            error: 'No high-confidence input element match found (confidence < 70%)',
            pageUrl: window.location.href,
            pageTitle: document.title,
            inputCount: document.querySelectorAll('input').length,
            textareaCount: document.querySelectorAll('textarea').length
          };
        }

        console.log('[Input] Found element:', element.tagName, element.placeholder);

        if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
          console.log('[Input] Found element but wrong type:', element.tagName);
          return { success: false, error: 'Element is not an input: ' + element.tagName };
        }

        // Highlight briefly
        const originalOutline = element.style.outline;
        element.style.outline = '3px solid #10b981';
        setTimeout(() => { element.style.outline = originalOutline; }, 500);

        // Focus and scroll into view
        element.focus();
        element.scrollIntoView({ behavior: 'auto', block: 'center' });

        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        await wait(200);

        // Clear and set value using native setter for React compatibility
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        ).set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        ).set;

        const setter = element.tagName === 'TEXTAREA' ? nativeTextAreaValueSetter : nativeInputValueSetter;

        // Clear first
        setter.call(element, '');
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(100);

        // Set new value
        setter.call(element, ${JSON.stringify(value)});

        // Dispatch comprehensive events
        element.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: ${JSON.stringify(value)},
          inputType: 'insertText'
        }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));

        return { success: true };
      })()
    `);
        console.log(`[executeStep] Browser script result:`, JSON.stringify(result, null, 2));
        if (result.success) {
            console.log(`[executeStep] ✓ Input succeeded`);
            return;
        }
        else {
            if (result.pageUrl) {
                console.log(`[executeStep] ❌ Element search failed on page: ${result.pageUrl}`);
                console.log(`[executeStep] Page title: "${result.pageTitle}"`);
            }
            if (result.strategiesAttempted) {
                console.log(`[executeStep] Strategies attempted: ${result.strategiesAttempted.join(', ')}`);
            }
            if (result.inputCount !== undefined) {
                console.log(`[executeStep] Page has ${result.inputCount} input elements and ${result.textareaCount} textarea elements`);
                // Helpful hint if page has no inputs
                if (result.inputCount === 0 && result.textareaCount === 0) {
                    console.log(`[executeStep] 💡 Tip: The page might still be loading, or inputs might be in an iframe/shadow DOM.`);
                    // Get detailed diagnostics
                    const diagnostics = await getPageDiagnostics(window);
                    console.log(diagnostics);
                    // Check if we have coordinates and if iframes are blocked
                    if (identification.coordinates && diagnostics.includes('Blocked a frame')) {
                        console.log('[executeStep] 🔄 Cross-origin iframe detected - falling back to coordinate-based input');
                        await executeInputWithCoordinates(window, identification, value);
                        return;
                    }
                }
            }
            throw new Error(result.error);
        }
    }
    catch (error) {
        console.log(`[executeStep] ❌ Input failed:`, error);
        // Last resort: try coordinate-based input if we have coordinates
        if (identification.coordinates && error instanceof Error && error.message.includes('No input element found')) {
            console.log('[executeStep] 🔄 Final fallback: coordinate-based input');
            try {
                await executeInputWithCoordinates(window, identification, value);
                return;
            }
            catch (coordError) {
                console.log('[executeStep] Coordinate-based input also failed:', coordError);
            }
        }
        throw new Error(`Input failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Execute a select step using text-based identification with coordinate fallback
 */
async function executeSelectStep(window, identification, value) {
    console.log(`[executeStep] Finding select element using confidence-based identification`);
    try {
        // Use confidence-based finder for more reliable matching
        const finderScript = generateConfidenceElementFinderScript(identification);
        const result = await window.webContents.executeJavaScript(`
      (async function() {
        // Find the element with confidence scoring
        const element = ${finderScript};

        if (!element) {
          return { success: false, error: 'No high-confidence select element match found (confidence < 70%)' };
        }

        if (element.tagName !== 'SELECT') {
          return { success: false, error: 'Element is not a select: ' + element.tagName };
        }

        console.log('[Select] Found element:', element.tagName);

        // Highlight briefly
        const originalOutline = element.style.outline;
        element.style.outline = '3px solid #10b981';
        setTimeout(() => { element.style.outline = originalOutline; }, 500);

        // Focus and scroll into view
        element.focus();
        element.scrollIntoView({ behavior: 'auto', block: 'center' });

        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        await wait(200);

        // Set value
        element.value = ${JSON.stringify(value)};
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));

        return { success: true };
      })()
    `);
        if (result.success) {
            console.log(`[executeStep] ✓ Select succeeded`);
            return;
        }
        else {
            throw new Error(result.error);
        }
    }
    catch (error) {
        console.log(`[executeStep] ❌ Select failed:`, error);
        throw new Error(`Select failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Wait for a specified number of milliseconds
 */
function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Check if the page is still responsive
 */
async function checkPageResponsive(window) {
    if (!window || window.isDestroyed()) {
        return false;
    }
    try {
        await window.webContents.executeJavaScript('1 + 1', true);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Wait for page to finish loading after navigation
 */
async function waitForPageLoad(window, timeout = 5000) {
    if (!window || window.isDestroyed()) {
        return;
    }
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            const isLoading = await window.webContents.executeJavaScript(`
        document.readyState !== 'complete'
      `);
            if (!isLoading) {
                // Page is loaded, wait a bit more for any dynamic content
                await wait(500);
                console.log('[executeStep] Page load complete');
                return;
            }
            await wait(100);
        }
        catch (error) {
            // Page might be navigating, wait and retry
            await wait(200);
        }
    }
    console.log('[executeStep] Page load timeout, continuing anyway');
}
/**
 * Get diagnostic info about the current page
 */
async function getPageDiagnostics(window) {
    try {
        const diagnostics = await window.webContents.executeJavaScript(`
      (function() {
        const iframes = document.querySelectorAll('iframe');
        const inputs = document.querySelectorAll('input:not([type="hidden"])');
        const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"]');

        const iframeInfo = Array.from(iframes).map((iframe, i) => {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc) {
              const iframeInputs = doc.querySelectorAll('input:not([type="hidden"])').length;
              const iframeButtons = doc.querySelectorAll('button, [role="button"]').length;
              return \`Iframe #\${i + 1}: \${iframeInputs} inputs, \${iframeButtons} buttons (src: \${iframe.src || 'none'})\`;
            } else {
              return \`Iframe #\${i + 1}: Cross-origin (cannot access) - src: \${iframe.src}\`;
            }
          } catch (err) {
            return \`Iframe #\${i + 1}: Error - \${err.message}\`;
          }
        });

        return {
          url: window.location.href,
          title: document.title,
          inputs: inputs.length,
          buttons: buttons.length,
          iframes: iframes.length,
          iframeDetails: iframeInfo
        };
      })()
    `);
        let report = `\nPage Diagnostics:
  URL: ${diagnostics.url}
  Title: ${diagnostics.title}
  Main page: ${diagnostics.inputs} inputs, ${diagnostics.buttons} buttons
  Iframes: ${diagnostics.iframes}`;
        if (diagnostics.iframeDetails && diagnostics.iframeDetails.length > 0) {
            report += '\n  ' + diagnostics.iframeDetails.join('\n  ');
        }
        return report;
    }
    catch (error) {
        return 'Could not get page diagnostics';
    }
}
/**
 * Wait for an element to appear on the page (including iframes)
 */
async function waitForElement(window, identification, timeout = 10000) {
    if (!window || window.isDestroyed()) {
        throw new Error('Window is destroyed');
    }
    console.log('[executeStep] Waiting for element to appear...');
    const startTime = Date.now();
    const finderScript = generateElementFinderScript(identification);
    let lastIframeCount = -1;
    while (Date.now() - startTime < timeout) {
        try {
            const result = await window.webContents.executeJavaScript(`
        (function() {
          const element = ${finderScript};
          const iframeCount = document.querySelectorAll('iframe').length;
          return {
            found: element !== null && element !== undefined,
            iframeCount: iframeCount
          };
        })()
      `);
            if (result.found) {
                console.log('[executeStep] ✓ Element found, proceeding...');
                return;
            }
            // Log iframe info on first check or when iframe count changes
            if (result.iframeCount !== lastIframeCount) {
                console.log(`[executeStep] Waiting... (${result.iframeCount} iframe(s) detected)`);
                lastIframeCount = result.iframeCount;
            }
            // Not found yet, wait and retry
            await wait(500);
        }
        catch (error) {
            // Error executing script, wait and retry
            await wait(500);
        }
    }
    // Timeout reached, log warning but don't throw (retry logic will handle it)
    console.log('[executeStep] ⚠️ Element wait timeout after 10s, attempting anyway...');
}
