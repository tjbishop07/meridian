import { Bot, Plus } from 'lucide-react';

interface EmptyStateProps {
  onCreateNew: () => void;
}

export function EmptyState({ onCreateNew }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="bg-base-200 rounded-full p-6 mb-6">
        <Bot className="w-16 h-16 text-base-content/50" />
      </div>

      <h3 className="text-2xl font-semibold mb-2">No Automations Yet</h3>

      <p className="text-base-content/70 text-center max-w-md mb-8">
        Create your first automation to record browser interactions and replay them automatically.
        Perfect for downloading bank statements and importing transactions.
      </p>

      <button className="btn btn-primary btn-lg gap-2" onClick={onCreateNew}>
        <Plus className="w-5 h-5" />
        Create New Recording
      </button>

      <div className="mt-12 max-w-2xl">
        <h4 className="font-semibold mb-4">How it works:</h4>
        <ol className="list-decimal list-inside space-y-2 text-sm text-base-content/70">
          <li>Click "Create New Recording" to open a browser window at Google</li>
          <li>Use the address bar to navigate to your bank's website</li>
          <li>Click "Start Recording" and perform your actions (login, download, etc.)</li>
          <li>Click "Stop & Save" and enter a name for your recording</li>
          <li>Run your automation anytime to replay those actions automatically</li>
        </ol>
      </div>
    </div>
  );
}
