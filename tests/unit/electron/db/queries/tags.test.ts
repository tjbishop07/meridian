import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedAccount, seedTransaction } from '../../../../setup/db-helpers';

vi.mock('../../../../../electron/db/index', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../../../electron/db/index';
import {
  createTag,
  setTagsForTransaction,
  getTagsForTransaction,
  deleteTag,
  getAllTags,
} from '../../../../../electron/db/queries/tags';
import { parseAutoTagResponse, applyTagRules } from '../../../../../electron/ipc/tags';
import type { TagRule } from '../../../../../electron/db/queries/tag-rules';
import type Database from 'better-sqlite3';

let db: Database.Database;
let accountId: number;
let txId: number;

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
  accountId = seedAccount(db);
  txId = seedTransaction(db, { account_id: accountId });
});

describe('createTag', () => {
  it('creates a new tag and returns its id', () => {
    const id = createTag({ name: 'Work', color: '#ff0000' });
    expect(id).toBeGreaterThan(0);
  });

  it('returns existing id when tag name already exists (case-insensitive)', () => {
    const id1 = createTag({ name: 'Work', color: '#ff0000' });
    const id2 = createTag({ name: 'work', color: '#00ff00' });
    expect(id1).toBe(id2);
  });
});

describe('setTagsForTransaction', () => {
  it('assigns tags to a transaction', () => {
    const tagId = createTag({ name: 'Business', color: '#0000ff' });
    setTagsForTransaction(txId, [tagId]);

    const tags = getTagsForTransaction(txId);
    expect(tags.length).toBe(1);
    expect(tags[0].id).toBe(tagId);
  });

  it('replaces all previous tags atomically on second call', () => {
    const tag1 = createTag({ name: 'Tag1', color: '#111111' });
    const tag2 = createTag({ name: 'Tag2', color: '#222222' });

    setTagsForTransaction(txId, [tag1, tag2]);
    setTagsForTransaction(txId, [tag2]); // Replace with only tag2

    const tags = getTagsForTransaction(txId);
    expect(tags.length).toBe(1);
    expect(tags[0].id).toBe(tag2);
  });

  it('clears all tags when called with an empty array', () => {
    const tagId = createTag({ name: 'ToRemove', color: '#333333' });
    setTagsForTransaction(txId, [tagId]);
    setTagsForTransaction(txId, []);

    expect(getTagsForTransaction(txId)).toHaveLength(0);
  });
});

describe('parseAutoTagResponse', () => {
  it('strategy 1: parses a clean JSON array', () => {
    const input = JSON.stringify([{ id: 1, tags: ['Healthcare'] }, { id: 2, tags: [] }]);
    const result = parseAutoTagResponse(input);
    expect(result).toEqual([{ id: 1, tags: ['Healthcare'] }, { id: 2, tags: [] }]);
  });

  it('strategy 2: extracts array embedded in prose', () => {
    const input = 'Sure! Here is the result:\n[{"id":5,"tags":["Subscriptions"]}]\nDone.';
    const result = parseAutoTagResponse(input);
    expect(result).toEqual([{ id: 5, tags: ['Subscriptions'] }]);
  });

  it('strategy 3: converts object-keyed response to array', () => {
    const input = JSON.stringify({
      '8758': { tags: ['Healthcare'] },
      '8759': { tags: [] },
      '8760': { tags: ['Subscriptions'] },
    });
    const result = parseAutoTagResponse(input);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ id: 8758, tags: ['Healthcare'] });
    expect(result).toContainEqual({ id: 8759, tags: [] });
    expect(result).toContainEqual({ id: 8760, tags: ['Subscriptions'] });
  });

  it('strategy 3: handles missing tags field gracefully', () => {
    const input = JSON.stringify({ '1': {}, '2': { tags: ['Food'] } });
    const result = parseAutoTagResponse(input);
    expect(result).toContainEqual({ id: 1, tags: [] });
    expect(result).toContainEqual({ id: 2, tags: ['Food'] });
  });

  it('returns null for unparseable input', () => {
    expect(parseAutoTagResponse('not json at all')).toBeNull();
    expect(parseAutoTagResponse('')).toBeNull();
  });
});

describe('deleteTag', () => {
  it('removes the tag from the tags table', () => {
    const tagId = createTag({ name: 'Temp', color: '#444444' });
    const beforeCount = getAllTags().length;
    deleteTag(tagId);
    expect(getAllTags().length).toBe(beforeCount - 1);
  });

  it('cascade-deletes tag assignments from transaction_tags', () => {
    const tagId = createTag({ name: 'CascadeTest', color: '#555555' });
    setTagsForTransaction(txId, [tagId]);

    deleteTag(tagId);

    expect(getTagsForTransaction(txId)).toHaveLength(0);
  });
});

// ── applyTagRules ─────────────────────────────────────────────────────────────

function makeRule(overrides: Partial<TagRule> = {}): TagRule {
  return {
    id: 1,
    tag_id: 10,
    tag_name: 'Subscriptions',
    pattern: 'netflix',
    action: 'exclude',
    created_at: '2025-01-01',
    ...overrides,
  };
}

describe('applyTagRules', () => {
  const tagNameToId = new Map([['subscriptions', 10], ['healthcare', 20]]);

  it('blocks a matching tag on a matching description', () => {
    const results = [{ id: 1, tags: ['Subscriptions'] }];
    const batch = [{ id: 1, description: 'Netflix Monthly' }];
    applyTagRules(results, batch, [makeRule()], tagNameToId);
    expect(results[0].tags).toHaveLength(0);
  });

  it('does not block when description does not contain the pattern', () => {
    const results = [{ id: 1, tags: ['Subscriptions'] }];
    const batch = [{ id: 1, description: 'Spotify Premium' }];
    applyTagRules(results, batch, [makeRule()], tagNameToId);
    expect(results[0].tags).toEqual(['Subscriptions']);
  });

  it('does not block when the tag name does not match the rule', () => {
    const results = [{ id: 1, tags: ['Healthcare'] }];
    const batch = [{ id: 1, description: 'Netflix Monthly' }];
    // Rule targets tag_id 10 (Subscriptions), not 20 (Healthcare)
    applyTagRules(results, batch, [makeRule()], tagNameToId);
    expect(results[0].tags).toEqual(['Healthcare']);
  });

  it('pattern matching is case-insensitive', () => {
    const results = [{ id: 1, tags: ['Subscriptions'] }];
    const batch = [{ id: 1, description: 'NETFLIX ANNUAL' }];
    applyTagRules(results, batch, [makeRule({ pattern: 'Netflix' })], tagNameToId);
    expect(results[0].tags).toHaveLength(0);
  });

  it('multiple rules: only matching ones block', () => {
    const rules = [
      makeRule({ pattern: 'netflix' }),
      makeRule({ id: 2, tag_id: 20, tag_name: 'Healthcare', pattern: 'pharmacy' }),
    ];
    const results = [
      { id: 1, tags: ['Subscriptions', 'Healthcare'] },
      { id: 2, tags: ['Healthcare'] },
    ];
    const batch = [
      { id: 1, description: 'Netflix Monthly' },    // hits rule 1 only
      { id: 2, description: 'CVS Pharmacy' },        // hits rule 2 only
    ];
    applyTagRules(results, batch, rules, tagNameToId);
    expect(results[0].tags).toEqual(['Healthcare']); // Subscriptions blocked, Healthcare kept
    expect(results[1].tags).toHaveLength(0);         // Healthcare blocked
  });

  it('empty rules array leaves results unchanged', () => {
    const results = [{ id: 1, tags: ['Subscriptions', 'Healthcare'] }];
    const batch = [{ id: 1, description: 'Netflix Monthly' }];
    applyTagRules(results, batch, [], tagNameToId);
    expect(results[0].tags).toEqual(['Subscriptions', 'Healthcare']);
  });
});
