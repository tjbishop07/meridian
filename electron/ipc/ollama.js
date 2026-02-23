import { ipcMain, shell } from 'electron';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
let mainWindow = null;
export function setMainWindow(window) {
    mainWindow = window;
}
export function registerOllamaHandlers() {
    // Check Ollama installation and status
    ipcMain.handle('ollama:check-status', async () => {
        return await checkOllamaStatus();
    });
    // Check if Homebrew is installed
    ipcMain.handle('ollama:check-homebrew', async () => {
        try {
            await execAsync('which brew');
            return { installed: true };
        }
        catch {
            return { installed: false };
        }
    });
    // Open Homebrew installation page
    ipcMain.handle('ollama:open-homebrew-install', async () => {
        const { shell } = await import('electron');
        await shell.openExternal('https://brew.sh');
        return { success: true };
    });
    // Install Ollama via Homebrew (with progress streaming)
    ipcMain.handle('ollama:install', async () => {
        try {
            console.log('[Ollama] Installing via Homebrew...');
            // Start the install process
            const installProcess = exec('brew install ollama');
            // Stream output to renderer for progress
            installProcess.stdout?.on('data', (data) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('ollama:install-progress', data.toString());
                }
            });
            installProcess.stderr?.on('data', (data) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('ollama:install-progress', data.toString());
                }
            });
            // Wait for completion
            await new Promise((resolve, reject) => {
                installProcess.on('exit', (code) => {
                    if (code === 0)
                        resolve(true);
                    else
                        reject(new Error(`Installation failed with code ${code}`));
                });
            });
            return { success: true };
        }
        catch (error) {
            console.error('[Ollama] Install failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Start Ollama server
    ipcMain.handle('ollama:start-server', async () => {
        try {
            console.log('[Ollama] Starting server...');
            // Start in background (don't wait for it to exit)
            exec('ollama serve > /dev/null 2>&1 &');
            // Wait a bit for server to start
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Verify it's running
            const isRunning = await checkServerRunning();
            return { success: isRunning };
        }
        catch (error) {
            console.error('[Ollama] Start server failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Pull a vision model
    ipcMain.handle('ollama:pull-model', async (_, modelName) => {
        try {
            console.log('[Ollama] Pulling model:', modelName);
            // Use spawn for better streaming (exec buffers output)
            const pullProcess = spawn('ollama', ['pull', modelName], {
                env: {
                    ...process.env,
                    // Force unbuffered output
                    TERM: 'xterm-256color',
                },
            });
            // Stream stdout to renderer for progress
            pullProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                console.log('[Ollama] Pull stdout:', output);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('ollama:pull-progress', output);
                }
            });
            // Stream stderr to renderer as well (ollama might use stderr for progress)
            pullProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                console.log('[Ollama] Pull stderr:', output);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('ollama:pull-progress', output);
                }
            });
            // Wait for completion
            await new Promise((resolve, reject) => {
                pullProcess.on('exit', (code) => {
                    if (code === 0) {
                        console.log('[Ollama] Pull completed successfully');
                        resolve(true);
                    }
                    else {
                        console.error('[Ollama] Pull failed with code:', code);
                        reject(new Error(`Pull failed with code ${code}`));
                    }
                });
                pullProcess.on('error', (err) => {
                    console.error('[Ollama] Pull process error:', err);
                    reject(err);
                });
            });
            return { success: true };
        }
        catch (error) {
            console.error('[Ollama] Pull model failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Open Ollama download page
    ipcMain.handle('ollama:open-download-page', async () => {
        await shell.openExternal('https://ollama.ai/download');
        return { success: true };
    });
    // Generate completion with vision
    ipcMain.handle('ollama:generate', async (_, options) => {
        try {
            console.log('[Ollama] Generating with model:', options.model);
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: options.model,
                    prompt: options.prompt,
                    images: options.images || [],
                    stream: false,
                }),
            });
            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }
            const data = await response.json();
            return { success: true, response: data.response };
        }
        catch (error) {
            console.error('[Ollama] Generate failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
}
async function checkOllamaStatus() {
    const status = {
        installed: false,
        running: false,
        hasVisionModel: false,
        availableModels: [],
    };
    try {
        // Check if Ollama is installed
        await execAsync('which ollama');
        status.installed = true;
        console.log('[Ollama] ✓ Installed');
    }
    catch {
        console.log('[Ollama] ✗ Not installed');
        return status;
    }
    // Check if server is running
    status.running = await checkServerRunning();
    if (!status.running) {
        console.log('[Ollama] ✗ Server not running');
        return status;
    }
    // Check available models
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (response.ok) {
            const data = await response.json();
            status.availableModels = data.models?.map((m) => m.name) || [];
            // Check for AI models (text or vision)
            // Use precise matching to avoid false positives (e.g., llama3.2-vision matching llama3.2)
            const aiModels = ['llama3.2', 'llama3.2-vision', 'llava', 'bakllava', 'mistral'];
            status.hasVisionModel = status.availableModels.some(model => {
                const modelBaseName = model.split(':')[0]; // Remove tag like ":latest"
                return aiModels.includes(modelBaseName);
            });
            console.log('[Ollama] Available models:', status.availableModels);
            console.log('[Ollama] Has vision model:', status.hasVisionModel);
        }
    }
    catch (error) {
        console.error('[Ollama] Failed to check models:', error);
    }
    return status;
}
export async function checkServerRunning() {
    try {
        const response = await fetch('http://localhost:11434/api/tags', {
            signal: AbortSignal.timeout(2000),
        });
        return response.ok;
    }
    catch {
        return false;
    }
}
