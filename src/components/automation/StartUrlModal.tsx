import { useState, useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface StartUrlModalProps {
  isOpen: boolean;
  onStart: (url: string) => void;
  onCancel: () => void;
}

export function StartUrlModal({ isOpen, onStart, onCancel }: StartUrlModalProps) {
  const [url, setUrl] = useState('https://www.usaa.com');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl('https://www.usaa.com');
      setTimeout(() => {
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(url.trim());
  };

  const handleSkip = () => {
    onStart('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-primary/20 rounded-full p-2">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-bold text-lg">Start New Recording</h3>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Enter a starting URL, or leave it blank to start at Google. You can navigate to any website using the address bar in the recording window.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1">
              Starting URL (optional)
            </label>
            <Input
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.usaa.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tip: You can just type "usaa.com" - https:// will be added automatically
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" variant="ghost" onClick={handleSkip}>
              Start at Google
            </Button>
            <Button type="submit">
              Open Recording Window
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
