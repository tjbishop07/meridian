import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedAccount } from '../../../../setup/db-helpers';
import type Database from 'better-sqlite3';

vi.mock('../../../../../electron/db/index', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../../../electron/db/index';
import {
  getAllTagRules,
  getTagRulesForTag,
  createTagRule,
  deleteTagRule,
} from '../../../../../electron/db/queries/tag-rules';
import { createTag, deleteTag } from '../../../../../electron/db/queries/tags';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
  seedAccount(db);
});

// ── createTagRule ─────────────────────────────────────────────────────────────

describe('createTagRule', () => {
  it('creates a rule and returns its id', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const id = createTagRule({ tag_id: tagId, pattern: 'netflix' });
    expect(id).toBeGreaterThan(0);
  });

  it('stores the pattern and tag_id correctly', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    createTagRule({ tag_id: tagId, pattern: 'netflix' });

    const rules = getTagRulesForTag(tagId);
    expect(rules).toHaveLength(1);
    expect(rules[0].tag_id).toBe(tagId);
    expect(rules[0].pattern).toBe('netflix');
    expect(rules[0].action).toBe('exclude');
  });

  it('allows multiple rules for the same tag', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    createTagRule({ tag_id: tagId, pattern: 'netflix' });
    createTagRule({ tag_id: tagId, pattern: 'spotify' });

    expect(getTagRulesForTag(tagId)).toHaveLength(2);
  });

  it('allows the same pattern on different tags', () => {
    const tag1 = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const tag2 = createTag({ name: 'Entertainment', color: '#ef4444' });
    createTagRule({ tag_id: tag1, pattern: 'netflix' });
    createTagRule({ tag_id: tag2, pattern: 'netflix' });

    expect(getTagRulesForTag(tag1)).toHaveLength(1);
    expect(getTagRulesForTag(tag2)).toHaveLength(1);
  });
});

// ── getAllTagRules ─────────────────────────────────────────────────────────────

describe('getAllTagRules', () => {
  it('returns empty array when no rules exist', () => {
    expect(getAllTagRules()).toEqual([]);
  });

  it('returns all rules across all tags', () => {
    const tag1 = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const tag2 = createTag({ name: 'Healthcare', color: '#10b981' });
    createTagRule({ tag_id: tag1, pattern: 'netflix' });
    createTagRule({ tag_id: tag2, pattern: 'pharmacy' });

    expect(getAllTagRules()).toHaveLength(2);
  });

  it('joins tag_name from the tags table', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    createTagRule({ tag_id: tagId, pattern: 'netflix' });

    const rules = getAllTagRules();
    expect(rules[0].tag_name).toBe('Subscriptions');
    expect(rules[0].tag_id).toBe(tagId);
  });

  it('returns rules ordered by created_at descending (newest first)', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const id1 = createTagRule({ tag_id: tagId, pattern: 'first' });
    const id2 = createTagRule({ tag_id: tagId, pattern: 'second' });
    // CURRENT_TIMESTAMP has second precision — pin distinct timestamps explicitly
    db.prepare("UPDATE tag_rules SET created_at = '2025-01-01T00:00:00' WHERE id = ?").run(id1);
    db.prepare("UPDATE tag_rules SET created_at = '2025-01-02T00:00:00' WHERE id = ?").run(id2);

    const rules = getAllTagRules();
    const idx1 = rules.findIndex((r) => r.id === id1);
    const idx2 = rules.findIndex((r) => r.id === id2);
    // id2 has the later timestamp so it should come first
    expect(idx2).toBeLessThan(idx1);
  });
});

// ── getTagRulesForTag ─────────────────────────────────────────────────────────

describe('getTagRulesForTag', () => {
  it('returns empty array for a tag with no rules', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    expect(getTagRulesForTag(tagId)).toEqual([]);
  });

  it('returns only rules belonging to the specified tag', () => {
    const tag1 = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const tag2 = createTag({ name: 'Healthcare', color: '#10b981' });
    createTagRule({ tag_id: tag1, pattern: 'netflix' });
    createTagRule({ tag_id: tag2, pattern: 'pharmacy' });

    const rules = getTagRulesForTag(tag1);
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern).toBe('netflix');
    expect(rules[0].tag_id).toBe(tag1);
  });

  it('returns rules for tag ordered by created_at descending', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const id1 = createTagRule({ tag_id: tagId, pattern: 'first' });
    const id2 = createTagRule({ tag_id: tagId, pattern: 'second' });
    // Pin distinct timestamps — CURRENT_TIMESTAMP has second precision in SQLite
    db.prepare("UPDATE tag_rules SET created_at = '2025-01-01T00:00:00' WHERE id = ?").run(id1);
    db.prepare("UPDATE tag_rules SET created_at = '2025-01-02T00:00:00' WHERE id = ?").run(id2);

    const rules = getTagRulesForTag(tagId);
    expect(rules[0].id).toBe(id2);
    expect(rules[1].id).toBe(id1);
  });
});

// ── deleteTagRule ─────────────────────────────────────────────────────────────

describe('deleteTagRule', () => {
  it('removes the specified rule', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const ruleId = createTagRule({ tag_id: tagId, pattern: 'netflix' });

    deleteTagRule(ruleId);

    expect(getTagRulesForTag(tagId)).toHaveLength(0);
    expect(getAllTagRules()).toHaveLength(0);
  });

  it('only removes the targeted rule, leaving others intact', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const id1 = createTagRule({ tag_id: tagId, pattern: 'netflix' });
    const id2 = createTagRule({ tag_id: tagId, pattern: 'spotify' });

    deleteTagRule(id1);

    const remaining = getTagRulesForTag(tagId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });

  it('is a no-op for a non-existent id', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    createTagRule({ tag_id: tagId, pattern: 'netflix' });

    expect(() => deleteTagRule(99999)).not.toThrow();
    expect(getAllTagRules()).toHaveLength(1);
  });
});

// ── cascade behaviour ─────────────────────────────────────────────────────────

describe('cascade on tag delete', () => {
  it('deletes rules when their parent tag is deleted', () => {
    const tagId = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    createTagRule({ tag_id: tagId, pattern: 'netflix' });
    createTagRule({ tag_id: tagId, pattern: 'spotify' });

    deleteTag(tagId);

    expect(getAllTagRules()).toHaveLength(0);
  });

  it('only removes rules for the deleted tag, not for others', () => {
    const tag1 = createTag({ name: 'Subscriptions', color: '#8b5cf6' });
    const tag2 = createTag({ name: 'Healthcare', color: '#10b981' });
    createTagRule({ tag_id: tag1, pattern: 'netflix' });
    createTagRule({ tag_id: tag2, pattern: 'pharmacy' });

    deleteTag(tag1);

    const remaining = getAllTagRules();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].tag_id).toBe(tag2);
  });
});
