import { useState, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';

interface SensitiveInputModalProps {
  isOpen: boolean;
  stepNumber: number;
  totalSteps: number;
  fieldLabel: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function SensitiveInputModal({
  isOpen,
  stepNumber,
  totalSteps,
  fieldLabel,
  onSubmit,
  onCancel
}: SensitiveInputModalProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value);
      setValue('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-warning/20 rounded-full p-2">
            <Lock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Sensitive Input Required</h3>
            <p className="text-sm text-base-content/70">
              Step {stepNumber} of {totalSteps}
            </p>
          </div>
        </div>

        <p className="mb-4">
          Please enter the value for: <span className="font-semibold">{fieldLabel}</span>
        </p>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            className="input input-bordered w-full mb-4"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter password or PIN"
          />

          <div className="modal-action">
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
              Continue
            </button>
          </div>
        </form>

        <div className="alert alert-info mt-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span className="text-sm">This value is not stored and only used for this playback session.</span>
        </div>
      </div>
    </div>
  );
}
