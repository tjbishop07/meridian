import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Save, Trash2 } from 'lucide-react';

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

export function EditRecipeModal({ recipe, onClose, onSave }: EditRecipeModalProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (recipe) {
      setSteps([...recipe.steps]);
      // Expand first step by default
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
      case 'click':
        return '🖱️';
      case 'input':
        return '⌨️';
      case 'select':
        return '📋';
      default:
        return '•';
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
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-xl flex items-center gap-2">
              Edit Recipe
            </h3>
            <p className="text-sm text-base-content/70 mt-1">
              {recipe.name} {recipe.institution && `• ${recipe.institution}`}
            </p>
          </div>
          <button
            className="btn btn-sm btn-ghost btn-circle"
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
                className="border border-base-300 rounded-lg overflow-hidden"
              >
                {/* Step Header */}
                <div
                  className="flex items-center gap-3 p-3 bg-base-200 cursor-pointer hover:bg-base-300 transition-colors"
                  onClick={() => toggleStep(index)}
                >
                  <span className="text-lg">{getStepIcon(step.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        Step {index + 1}
                      </span>
                      <span className="badge badge-sm">{step.type}</span>
                      {step.value === '[REDACTED]' && (
                        <span className="badge badge-warning badge-sm">🔒 Sensitive</span>
                      )}
                    </div>
                    <p className="text-xs text-base-content/70 truncate mt-1">
                      {getStepSummary(step)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-xs btn-error btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteStep(index);
                      }}
                      title="Delete step"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {expandedSteps.has(index) ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>

                {/* Step Details (Expanded) */}
                {expandedSteps.has(index) && (
                  <div className="p-4 space-y-3 bg-base-100">
                    {/* Type */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-semibold">Type</span>
                      </label>
                      <select
                        className="select select-bordered select-sm"
                        value={step.type}
                        onChange={(e) => updateStep(index, 'type', e.target.value)}
                      >
                        <option value="click">Click</option>
                        <option value="input">Input</option>
                        <option value="select">Select</option>
                      </select>
                    </div>

                    {/* Selector */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-semibold">Selector</span>
                        <span className="label-text-alt text-xs">
                          CSS selector, label:text, or placeholder:text
                        </span>
                      </label>
                      <textarea
                        className="textarea textarea-bordered textarea-sm font-mono text-xs"
                        rows={2}
                        value={step.selector}
                        onChange={(e) => updateStep(index, 'selector', e.target.value)}
                      />
                    </div>

                    {/* Element */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-semibold">Element Type</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={step.element}
                        onChange={(e) => updateStep(index, 'element', e.target.value)}
                      />
                    </div>

                    {/* Value (for input/select) */}
                    {(step.type === 'input' || step.type === 'select') && (
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-semibold">
                            Value
                            {step.value === '[REDACTED]' && (
                              <span className="text-warning ml-2">
                                (Sensitive - will be prompted during playback)
                              </span>
                            )}
                          </span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered input-sm"
                          value={step.value || ''}
                          onChange={(e) => updateStep(index, 'value', e.target.value)}
                          placeholder="Enter value or use [REDACTED] for sensitive data"
                        />
                      </div>
                    )}

                    {/* Field Label (optional) */}
                    {step.type === 'input' && (
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-semibold">Field Label (optional)</span>
                          <span className="label-text-alt text-xs">
                            Shown when prompting for sensitive input
                          </span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered input-sm"
                          value={step.fieldLabel || ''}
                          onChange={(e) => updateStep(index, 'fieldLabel', e.target.value)}
                          placeholder="e.g., PIN, Password, Username"
                        />
                      </div>
                    )}

                    {/* Text (for clicks) */}
                    {step.text && (
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-semibold">Button Text</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered input-sm"
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
            <div className="text-center py-12 text-base-content/50">
              <p>No steps recorded</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-base-300">
          <div className="text-sm text-base-content/70">
            {steps.length} step{steps.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={steps.length === 0}
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
