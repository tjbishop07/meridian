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
