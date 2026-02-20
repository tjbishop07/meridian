import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Save, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Step {
  type: string;
  selector: string;
  element: string;
  value?: string;
  text?: string;
  timestamp?: number;
  fieldLabel?: string;
  identification?: {
    text?: string;
    ariaLabel?: string;
    placeholder?: string;
    title?: string;
    role?: string;
    nearbyLabels?: string[];
    coordinates?: {
      x: number;
      y: number;
    };
  };
}

interface Recording {
  id: string;
  name: string;
  institution?: string;
  url: string;
  steps: Step[];
  account_id?: number | null;
  created_at: string;
  updated_at: string;
}

interface Account {
  id: number;
  name: string;
  institution: string;
}

interface EditRecordingModalProps {
  isOpen: boolean;
  recording: Recording | null;
  accounts: Account[];
  onSave: (id: string, name: string, institution: string, steps?: Step[], accountId?: number | null) => void;
  onClose: () => void;
}

const selectClass = 'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-ring focus:outline-none disabled:opacity-50';
const selectSmClass = 'w-full px-2 py-1 border border-border rounded-md bg-background text-foreground text-sm focus:ring-1 focus:ring-ring focus:outline-none';
const inputSmClass = 'w-full px-2 py-1 border border-border rounded-md bg-background text-foreground text-sm focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-50';

export function EditRecordingModal({
  isOpen,
  recording,
  accounts,
  onSave,
  onClose
}: EditRecordingModalProps) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [editingBasic, setEditingBasic] = useState(true);

  useEffect(() => {
    if (isOpen && recording) {
      setName(recording.name);
      setInstitution(recording.institution || '');
      setAccountId(recording.account_id || null);
      setSteps([...recording.steps]);
      setExpandedSteps(new Set([0]));
      setEditingBasic(true);
    }
  }, [isOpen, recording]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && recording) {
      onSave(recording.id, name, institution, steps, accountId);
      onClose();
    }
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
    if (step.identification) {
      const parts: string[] = [];
      if (step.identification.text) parts.push(`"${step.identification.text}"`);
      if (step.identification.ariaLabel) parts.push(`aria-label: "${step.identification.ariaLabel}"`);
      if (step.identification.placeholder) parts.push(`placeholder: "${step.identification.placeholder}"`);
      if (step.identification.nearbyLabels && step.identification.nearbyLabels.length > 0) {
        parts.push(`near: "${step.identification.nearbyLabels[0]}"`);
      }
      if (parts.length > 0) {
        const summary = parts.join(' • ');
        return summary.length > 70 ? summary.substring(0, 70) + '...' : summary;
      }
    }

    let selector = step.selector || '';
    if (selector.startsWith('label:')) {
      selector = `Label: "${selector.substring(6)}"`;
    } else if (selector.startsWith('placeholder:')) {
      selector = `Placeholder: "${selector.substring(12)}"`;
    } else if (selector.length > 50) {
      selector = selector.substring(0, 50) + '...';
    }
    return selector || 'No identification data';
  };

  if (!isOpen || !recording) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 rounded-full p-2">
              <Pencil className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-xl">Edit Recording</h3>
              <p className="text-sm text-muted-foreground">{steps.length} steps</p>
            </div>
          </div>
          <button
            className="p-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-muted rounded-lg p-1 mx-6 mt-4">
          <button
            className={cn(
              'flex-1 py-1.5 text-sm font-medium rounded transition-colors',
              editingBasic
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setEditingBasic(true)}
          >
            Basic Info
          </button>
          <button
            className={cn(
              'flex-1 py-1.5 text-sm font-medium rounded transition-colors',
              !editingBasic
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setEditingBasic(false)}
          >
            Steps ({steps.length})
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6">
            {editingBasic ? (
              // Basic Info Tab
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">Name</label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Download USAA Transactions"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">Institution (optional)</label>
                  <Input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g., USAA, Chase, Bank of America"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">Import To Account</label>
                  <select
                    className={selectClass}
                    value={accountId || ''}
                    onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">No account (manual import)</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.institution})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Transactions will be automatically imported to this account
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">Starting URL</label>
                  <Input
                    type="text"
                    value={recording.url}
                    disabled
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">URL cannot be changed after recording</p>
                </div>
              </div>
            ) : (
              // Steps Tab
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
                          type="button"
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

                        {/* Text-Based Identification (New Format) */}
                        {step.identification && (
                          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                            <div className="text-xs">
                              <div className="font-semibold mb-2 flex items-center gap-2 text-foreground">
                                <span className="text-lg">✨</span>
                                Text-Based Identification
                              </div>
                              <div className="space-y-1 text-foreground">
                                {step.identification.text && (
                                  <div><strong>Text:</strong> "{step.identification.text}"</div>
                                )}
                                {step.identification.ariaLabel && (
                                  <div><strong>ARIA Label:</strong> "{step.identification.ariaLabel}"</div>
                                )}
                                {step.identification.placeholder && (
                                  <div><strong>Placeholder:</strong> "{step.identification.placeholder}"</div>
                                )}
                                {step.identification.role && (
                                  <div><strong>Role:</strong> {step.identification.role}</div>
                                )}
                                {step.identification.nearbyLabels && step.identification.nearbyLabels.length > 0 && (
                                  <div><strong>Nearby Labels:</strong> {step.identification.nearbyLabels.join(', ')}</div>
                                )}
                                {step.identification.coordinates && (
                                  <div className="text-muted-foreground/50 mt-1">
                                    <strong>Coordinates (fallback):</strong> ({Math.round(step.identification.coordinates.x)}, {Math.round(step.identification.coordinates.y)})
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Selector (Legacy or if no identification) */}
                        {!step.identification && (
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
                        )}

                        {/* Element */}
                        <div>
                          <label className="block text-sm font-semibold text-foreground mb-1">Element Type</label>
                          <input
                            type="text"
                            className={inputSmClass}
                            value={step.element}
                            onChange={(e) => updateStep(index, 'element', e.target.value)}
                            disabled={!!step.identification}
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
                      </div>
                    )}
                  </div>
                ))}

                {steps.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground/50">
                    <p>No steps recorded</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || steps.length === 0}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
