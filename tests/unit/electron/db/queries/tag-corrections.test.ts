import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedAccount } from '../../../../setup/db-helpers';
import type Database from 'better-sqlite3';

vi.mock('../../../../../electron/db/index', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../../../electron/db/index';
import {
  getAllTagCorrections,
  createTagCorrection,
  deleteTagCorrection,
} from '../../../../../electron/db/queries/tag-corrections';
import { createTag, deleteTag } from '../../../../../electron/db/queries/tags';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
  seedAccount(db);
});

// ── createTagCorrection ────────────────────────────────────────────────────────

describe('createTagCorrection', () => {
  it('creates a correction and returns its id', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const id = createTagCorrection({ tag_id: tagId, description: 'Netflix Monthly', direction: 'positive' });
    expect(id).toBeGreaterThan(0);
  });

  it('stores the description and direction correctly', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    createTagCorrection({ tag_id: tagId, description: 'Costco #1234', direction: 'negative' });

    const corrections = getAllTagCorrections();
    expect(corrections).toHaveLength(1);
    expect(corrections[0].tag_id).toBe(tagId);
    expect(corrections[0].description).toBe('Costco #1234');
    expect(corrections[0].direction).toBe('negative');
  });

  it('allows both positive and negative directions', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    createTagCorrection({ tag_id: tagId, description: 'Netflix', direction: 'positive' });
    createTagCorrection({ tag_id: tagId, description: 'Costco', direction: 'negative' });

    const corrections = getAllTagCorrections();
    expect(corrections).toHaveLength(2);
    const directions = corrections.map((c) => c.direction);
    expect(directions).toContain('positive');
    expect(directions).toContain('negative');
  });

  it('allows multiple corrections for the same tag', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    createTagCorrection({ tag_id: tagId, description: 'Netflix', direction: 'positive' });
    createTagCorrection({ tag_id: tagId, description: 'Spotify', direction: 'positive' });

    expect(getAllTagCorrections()).toHaveLength(2);
  });
});

// ── getAllTagCorrections ───────────────────────────────────────────────────────

describe('getAllTagCorrections', () => {
  it('returns empty array when no corrections exist', () => {
    expect(getAllTagCorrections()).toEqual([]);
  });

  it('joins tag_name and tag_color from the tags table', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    createTagCorrection({ tag_id: tagId, description: 'Netflix', direction: 'positive' });

    const corrections = getAllTagCorrections();
    expect(corrections[0].tag_name).toBe('Subscriptions');
    expect(corrections[0].tag_color).toBe('#8b5cf6');
  });

  it('returns corrections ordered by created_at descending (newest first)', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const id1 = createTagCorrection({ tag_id: tagId, description: 'first', direction: 'positive' });
    const id2 = createTagCorrection({ tag_id: tagId, description: 'second', direction: 'positive' });
    // Pin distinct timestamps — CURRENT_TIMESTAMP has second precision in SQLite
    db.prepare("UPDATE tag_corrections SET created_at = '2025-01-01T00:00:00' WHERE id = ?").run(id1);
    db.prepare("UPDATE tag_corrections SET created_at = '2025-01-02T00:00:00' WHERE id = ?").run(id2);

    const corrections = getAllTagCorrections();
    const idx1 = corrections.findIndex((c) => c.id === id1);
    const idx2 = corrections.findIndex((c) => c.id === id2);
    // id2 has the later timestamp so it should come first
    expect(idx2).toBeLessThan(idx1);
  });
});

// ── deleteTagCorrection ───────────────────────────────────────────────────────

describe('deleteTagCorrection', () => {
  it('removes the specified correction', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const corrId = createTagCorrection({ tag_id: tagId, description: 'Netflix', direction: 'positive' });

    deleteTagCorrection(corrId);

    expect(getAllTagCorrections()).toHaveLength(0);
  });

  it('only removes the targeted correction, leaving others intact', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const id1 = createTagCorrection({ tag_id: tagId, description: 'Netflix', direction: 'positive' });
    const id2 = createTagCorrection({ tag_id: tagId, description: 'Spotify', direction: 'positive' });

    deleteTagCorrection(id1);

    const remaining = getAllTagCorrections();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });

  it('is a no-op for a non-existent id', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    createTagCorrection({ tag_id: tagId, description: 'Netflix', direction: 'positive' });

    expect(() => deleteTagCorrection(99999)).not.toThrow();
    expect(getAllTagCorrections()).toHaveLength(1);
  });
});

// ── cascade on tag delete ─────────────────────────────────────────────────────

describe('cascade on tag delete', () => {
  it('deletes corrections when their parent tag is deleted', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    createTagCorrection({ tag_id: tagId, description: 'Netflix', direction: 'positive' });
    createTagCorrection({ tag_id: tagId, description: 'Spotify', direction: 'negative' });

    deleteTag(tagId);

    expect(getAllTagCorrections()).toHaveLength(0);
  });

  it('only removes corrections for the deleted tag, not for others', () => {
    const tag1 = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const tag2 = createTag({ name: 'Healthcare', color: '#10b981' });
    createTagCorrection({ tag_id: tag1, description: 'Netflix', direction: 'positive' });
    createTagCorrection({ tag_id: tag2, description: 'CVS Pharmacy', direction: 'positive' });

    deleteTag(tag1);

    const remaining = getAllTagCorrections();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].tag_id).toBe(tag2);
  });
});
