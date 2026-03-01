import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { toast } from 'sonner';
import { Automation } from '../../../../src/pages/Automation';
import { useAutomationStore } from '../../../../src/store/automationStore';

// ---- module mocks ----

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/automation' }),
}));

vi.mock('../../../../src/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [], loadCategories: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('../../../../src/hooks/useAutomationSettings', () => ({
  useAutomationSettings: () => ({
    settings: {
      vision_provider: 'none',
      claude_api_key: '',
      retry_attempts: 3,
      retry_delay_ms: 2000,
      schedule_enabled: false,
      schedule_cron: '0 6 * * *',
      debug_show_browser: false,
    },
    updateSettings: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// Stub heavy child components so this test only exercises Automation's own logic
vi.mock('../../../../src/components/layout/PageHeader', () => ({
  default: () => null,
}));

vi.mock('../../../../src/components/automation/EmptyState', () => ({
  EmptyState: () => null,
}));

vi.mock('../../../../src/components/automation/EditRecordingModal', () => ({
  EditRecordingModal: () => null,
}));

// Minimal RecordingCard that exposes a testable Run button
vi.mock('../../../../src/components/automation/RecordingCard', () => ({
  RecordingCard: ({ recording, onPlay, isPlaying }: any) => (
    <tr>
      <td>
        <button
          data-testid={`run-${recording.id}`}
          onClick={() => onPlay(recording.id)}
          disabled={isPlaying}
        >
          {isPlaying ? 'Running...' : 'Run'}
        </button>
      </td>
    </tr>
  ),
}));

// ---- fixtures ----

const RECIPE = {
  id: 1,
  name: 'USAA Test',
  url: 'https://www.usaa.com',
  steps: '[]',
  account_id: 1,
  institution: null,
  last_run_at: null,
  last_scraping_method: null,
  created_at: '2025-01-01',
  updated_at: '2025-01-01',
};

const ACCOUNT = { id: 1, name: 'Checking', institution: 'USAA' };

const mockInvoke = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useAutomationStore.getState().clearAllProgress();

  (window as any).electron = {
    invoke: mockInvoke,
    on: vi.fn(),
    removeListener: vi.fn(),
  };

  // Default: return fixture data for initial data loading
  mockInvoke.mockImplementation(async (channel: string) => {
    if (channel === 'export-recipes:get-all') return [RECIPE];
    if (channel === 'accounts:get-all') return [ACCOUNT];
    return [];
  });
});

// ---- tests ----

describe('Automation – handlePlayRecording', () => {
  it('clears playing state and shows an error toast when IPC returns failure', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'export-recipes:get-all') return [RECIPE];
      if (channel === 'accounts:get-all') return [ACCOUNT];
      if (channel === 'automation:play-recording') return { success: false, message: 'Step 2 failed' };
      return [];
    });

    render(<Automation />);

    const runBtn = await screen.findByTestId('run-1');
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(useAutomationStore.getState().playingRecipeId).toBeNull();
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Step 2 failed');
  });

  it('clears playing state and shows an error toast when IPC throws', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'export-recipes:get-all') return [RECIPE];
      if (channel === 'accounts:get-all') return [ACCOUNT];
      if (channel === 'automation:play-recording') throw new Error('network failure');
      return [];
    });

    render(<Automation />);

    const runBtn = await screen.findByTestId('run-1');
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(useAutomationStore.getState().playingRecipeId).toBeNull();
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Failed to play recording');
  });

  it('preserves playing state when IPC returns success (waits for scrape-complete event)', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'export-recipes:get-all') return [RECIPE];
      if (channel === 'accounts:get-all') return [ACCOUNT];
      if (channel === 'automation:play-recording') return { success: true, message: 'Imported 5 transactions' };
      return [];
    });

    render(<Automation />);

    const runBtn = await screen.findByTestId('run-1');
    fireEvent.click(runBtn);

    // Wait for the IPC call to be made and resolved
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('automation:play-recording', '1');
    });

    // Flush any remaining microtasks so we'd catch a premature clearProgress call
    await act(async () => { await Promise.resolve(); });

    // State should remain playing — only the scrape-complete event should clear it
    expect(useAutomationStore.getState().playingRecipeId).toBe('1');
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });
});
