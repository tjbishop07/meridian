import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Step {
  type: string;
  selector: string;
  element: string;
  value?: string;
  text?: string;
  timestamp?: number;
  fieldLabel?: string;
}

interface EditRecipeModalProps {
  recipe: {
    id: number;
    name: string;
    institution: string | null;
    url: string;
    steps: Step[];
  } | null;
  onClose: () => void;
  onSave: (updatedSteps: Step[]) => void;
}

const selectSmClass = 'w-full px-2 py-1 border border-border rounded-md bg-background text-foreground text-sm focus:ring-1 focus:ring-ring focus:outline-none';
const inputSmClass = 'w-full px-2 py-1 border border-border rounded-md bg-background text-foreground text-sm focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-50';

export function EditRecipeModal({ recipe, onClose, onSave }: EditRecipeModalProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (recipe) {
      setSteps([...recipe.steps]);
      setExpandedSteps(new Set([0]));
    }
  }, [recipe]);

  if (!recipe) return null;

  const toggleStep = (index: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSteps(newExpanded);
  };

  const updateStep = (index: number, field: keyof Step, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const deleteStep = (index: number) => {
    if (confirm(`Delete step ${index + 1}?\n\nThis cannot be undone.`)) {
      const newSteps = steps.filter((_, i) => i !== index);
      setSteps(newSteps);
    }
  };

  const handleSave = () => {
    onSave(steps);
    onClose();
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'click': return '🖱️';
      case 'input': return '⌨️';
      case 'select': return '📋';
      default: return '•';
    }
  };

  const getStepSummary = (step: Step) => {
    let selector = step.selector;
    if (selector.startsWith('label:')) {
      selector = `Label: "${selector.substring(6)}"`;
    } else if (selector.startsWith('placeholder:')) {
      selector = `Placeholder: "${selector.substring(12)}"`;
    } else if (selector.length > 50) {
      selector = selector.substring(0, 50) + '...';
    }
    return selector;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-xl">Edit Recipe</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {recipe.name} {recipe.institution && `• ${recipe.institution}`}
            </p>
          </div>
          <button
            className="p-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps List */}
        <div className="flex-1 overflow-y-auto mb-4">
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className="border border-border rounded-lg overflow-hidden"
              >
                {/* Step Header */}
                <div
                  className="flex items-center gap-3 p-3 bg-muted cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => toggleStep(index)}
                >
                  <span className="text-lg">{getStepIcon(step.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Step {index + 1}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-background text-foreground border border-border">
                        {step.type}
                      </span>
                      {step.value === '[REDACTED]' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-warning/10 text-warning">
                          🔒 Sensitive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {getStepSummary(step)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteStep(index);
                      }}
                      title="Delete step"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {expandedSteps.has(index) ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Step Details (Expanded) */}
                {expandedSteps.has(index) && (
                  <div className="p-4 space-y-3 bg-card">
                    {/* Type */}
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-1">Type</label>
                      <select
                        className={selectSmClass}
                        value={step.type}
                        onChange={(e) => updateStep(index, 'type', e.target.value)}
                      >
                        <option value="click">Click</option>
                        <option value="input">Input</option>
                        <option value="select">Select</option>
                      </select>
                    </div>

                    {/* Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-semibold text-foreground">Selector</label>
                        <span className="text-xs text-muted-foreground">CSS selector, label:text, or placeholder:text</span>
                      </div>
                      <Textarea
                        rows={2}
                        value={step.selector}
                        onChange={(e) => updateStep(index, 'selector', e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>

                    {/* Element */}
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-1">Element Type</label>
                      <input
                        type="text"
                        className={inputSmClass}
                        value={step.element}
                        onChange={(e) => updateStep(index, 'element', e.target.value)}
                      />
                    </div>

                    {/* Value (for input/select) */}
                    {(step.type === 'input' || step.type === 'select') && (
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-1">
                          Value
                          {step.value === '[REDACTED]' && (
                            <span className="text-warning ml-2 font-normal">
                              (Sensitive - will be prompted during playback)
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          className={inputSmClass}
                          value={step.value || ''}
                          onChange={(e) => updateStep(index, 'value', e.target.value)}
                          placeholder="Enter value or use [REDACTED] for sensitive data"
                        />
                      </div>
                    )}

                    {/* Field Label (optional) */}
                    {step.type === 'input' && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-semibold text-foreground">Field Label (optional)</label>
                          <span className="text-xs text-muted-foreground">Shown when prompting for sensitive input</span>
                        </div>
                        <input
                          type="text"
                          className={inputSmClass}
                          value={step.fieldLabel || ''}
                          onChange={(e) => updateStep(index, 'fieldLabel', e.target.value)}
                          placeholder="e.g., PIN, Password, Username"
                        />
                      </div>
                    )}

                    {/* Text (for clicks) */}
                    {step.text && (
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-1">Button Text</label>
                        <input
                          type="text"
                          className={inputSmClass}
                          value={step.text}
                          onChange={(e) => updateStep(index, 'text', e.target.value)}
                          disabled
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {steps.length === 0 && (
            <div className="text-center py-12 text-muted-foreground/50">
              <p>No steps recorded</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {steps.length} step{steps.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={steps.length === 0}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
