import { describe, it, expect } from 'vitest';
import { derivePattern } from '../../../../src/lib/derivePattern';

describe('derivePattern', () => {
  it('extracts the first word and lowercases it', () => {
    expect(derivePattern('Starbucks Coffee #1234')).toBe('starbucks');
  });

  it('strips trailing digits from the first word', () => {
    expect(derivePattern('COSTCO WHSE #0123')).toBe('costco');
  });

  it('splits on dots (e.g. domain names)', () => {
    expect(derivePattern('NETFLIX.COM')).toBe('netflix');
  });

  it('splits on asterisks (e.g. Amazon order codes)', () => {
    expect(derivePattern('Amazon.com*1A2B3C4D')).toBe('amazon');
  });

  it('lowercases the result', () => {
    expect(derivePattern('WALMART STORE 4521')).toBe('walmart');
  });

  it('handles descriptions that are already lowercase', () => {
    expect(derivePattern('spotify premium')).toBe('spotify');
  });

  it('falls back to first 20 chars (lowercased) when first token is only digits', () => {
    const result = derivePattern('1234 5678 description');
    // "1234" strips digits → "", fallback to first 20 chars of trimmed input lowercased
    expect(result).toBe('1234 5678 descriptio');
  });

  it('handles a single-word description with no separators', () => {
    expect(derivePattern('TARGET')).toBe('target');
  });

  it('handles leading/trailing whitespace', () => {
    expect(derivePattern('  Starbucks  ')).toBe('starbucks');
  });

  it('always returns a lowercase string', () => {
    const result = derivePattern('UBER EATS DELIVERY');
    expect(result).toBe(result.toLowerCase());
  });
});
