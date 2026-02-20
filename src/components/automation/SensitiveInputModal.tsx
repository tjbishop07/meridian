import { useState, useEffect, useRef } from 'react';
import { Lock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-warning/20 rounded-full p-2">
            <Lock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Sensitive Input Required</h3>
            <p className="text-sm text-muted-foreground">
              Step {stepNumber} of {totalSteps}
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm">
          Please enter the value for: <span className="font-semibold">{fieldLabel}</span>
        </p>

        <form onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter password or PIN"
            className="mb-4"
          />

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Continue
            </Button>
          </div>
        </form>

        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 flex gap-3 mt-4">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <span className="text-sm text-muted-foreground">
            This value is not stored and only used for this playback session.
          </span>
        </div>
      </div>
    </div>
  );
}
