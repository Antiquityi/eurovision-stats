import { describe, expect, it } from 'vitest';
import { podium, podiumTies, sortedEntries, tieKey } from '../../../src/domain/ranking.js';

const entries = () => [
    { id: 'a', order: 1, ratings: { v: 8, w: 1 } },
    { id: 'b', order: 2, ratings: { v: 6, w: 2 } },
    { id: 'c', order: 3, ratings: { v: 6, w: 2 } },
    { id: 'd', order: 4, ratings: { v: 6, w: 2 } },
    { id: 'empty', order: 5, ratings: { v: null, w: null } },
];

describe('manual podium ties', () => {
    it('keeps competition ranks until the exact tied group has a saved order', () => {
        const rows = entries();
        expect(podium(rows, 'v').map(entry => entry.rank)).toEqual([1, 2, 2, 2]);
        const tie = podiumTies(rows, 'v')[0];
        const choices = { [tie.key]: ['d', 'c', 'b'] };
        expect(podium(rows, 'v', choices).map(entry => [entry.id, entry.rank])).toEqual([['a', 1], ['d', 2], ['c', 3]]);
        expect(sortedEntries(rows, 'v', 'desc', choices).map(entry => entry.id)).toEqual(['a', 'd', 'c', 'b', 'empty']);
        expect(sortedEntries(rows, 'v', 'asc', choices).at(-1).id).toBe('empty');
        expect(rows[1].ratings.v).toBe(6);
    });
    it('supports shared first place, zero, and independent total or person choices', () => {
        const rows = entries().slice(1, 4).map(entry => ({ ...entry, ratings: { v: 0, w: 0 } }));
        const key = tieKey(rows, 0);
        expect(podium(rows, 'v', { [key]: ['c', 'b', 'd'] }).map(entry => [entry.id, entry.rank])).toEqual([['c', 1], ['b', 2], ['d', 3]]);
        expect(podium(rows, 'total').map(entry => entry.rank)).toEqual([1, 1, 1]);
    });
    it('ignores saved choices after tied scores or members change, and rejects partial/duplicate choices', () => {
        const rows = entries();
        const tie = podiumTies(rows, 'v')[0];
        for (const ids of [['b', 'b', 'c'], ['b', 'c'], ['b', 'c', 'other']]) {
            expect(podium(rows, 'v', { [tie.key]: ids }).map(entry => entry.rank)).toEqual([1, 2, 2, 2]);
        }
        const choices = { [tie.key]: ['d', 'c', 'b'] };
        rows[3].ratings.v = 5;
        expect(podium(rows, 'v', choices).map(entry => [entry.id, entry.rank])).toEqual([['a', 1], ['b', 2], ['c', 2]]);
        rows[3].ratings.v = 6;
        rows[1].ratings.v = rows[2].ratings.v = rows[3].ratings.v = 6.5;
        expect(podium(rows, 'v', choices).map(entry => entry.rank)).toEqual([1, 2, 2, 2]);
    });
    it('offers only ties reaching the first three places and never includes all-blank countries', () => {
        const rows = entries();
        rows[1].ratings.v = 7;
        rows[2].ratings.v = 6;
        rows[3].ratings.v = 5;
        rows.push({ id: 'e', order: 6, ratings: { v: 5 } });
        expect(podiumTies(rows, 'v')).toEqual([]);
    });
});
