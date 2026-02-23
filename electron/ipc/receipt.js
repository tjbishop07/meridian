import { ipcMain, app } from 'electron';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import sharp from 'sharp';
import { getDatabase } from '../db';
import * as receiptQueries from '../db/queries/receipts';
import { getAllCategories } from '../db/queries/categories';
import { getSetting } from '../db/queries/settings';
let mainWindow = null;
let server = null;
let sessionToken = null;
let serverTimeout = null;
export function setReceiptMainWindow(window) {
    mainWindow = window;
}
const DEFAULT_RECEIPT_PROMPT = `Analyze this receipt image and return ONLY a JSON object — no explanation, no markdown.

Available expense categories: {categories}

{
  "merchant": "store name or null",
  "date": "YYYY-MM-DD or null",
  "total": number or null,
  "tax": number or null,
  "items": [
    {
      "name": "item description",
      "amount": number,
      "category_name": "best match from category list, or null"
    }
  ]
}`;
function getReceiptsDir() {
    const dir = path.join(app.getPath('userData'), 'receipts');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}
function getLocalIp() {
    const ifaces = os.networkInterfaces();
    for (const iface of Object.values(ifaces)) {
        for (const entry of iface ?? []) {
            if (entry.family === 'IPv4' && !entry.internal) {
                return entry.address;
            }
        }
    }
    return null;
}
function generateToken() {
    return crypto.randomBytes(16).toString('hex');
}
function stopServer() {
    if (serverTimeout) {
        clearTimeout(serverTimeout);
        serverTimeout = null;
    }
    if (server) {
        server.close();
        server = null;
        sessionToken = null;
        console.log('[Receipt] HTTP server stopped');
    }
}
function getMobileCaptureHtml(token) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Capture Receipt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .wifi-banner {
      background: #854d0e;
      color: #fef08a;
      text-align: center;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 24px;
      gap: 24px;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #f1f5f9;
    }
    p.subtitle {
      font-size: 16px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.5;
    }
    .camera-btn-wrapper {
      position: relative;
      width: 100%;
      max-width: 320px;
    }
    label.camera-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 36px 24px;
      background: #16a34a;
      color: white;
      border-radius: 16px;
      font-size: 20px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    label.camera-btn:active { background: #15803d; }
    label.camera-btn svg { width: 56px; height: 56px; }
    input[type="file"] { display: none; }
    .status {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      text-align: center;
    }
    .status.show { display: flex; }
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid rgba(255,255,255,0.2);
      border-top-color: #4ade80;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status-text { font-size: 18px; font-weight: 500; color: #f1f5f9; }
    .status-sub { font-size: 14px; color: #94a3b8; }
    .success-icon { font-size: 64px; }
    .error-msg {
      color: #f87171;
      font-size: 16px;
      font-weight: 500;
      text-align: center;
    }
    .retry-btn {
      padding: 16px 32px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }
    .retry-btn:active { background: #2563eb; }
  </style>
</head>
<body>
  <div class="wifi-banner">
    📶 Your phone and computer must be on the same WiFi network
  </div>
  <div class="main">
    <div id="upload-ui">
      <h1>📄 Receipt</h1>
      <p class="subtitle">Tap below to take a photo of your receipt</p>
      <div class="camera-btn-wrapper" style="margin-top: 16px;">
        <label class="camera-btn" for="camera-input">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          Take Photo
        </label>
        <input type="file" id="camera-input" accept="image/*" capture="environment">
      </div>
    </div>

    <div id="status-uploading" class="status">
      <div class="spinner"></div>
      <span class="status-text">Uploading photo…</span>
      <span class="status-sub">Please wait</span>
    </div>

    <div id="status-done" class="status">
      <span class="success-icon">✅</span>
      <span class="status-text">Receipt captured!</span>
      <span class="status-sub">AI is analyzing it in the background.<br>You can close this page.</span>
    </div>

    <div id="status-error" class="status">
      <span class="success-icon">❌</span>
      <span class="error-msg" id="error-msg">Upload failed</span>
      <button class="retry-btn" onclick="location.reload()">Try Again</button>
    </div>
  </div>

  <script>
    const TOKEN = '${token}';
    const input = document.getElementById('camera-input');
    const uploadUi = document.getElementById('upload-ui');
    const statusUploading = document.getElementById('status-uploading');
    const statusDone = document.getElementById('status-done');
    const statusError = document.getElementById('status-error');
    const errorMsg = document.getElementById('error-msg');

    function showSection(id) {
      [uploadUi, statusUploading, statusDone, statusError].forEach(el => {
        el.style.display = el.id === id ? 'flex' : 'none';
      });
      if (id !== 'upload-ui') {
        document.getElementById(id).classList.add('show');
      }
    }

    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      showSection('status-uploading');

      try {
        const resp = await fetch('/upload?t=' + TOKEN, {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'image/jpeg' },
          body: file,
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || 'Upload failed');
        }

        showSection('status-done');
      } catch (err) {
        errorMsg.textContent = err.message || 'Upload failed. Please try again.';
        showSection('status-error');
      }
    });
  </script>
</body>
</html>`;
}
async function analyzeWithOllama(imagePath, prompt, model) {
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt,
            images: [base64Image],
            stream: false,
        }),
    });
    if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const text = data.response ?? '';
    return parseReceiptJson(text);
}
async function analyzeWithClaude(imagePath, prompt, apiKey) {
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/jpeg',
                                data: base64Image,
                            },
                        },
                        { type: 'text', text: prompt },
                    ],
                },
            ],
        }),
    });
    if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';
    return parseReceiptJson(text);
}
function parseReceiptJson(text) {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        return null;
    try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            merchant: parsed.merchant ?? null,
            date: parsed.date ?? null,
            total: typeof parsed.total === 'number' ? parsed.total : null,
            tax: typeof parsed.tax === 'number' ? parsed.tax : null,
            items: Array.isArray(parsed.items) ? parsed.items.map((item) => ({
                name: item.name ?? '',
                amount: typeof item.amount === 'number' ? item.amount : 0,
                category_id: null,
                category_name: item.category_name ?? null,
            })) : [],
        };
    }
    catch {
        return null;
    }
}
function matchCategories(data) {
    const categories = getAllCategories();
    const items = data.items.map((item) => {
        if (!item.category_name)
            return item;
        const lower = item.category_name.toLowerCase();
        const match = categories.find((c) => c.name.toLowerCase() === lower);
        return { ...item, category_id: match?.id ?? null };
    });
    return { ...data, items };
}
function fileToDataUrl(filePath) {
    try {
        const buf = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
        return `data:${mime};base64,${buf.toString('base64')}`;
    }
    catch {
        return null;
    }
}
async function preprocessReceiptImage(imagePath) {
    const tmpPath = imagePath + '.tmp';
    try {
        const imageData = fs.readFileSync(imagePath);
        // Step 1: Auto-orient from EXIF metadata (fixes phone portrait/landscape rotation)
        let buffer = await sharp(imageData).rotate().toBuffer();
        console.log('[Receipt] Step 1: auto-oriented');
        // Step 2: Try to trim background border using top-left corner pixel as reference.
        // trim() throws when no clear background is found — catch and skip.
        try {
            buffer = await sharp(buffer).trim({ threshold: 40 }).toBuffer();
            console.log('[Receipt] Step 2: background trimmed');
        }
        catch {
            console.log('[Receipt] Step 2: trim skipped (no clear uniform background)');
        }
        // Step 3: Normalize contrast + sharpen for better AI text recognition
        await sharp(buffer)
            .normalize()
            .sharpen({ sigma: 0.6 })
            .jpeg({ quality: 92 })
            .toFile(tmpPath);
        fs.renameSync(tmpPath, imagePath);
        console.log('[Receipt] Preprocessing complete');
    }
    catch (err) {
        console.warn('[Receipt] Preprocessing failed, using original:', err);
        try {
            fs.unlinkSync(tmpPath);
        }
        catch { /* noop */ }
    }
}
async function runReceiptPipeline(receiptId, imagePath) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        const imageDataUrl = fileToDataUrl(imagePath);
        mainWindow.webContents.send('receipt:analysis-progress', { step: 'preprocessing', imageDataUrl });
    }
    await preprocessReceiptImage(imagePath);
    await runAiAnalysis(receiptId, imagePath);
}
async function runAiAnalysis(receiptId, imagePath) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        const imageDataUrl = fileToDataUrl(imagePath);
        mainWindow.webContents.send('receipt:analysis-progress', { step: 'analyzing', imageDataUrl });
    }
    try {
        const aiModel = getSetting('receipt_ai_model') ?? 'ollama';
        const ollamaModel = getSetting('receipt_ollama_model') ?? 'llama3.2-vision';
        const customPrompt = getSetting('receipt_prompt');
        const categories = getAllCategories();
        const categoryNames = categories.map((c) => c.name).join(', ');
        const promptTemplate = customPrompt || DEFAULT_RECEIPT_PROMPT;
        const prompt = promptTemplate.replace('{categories}', categoryNames);
        let extracted = null;
        let modelUsed = aiModel;
        if (aiModel === 'ollama') {
            try {
                extracted = await analyzeWithOllama(imagePath, prompt, ollamaModel);
                // modelUsed stays 'ollama' whether extraction succeeded or not
            }
            catch (ollamaErr) {
                console.warn('[Receipt] Ollama analysis failed:', ollamaErr);
                // No silent Claude fallback — user chose Ollama
            }
        }
        else {
            // Claude (primary)
            const db = getDatabase();
            const apiKey = db.prepare('SELECT value FROM automation_settings WHERE key = ?').get('claude_api_key')?.value ?? '';
            if (apiKey) {
                extracted = await analyzeWithClaude(imagePath, prompt, apiKey);
                modelUsed = 'claude';
            }
            else {
                console.warn('[Receipt] Claude selected but no API key configured');
            }
        }
        if (extracted) {
            extracted = matchCategories(extracted);
        }
        receiptQueries.updateReceiptExtractedData(receiptId, extracted ?? { merchant: null, date: null, total: null, tax: null, items: [] }, modelUsed);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('receipt:analysis-progress', { step: 'done' });
            mainWindow.webContents.send('receipt:uploaded', { receiptId, extractedData: extracted });
        }
    }
    catch (err) {
        console.error('[Receipt] AI analysis error:', err);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('receipt:error', { message: err instanceof Error ? err.message : 'AI analysis failed' });
        }
    }
}
function startHttpServer(localIp, token) {
    return new Promise((resolve, reject) => {
        server = http.createServer((req, res) => {
            const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
            const reqToken = url.searchParams.get('t');
            // Validate token
            if (reqToken !== token) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }
            if (req.method === 'GET' && url.pathname === '/') {
                const html = getMobileCaptureHtml(token);
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
            }
            if (req.method === 'POST' && url.pathname === '/upload') {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('receipt:analysis-progress', { step: 'uploading' });
                }
                const chunks = [];
                req.on('data', (chunk) => chunks.push(chunk));
                req.on('end', () => {
                    try {
                        const body = Buffer.concat(chunks);
                        const fileName = `receipt-${crypto.randomUUID()}.jpg`;
                        const filePath = path.join(getReceiptsDir(), fileName);
                        fs.writeFileSync(filePath, body);
                        // Save to DB (no extracted_data yet)
                        const row = receiptQueries.createReceipt({
                            file_path: filePath,
                            file_name: fileName,
                        });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                        // Preprocess (crop/normalize) then run AI analysis
                        runReceiptPipeline(row.id, filePath).catch((err) => {
                            console.error('[Receipt] Async pipeline error:', err);
                        });
                    }
                    catch (err) {
                        console.error('[Receipt] Upload error:', err);
                        res.writeHead(500);
                        res.end('Internal error');
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('receipt:error', { message: 'Failed to save receipt' });
                        }
                    }
                });
                req.on('error', (err) => {
                    console.error('[Receipt] Request error:', err);
                    res.writeHead(500);
                    res.end('Internal error');
                });
                return;
            }
            res.writeHead(404);
            res.end('Not Found');
        });
        server.on('error', (err) => {
            console.error('[Receipt] Server error:', err);
            reject(err);
        });
        server.listen(3421, '0.0.0.0', () => {
            console.log(`[Receipt] HTTP server listening on ${localIp}:3421`);
            resolve();
        });
    });
}
export function registerReceiptHandlers() {
    ipcMain.handle('receipt:start-server', async () => {
        try {
            // Stop any existing server
            stopServer();
            const localIp = getLocalIp();
            if (!localIp) {
                return { error: 'not_on_wifi' };
            }
            sessionToken = generateToken();
            const url = `http://${localIp}:3421/?t=${sessionToken}`;
            await startHttpServer(localIp, sessionToken);
            // Auto-stop after 10 minutes
            serverTimeout = setTimeout(() => {
                console.log('[Receipt] Server auto-stopped after 10 min timeout');
                stopServer();
            }, 10 * 60 * 1000);
            return { url, token: sessionToken };
        }
        catch (err) {
            console.error('[Receipt] Failed to start server:', err);
            return { error: 'server_error' };
        }
    });
    ipcMain.handle('receipt:stop-server', async () => {
        stopServer();
    });
    ipcMain.handle('receipt:get-for-transaction', async (_, transactionId) => {
        try {
            const row = receiptQueries.getReceiptByTransactionId(transactionId);
            if (!row)
                return null;
            return {
                ...row,
                extracted_data: row.extracted_data ? JSON.parse(row.extracted_data) : null,
            };
        }
        catch (err) {
            console.error('[Receipt] Error getting receipt for transaction:', err);
            return null;
        }
    });
    ipcMain.handle('receipt:link-transaction', async (_, receiptId, transactionId) => {
        try {
            receiptQueries.updateReceiptTransaction(receiptId, transactionId);
        }
        catch (err) {
            console.error('[Receipt] Error linking receipt to transaction:', err);
            throw err;
        }
    });
    ipcMain.handle('receipt:delete', async (_, receiptId) => {
        try {
            const row = receiptQueries.deleteReceipt(receiptId);
            if (row?.file_path && fs.existsSync(row.file_path)) {
                fs.unlinkSync(row.file_path);
            }
        }
        catch (err) {
            console.error('[Receipt] Error deleting receipt:', err);
            throw err;
        }
    });
    // Returns the receipt image as a base64 data URL (works in both dev and prod)
    ipcMain.handle('receipt:get-image-data', async (_, filePath) => {
        return fileToDataUrl(filePath);
    });
    console.log('Receipt IPC handlers registered');
}
