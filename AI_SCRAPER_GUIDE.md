# AI Scraper Guide

## Overview

The AI Scraper uses **Ollama** (local AI) with vision capabilities to automatically extract bank transactions from screenshots of your bank's website. This is more reliable than DOM-based scraping and works with any bank website.

**Key Benefits:**
- ✅ **100% Free** - No API costs
- ✅ **Private** - All data stays on your Mac
- ✅ **Fast** - Especially on Apple Silicon (M1/M2/M3)
- ✅ **Offline** - Works without internet once model is downloaded

## Getting Started

### 1. Install Ollama

**Option A: Homebrew (Recommended)**
```bash
brew install ollama
```

**Option B: Manual Download**
1. Visit https://ollama.ai/download
2. Download the macOS app
3. Drag to Applications folder

### 2. Start Ollama Server

```bash
ollama serve
```

Or just open the Ollama app from Applications - it runs in your menu bar.

### 3. Download AI Model

**Recommended (HTML Analysis):**
```bash
ollama pull llama3.2
```
Downloads Llama 3.2 text model (~2GB, fast). Analyzes HTML source code.

**Alternative (Screenshot Analysis):**
```bash
ollama pull llama3.2-vision
```
Downloads Llama 3.2 Vision model (~7GB, slower). Analyzes screenshots if HTML parsing fails.

### 4. Using the AI Scraper

1. Open the Personal Finance app
2. Navigate to **Import** page
3. Click the **AI Scrape** tab
4. Complete the Ollama setup steps (if not already done)
5. Select your account from the dropdown
6. Click **Open AI Browser**
7. In the browser window that opens:
   - Log in to your bank (e.g., USAA)
   - Navigate to your transactions page
   - Click the **🤖 AI Scrape This Page** button (bottom right)
8. Wait 3-10 seconds while Ollama analyzes the page
9. Review the extracted transactions in the preview
10. Click **Import Transactions** to save them

## How It Works

1. **HTML Extraction**: When you click "AI Scrape This Page", the app extracts the HTML source code from the current page
2. **Local Processing**: The HTML is sent to your local Ollama server (localhost:11434)
3. **AI Analysis**: Llama 3.2 analyzes the HTML structure and identifies ALL transaction data (dates, descriptions, amounts, categories)
4. **Structured Data**: The model returns the transactions as structured JSON
5. **Preview**: You can review and verify the extracted data before importing

**Benefits over screenshot-based scraping:**
- ✅ Captures ALL transactions in the DOM (not limited to viewport)
- ✅ More accurate text extraction (no OCR errors)
- ✅ Faster processing (text model is smaller/quicker)
- ✅ Can run without showing browser window
- ✅ Works with paginated data automatically

## System Requirements

- **macOS**: Any recent version (works on Intel or Apple Silicon)
- **RAM**: 8GB minimum, 16GB+ recommended for vision models
- **Disk Space**: ~7GB for the vision model
- **Apple Silicon (M1/M2/M3)**: Faster performance (~3-5 seconds per page)
- **Intel Mac**: Slower but still works (~10-20 seconds per page)

## Advantages Over Cloud AI

- **$0 Cost**: No API fees, completely free
- **Privacy**: Screenshots never leave your machine
- **Speed**: No network latency, instant processing on good hardware
- **Offline**: Works without internet after initial setup
- **No Rate Limits**: Process as many transactions as you want

## Troubleshooting

### "Ollama not installed"
- Install via Homebrew: `brew install ollama`
- Or download from https://ollama.ai/download

### "Server not running"
- Start the server: `ollama serve`
- Or open the Ollama app from Applications

### "Vision model not downloaded"
- Download the model: `ollama pull llama3.2-vision`
- Wait for download to complete (~7GB)

### "No transactions found"
- Make sure you're on the transactions page (not login, account summary, etc.)
- The page should show a list of transactions with dates and amounts
- Try scrolling to ensure transactions are visible

### "Slow performance"
- First inference is slower (loading model into RAM)
- Subsequent scrapes are faster (~3-5 seconds)
- Intel Macs are slower than Apple Silicon
- Close other apps to free up RAM

## Privacy & Security

- **100% Local**: All processing happens on your Mac
- **No Cloud**: Screenshots are never sent to external servers
- **Private**: Your transaction data never leaves your device
- **Secure**: No API keys, no authentication, no data leakage

## Model Information

**Recommended: llama3.2 (HTML Analysis)**
- Size: ~2GB
- Quality: Excellent accuracy for HTML parsing
- Speed: 2-5 seconds on Apple Silicon, 5-10 seconds on Intel
- Usage: Analyzes HTML source code directly

**Alternative: llama3.2-vision (Screenshot Analysis)**
- Size: ~7GB
- Quality: Good for visual extraction
- Speed: 5-10 seconds on Apple Silicon, 15-30 seconds on Intel
- Usage: Fallback if HTML analysis needs visual context

**Pull the text model first:**
```bash
ollama pull llama3.2
```

## Future Enhancements

Potential improvements:
- Auto-scrolling to capture all transactions on page
- Support for pagination (scraping multiple pages automatically)
- Batch processing of multiple accounts
- Real-time progress indicator
- Model selection in UI
