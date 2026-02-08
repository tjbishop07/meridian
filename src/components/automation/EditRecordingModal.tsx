import { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';

interface Recording {
  id: string;
  name: string;
  institution?: string;
  url: string;
  steps: any[];
  created_at: string;
  updated_at: string;
}

interface EditRecordingModalProps {
  isOpen: boolean;
  recording: Recording | null;
  onSave: (id: string, name: string, institution: string) => void;
  onClose: () => void;
}

export function EditRecordingModal({
  isOpen,
  recording,
  onSave,
  onClose
}: EditRecordingModalProps) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && recording) {
      setName(recording.name);
      setInstitution(recording.institution || '');
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isOpen, recording]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && recording) {
      onSave(recording.id, name, institution);
      onClose();
    }
  };

  if (!isOpen || !recording) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-primary/20 rounded-full p-2">
            <Pencil className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-bold text-lg">Edit Recording</h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Name</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Download USAA Transactions"
              required
            />
          </div>

          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Institution (optional)</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g., USAA, Chase, Bank of America"
            />
          </div>

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
