import { describe, it, expect } from 'vitest';
import { parseRating, formatRating } from '../../../src/domain/ratings.js';
import { summarize, sortedEntries, podium } from '../../../src/domain/ranking.js';
import { normalizeCountry } from '../../../src/domain/countries.js';

describe('oceny i ranking', () => {
    it('parses halves, comma and blank without coercing garbage', () => {
        expect(parseRating('5,5')).toBe(5.5);
        expect(parseRating('')).toBeNull();
        expect(formatRating(5.5)).toBe('5,5');
        for (const value of ['0', '11', '5.2', '1e1', '5abc', true, undefined]) {
            expect(() => parseRating(value)).toThrow();
        }
    });
    it('counts only submitted ratings and uses competition ranks', () => {
        const rows = [
            { order: 3, ratings: { a: null, b: null } },
            { order: 2, ratings: { a: 8, b: null } },
            { order: 1, ratings: { a: 4, b: 4 } },
            { order: 4, ratings: { a: 7, b: null } },
        ];
        expect(summarize(rows[0]).total).toBeNull();
        expect(summarize(rows[1])).toEqual({ total: 8, count: 1, possible: 2 });
        expect(sortedEntries(rows, 'total', 'desc').map(r => r.order)).toEqual([1, 2, 4, 3]);
        expect(sortedEntries(rows, 'a', 'asc').map(r => r.order)).toEqual([1, 4, 2, 3]);
        expect(podium(rows).map(r => r.rank)).toEqual([1, 1, 3]);
    });
    it('normalizes Polish, English, GB and Asian countries', () => {
        expect(normalizeCountry('United Kingdom')).toEqual({ code: 'GB', name: 'Wielka Brytania' });
        expect(normalizeCountry('Włochy').code).toBe('IT');
        expect(normalizeCountry('Japan').name).toBe('Japonia');
        expect(() => normalizeCountry('Atlantis')).toThrow();
        expect(() => normalizeCountry('Korea')).toThrow();
        expect(() => normalizeCountry('constructor')).toThrow();
        expect(normalizeCountry('  wlochy  ').code).toBe('IT');
    });
    it('accepts every half-point and never silently rounds an invalid score', () => {
        for (let value = 1; value <= 10; value += 0.5) {
            expect(parseRating(formatRating(value))).toBe(value);
        }
        expect(parseRating('  8,5  ')).toBe(8.5);
        expect(parseRating('   ')).toBeNull();
        for (const value of [Infinity, NaN, -1, 0.5, '5,5,5', '5 5', '0xA', '10.5', '7.25']) {
            expect(() => parseRating(value)).toThrow();
        }
    });
    it('keeps missing values last in both directions and leaves input rows untouched', () => {
        const rows = [
            { order: 3, ratings: { a: null } },
            { order: 2, ratings: { a: 5.5 } },
            { order: 1, ratings: { a: 5.5 } },
            { order: 4, ratings: { a: 1 } },
        ];
        for (const key of ['a', 'total']) {
            expect(sortedEntries(rows, key, 'desc').map(r => r.order)).toEqual([1, 2, 4, 3]);
            expect(sortedEntries(rows, key, 'asc').map(r => r.order)).toEqual([4, 1, 2, 3]);
        }
        expect(rows.map(r => r.order)).toEqual([3, 2, 1, 4]);
        expect(sortedEntries(rows, 'order').map(r => r.order)).toEqual([1, 2, 3, 4]);
    });
    it('excludes unsubmitted votes from podiums and does not force three winners', () => {
        const rows = [
            { order: 1, ratings: { a: 10 } },
            { order: 2, ratings: { a: 10 } },
            { order: 3, ratings: { a: 10 } },
            { order: 4, ratings: { a: 9.5 } },
            { order: 5, ratings: { a: null } },
        ];
        expect(podium(rows, 'a').map(r => r.rank)).toEqual([1, 1, 1]);
        expect(podium([{ order: 1, ratings: { a: null } }])).toEqual([]);
    });
});
