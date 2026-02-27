import { describe, it, expect } from 'vitest';
import { cn } from '../../../../src/lib/utils';

describe('cn()', () => {
  it('joins class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes (truthy)', () => {
    expect(cn('base', true && 'active')).toBe('base active');
  });

  it('omits conditional classes (falsy)', () => {
    expect(cn('base', false && 'hidden')).toBe('base');
  });

  it('resolves Tailwind conflicts (later class wins)', () => {
    // twMerge should resolve p-2 vs p-4 — last one wins
    const result = cn('p-2', 'p-4');
    expect(result).toBe('p-4');
    expect(result).not.toContain('p-2');
  });

  it('handles undefined and null gracefully', () => {
    expect(cn('base', undefined, null as any)).toBe('base');
  });

  it('handles arrays of classes', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('merges text-color conflicts', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });
});
