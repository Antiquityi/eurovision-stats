import { describe, it, expect } from 'vitest';
import { parseRating, formatRating, filterRatingInput, ratingTone } from '../../../src/domain/ratings.js';
import { summarize, sortedEntries, podium } from '../../../src/domain/ranking.js';
import { normalizeCountry } from '../../../src/domain/countries.js';

describe('oceny i ranking', () => {
    it('colors 7–10 green, 0–2 red and the remaining scores neutral', () => {
        for (const value of [0, 0.5, 1, 1.5, 2]) expect(ratingTone(value)).toBe('score-low');
        for (const value of [2.5, 3, 4, 5, 6, 6.5]) expect(ratingTone(value)).toBe('score-neutral');
        for (const value of [7, 7.5, 8, 9, 10]) expect(ratingTone(value)).toBe('score-high');
        expect(ratingTone(null)).toBe('score-empty');
    });
    it('parses halves, comma and blank without coercing garbage', () => {
        expect(parseRating('5,5')).toBe(5.5);
        expect(parseRating('')).toBeNull();
        expect(formatRating(5.5)).toBe('5,5');
        expect(parseRating('0')).toBe(0);
        expect(parseRating('0,5')).toBe(0.5);
        for (const value of ['11', '5.2', '1e1', '5abc', true, undefined]) {
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
        expect(summarize({ ratings: { a: 0, b: null } })).toEqual({ total: 0, count: 1, possible: 2 });
        expect(podium([{ order: 1, ratings: { a: 0 } }])[0].score).toBe(0);
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
        for (let value = 0; value <= 10; value += 0.5) {
            expect(parseRating(formatRating(value))).toBe(value);
        }
        expect(parseRating('  8,5  ')).toBe(8.5);
        expect(parseRating('   ')).toBeNull();
        for (const value of [Infinity, NaN, -1, '5,5,5', '5 5', '0xA', '10.5', '7.25']) {
            expect(() => parseRating(value)).toThrow();
        }
    });
    it('blocks invalid typing, permits decimal intermediates and caps above ten', () => {
        expect(filterRatingInput('0,')).toBe('0,');
        expect(filterRatingInput('0,5')).toBe('0,5');
        expect(filterRatingInput('1.5')).toBe('1,5');
        expect(filterRatingInput('11')).toBe('10');
        expect(filterRatingInput('10,5')).toBe('10');
        expect(filterRatingInput('999')).toBe('10');
        expect(filterRatingInput('')).toBe('');
        for (const value of ['1,4', 'abc', '-1', '1e1', '5,5,5']) {
            expect(filterRatingInput(value, '8')).toBe('8');
        }
        expect(filterRatingInput('1,4', '1,')).toBe('1,');
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
