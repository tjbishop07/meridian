# Automation Refactor Plan: Multi-Strategy Element Identification

## Problem
Current coordinates-only approach is brittle and breaks with layout changes.

## Solution: Multi-Strategy Hybrid Approach

Record multiple identification strategies for each interaction, try them in order during playback.

## Recording Phase

### Capture for each interaction:

```typescript
interface RichRecordingStep {
  type: 'click' | 'input' | 'select';
  timestamp: number;

  // Strategy 1: Text/Content-based (FASTEST)
  identification: {
    text: string;              // Button text, input value, etc.
    ariaLabel?: string;        // Accessibility label
    placeholder?: string;      // For inputs
    title?: string;           // Tooltip text
    role?: string;            // ARIA role
  };

  // Strategy 2: Structural (RELIABLE)
  context: {
    formIndex?: number;        // Which form on page
    elementIndex?: number;     // Position in form/container
    nearbyText: string[];      // Visible text near element
    parentText?: string;       // Parent element text
  };

  // Strategy 3: Visual + AI (RESILIENT)
  visual?: {
    screenshot: string;        // Base64 screenshot of element
    aiDescription: string;     // AI-generated description
    boundingBox: {             // Element size
      width: number;
      height: number;
    };
  };

  // Strategy 4: Coordinates (FALLBACK)
  coordinates: {
    x: number;
    y: number;
    elementX: number;
    elementY: number;
  };

  // Action details
  value?: string;              // For inputs
  url?: string;                // For navigation
}
```

## Playback Phase

### Element Finding Algorithm:

```typescript
async function findAndClickElement(step: RichRecordingStep) {
  // Try strategies in order of speed + reliability

  // 1. TEXT + ROLE (fastest, works with layout changes)
  let element = findByTextAndRole(step.identification);
  if (element) return element.click();

  // 2. STRUCTURAL (works if form structure unchanged)
  element = findByStructuralContext(step.context);
  if (element) return element.click();

  // 3. AI VISION (resilient to major changes)
  if (step.visual && ollamaAvailable) {
    element = await findByAIVision(step.visual);
    if (element) return element.click();
  }

  // 4. COORDINATES (last resort)
  element = findByCoordinates(step.coordinates);
  if (element) return element.click();

  throw new Error('Could not find element with any strategy');
}
```

## Implementation Steps

### Step 1: Update Recorder (automation-browserview.ts)
- Capture text content, aria-label, role
- Capture nearby labels/text for context
- Capture element position in form/container
- Optionally: Take element screenshot
- Optionally: Generate AI description using llama3.2-vision

### Step 2: Create Element Finder Module (automation/element-finder.ts)
```typescript
// Strategies in order of preference
export async function findElement(step: RichRecordingStep): Promise<Element | null> {
  const strategies = [
    findByTextContent,
    findByAriaLabel,
    findByStructuralPosition,
    findByAIVision,
    findByCoordinates
  ];

  for (const strategy of strategies) {
    const element = await strategy(step);
    if (element) {
      console.log(`✓ Found using ${strategy.name}`);
      return element;
    }
  }

  return null;
}
```

### Step 3: AI Vision Integration (Optional but Powerful)

Use llama3.2-vision for resilient element finding:

```typescript
async function findByAIVision(step: RichRecordingStep): Promise<Element | null> {
  // Take screenshot of current page
  const screenshot = await captureScreenshot();

  // Ask AI to find the element
  const prompt = `
    Find the location of this element on the page:
    "${step.visual.aiDescription}"

    Return coordinates as JSON: {"x": 100, "y": 200}
  `;

  const response = await ollama.generate({
    model: 'llama3.2-vision',
    prompt,
    images: [screenshot]
  });

  const coords = parseCoordinates(response);
  return document.elementFromPoint(coords.x, coords.y);
}
```

## Benefits

✅ **Fast**: Text matching is instant
✅ **Resilient**: Multiple fallbacks handle changes
✅ **Smart**: AI can handle major UI changes
✅ **Debuggable**: Clear strategy logs show what worked/failed
✅ **Adaptable**: Easy to add new strategies

## Migration

1. Keep old coordinate-based recordings working (compatibility)
2. New recordings use multi-strategy approach
3. Playback auto-detects recording version
4. Gradually migrate old recordings (optional)

## Next Steps

Want me to implement this? I recommend:

1. **Quick Win**: Start with text + aria-label strategy (30 min)
2. **Add Context**: Add structural matching (1 hour)
3. **AI Power**: Add vision-based finding (2 hours)
4. **Polish**: Add smart fallbacks and logging (1 hour)

Total: ~4-5 hours for complete solution
