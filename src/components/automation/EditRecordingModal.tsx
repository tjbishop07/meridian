import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Save, Trash2, Pencil } from 'lucide-react';

interface Step {
  type: string;
  selector: string;
  element: string;
  value?: string;
  text?: string;
  timestamp?: number;
  fieldLabel?: string;
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

  if (!isOpen || !recording) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-5xl max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 rounded-full p-2">
              <Pencil className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-xl">Edit Recording</h3>
              <p className="text-sm text-base-content/70">{steps.length} steps</p>
            </div>
          </div>
          <button
            className="btn btn-sm btn-ghost btn-circle"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed bg-base-200 mx-6 mt-4">
          <button
            className={`tab ${editingBasic ? 'tab-active' : ''}`}
            onClick={() => setEditingBasic(true)}
          >
            Basic Info
          </button>
          <button
            className={`tab ${!editingBasic ? 'tab-active' : ''}`}
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
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Name</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Download USAA Transactions"
                    required
                    autoFocus
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Institution (optional)</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g., USAA, Chase, Bank of America"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Import To Account</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
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
                  <label className="label">
                    <span className="label-text-alt">
                      Transactions will be automatically imported to this account
                    </span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Starting URL</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full font-mono text-sm"
                    value={recording.url}
                    disabled
                  />
                  <label className="label">
                    <span className="label-text-alt">URL cannot be changed after recording</span>
                  </label>
                </div>
              </div>
            ) : (
              // Steps Tab
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
                          type="button"
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
                      </div>
                    )}
                  </div>
                ))}

                {steps.length === 0 && (
                  <div className="text-center py-12 text-base-content/50">
                    <p>No steps recorded</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-base-300 bg-base-200">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary gap-2"
              disabled={!name.trim() || steps.length === 0}
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
