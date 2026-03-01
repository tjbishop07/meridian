import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedAccount, seedTransaction } from '../../../setup/db-helpers';
import type Database from 'better-sqlite3';

vi.mock('../../../../electron/db/index', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../../electron/db/index';
import { createTag } from '../../../../electron/db/queries/tags';
import { setTagsForTransaction, getTagsForTransaction } from '../../../../electron/db/queries/tags';
import { applyRuleToDb } from '../../../../electron/ipc/tags';

let db: Database.Database;
let accountId: number;

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
  accountId = seedAccount(db);
});

// ── include rules ─────────────────────────────────────────────────────────────

describe('applyRuleToDb — include', () => {
  it('adds the tag to a matching transaction', () => {
    const tagId = createTag({ name: 'Coffee', color: '#6366f1' });
    const txId = seedTransaction(db, { account_id: accountId, description: 'Starbucks Reserve' });

    const count = applyRuleToDb({ tag_id: tagId, action: 'include', pattern: 'starbucks' }, db);

    expect(count).toBe(1);
    const tags = getTagsForTransaction(txId);
    expect(tags.map((t) => t.id)).toContain(tagId);
  });

  it('is case-insensitive', () => {
    const tagId = createTag({ name: 'Coffee', color: '#6366f1' });
    const txId = seedTransaction(db, { account_id: accountId, description: 'STARBUCKS DRIVE THRU' });

    applyRuleToDb({ tag_id: tagId, action: 'include', pattern: 'starbucks' }, db);

    expect(getTagsForTransaction(txId).map((t) => t.id)).toContain(tagId);
  });

  it('does not tag transactions that do not match the pattern', () => {
    const tagId = createTag({ name: 'Coffee', color: '#6366f1' });
    const txId = seedTransaction(db, { account_id: accountId, description: 'Dunkin Donuts' });

    const count = applyRuleToDb({ tag_id: tagId, action: 'include', pattern: 'starbucks' }, db);

    expect(count).toBe(0);
    expect(getTagsForTransaction(txId)).toHaveLength(0);
  });

  it('skips transactions already tagged and does not count them', () => {
    const tagId = createTag({ name: 'Coffee', color: '#6366f1' });
    const txId = seedTransaction(db, { account_id: accountId, description: 'Starbucks Reserve' });
    setTagsForTransaction(txId, [tagId]); // already tagged

    const count = applyRuleToDb({ tag_id: tagId, action: 'include', pattern: 'starbucks' }, db);

    expect(count).toBe(0);
    expect(getTagsForTransaction(txId)).toHaveLength(1); // unchanged
  });

  it('preserves existing tags when adding a new one', () => {
    const tagA = createTag({ name: 'Coffee', color: '#6366f1' });
    const tagB = createTag({ name: 'Dining', color: '#ef4444' });
    const txId = seedTransaction(db, { account_id: accountId, description: 'Starbucks Reserve' });
    setTagsForTransaction(txId, [tagB]); // already has tagB

    applyRuleToDb({ tag_id: tagA, action: 'include', pattern: 'starbucks' }, db);

    const tagIds = getTagsForTransaction(txId).map((t) => t.id);
    expect(tagIds).toContain(tagA);
    expect(tagIds).toContain(tagB);
  });

  it('tags multiple matching transactions', () => {
    const tagId = createTag({ name: 'Coffee', color: '#6366f1' });
    const tx1 = seedTransaction(db, { account_id: accountId, description: 'Starbucks #001' });
    const tx2 = seedTransaction(db, { account_id: accountId, description: 'Starbucks #002' });
    const tx3 = seedTransaction(db, { account_id: accountId, description: 'McDonalds' });

    const count = applyRuleToDb({ tag_id: tagId, action: 'include', pattern: 'starbucks' }, db);

    expect(count).toBe(2);
    expect(getTagsForTransaction(tx1).map((t) => t.id)).toContain(tagId);
    expect(getTagsForTransaction(tx2).map((t) => t.id)).toContain(tagId);
    expect(getTagsForTransaction(tx3)).toHaveLength(0);
  });

  it('returns 0 when no transactions exist', () => {
    const tagId = createTag({ name: 'Coffee', color: '#6366f1' });
    const count = applyRuleToDb({ tag_id: tagId, action: 'include', pattern: 'starbucks' }, db);
    expect(count).toBe(0);
  });
});

// ── exclude rules ─────────────────────────────────────────────────────────────

describe('applyRuleToDb — exclude', () => {
  it('removes the tag from a matching transaction that has it', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const txId = seedTransaction(db, { account_id: accountId, description: 'Netflix Monthly' });
    setTagsForTransaction(txId, [tagId]);

    const count = applyRuleToDb({ tag_id: tagId, action: 'exclude', pattern: 'netflix' }, db);

    expect(count).toBe(1);
    expect(getTagsForTransaction(txId)).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const txId = seedTransaction(db, { account_id: accountId, description: 'NETFLIX ANNUAL' });
    setTagsForTransaction(txId, [tagId]);

    applyRuleToDb({ tag_id: tagId, action: 'exclude', pattern: 'Netflix' }, db);

    expect(getTagsForTransaction(txId)).toHaveLength(0);
  });

  it('does not touch transactions that do not match the pattern', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const txId = seedTransaction(db, { account_id: accountId, description: 'Spotify Premium' });
    setTagsForTransaction(txId, [tagId]);

    const count = applyRuleToDb({ tag_id: tagId, action: 'exclude', pattern: 'netflix' }, db);

    expect(count).toBe(0);
    expect(getTagsForTransaction(txId).map((t) => t.id)).toContain(tagId);
  });

  it('does not touch matching transactions that do not have the tag', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const txId = seedTransaction(db, { account_id: accountId, description: 'Netflix Monthly' });
    // transaction matches pattern but tag was never applied

    const count = applyRuleToDb({ tag_id: tagId, action: 'exclude', pattern: 'netflix' }, db);

    expect(count).toBe(0);
    expect(getTagsForTransaction(txId)).toHaveLength(0);
  });

  it('preserves other tags when removing the excluded one', () => {
    const tagSub = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const tagEnt = createTag({ name: 'Entertainment', color: '#ef4444' });
    const txId = seedTransaction(db, { account_id: accountId, description: 'Netflix Monthly' });
    setTagsForTransaction(txId, [tagSub, tagEnt]);

    applyRuleToDb({ tag_id: tagSub, action: 'exclude', pattern: 'netflix' }, db);

    const remaining = getTagsForTransaction(txId).map((t) => t.id);
    expect(remaining).not.toContain(tagSub);
    expect(remaining).toContain(tagEnt);
  });

  it('removes tag from multiple matching transactions', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const tx1 = seedTransaction(db, { account_id: accountId, description: 'Netflix Monthly' });
    const tx2 = seedTransaction(db, { account_id: accountId, description: 'Netflix Annual' });
    const tx3 = seedTransaction(db, { account_id: accountId, description: 'Spotify Premium' });
    setTagsForTransaction(tx1, [tagId]);
    setTagsForTransaction(tx2, [tagId]);
    setTagsForTransaction(tx3, [tagId]);

    const count = applyRuleToDb({ tag_id: tagId, action: 'exclude', pattern: 'netflix' }, db);

    expect(count).toBe(2);
    expect(getTagsForTransaction(tx1)).toHaveLength(0);
    expect(getTagsForTransaction(tx2)).toHaveLength(0);
    expect(getTagsForTransaction(tx3).map((t) => t.id)).toContain(tagId); // untouched
  });
});
