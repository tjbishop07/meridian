import { useState, useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';

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
    <div className="modal modal-open">
      <div className="modal-box">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-primary/20 rounded-full p-2">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-bold text-lg">Start New Recording</h3>
        </div>

        <p className="mb-4 text-sm text-base-content/70">
          Enter a starting URL, or leave it blank to start at Google. You can navigate to any website using the address bar in the recording window.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Starting URL (optional)</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              className="input input-bordered w-full"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.usaa.com"
            />
            <label className="label">
              <span className="label-text-alt text-base-content/60">
                Tip: You can just type "usaa.com" - https:// will be added automatically
              </span>
            </label>
          </div>

          <div className="modal-action">
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleSkip}>
              Start at Google
            </button>
            <button type="submit" className="btn btn-primary">
              Open Recording Window
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
