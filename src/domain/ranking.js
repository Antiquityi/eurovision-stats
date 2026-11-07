export function summarize(entry) {
    const values = Object.values(entry.ratings).filter(value => value !== null);
    return { total: values.length ? values.reduce((sum, value) => sum + value, 0) : null,
        count: values.length, possible: Object.keys(entry.ratings).length };
}

export function score(entry, key) {
    return key === 'total' ? summarize(entry).total : entry.ratings[key] ?? null;
}

export function tieKey(entries, value) {
    return `${value * 2}:${entries.map(entry => entry.id).sort().join(',')}`;
}

function resolvedOrder(entries, value, choices) {
    const ids = choices[tieKey(entries, value)];
    return Array.isArray(ids) && ids.length === entries.length
        && new Set(ids).size === ids.length && entries.every(entry => ids.includes(entry.id)) ? ids : null;
}

export function sortedEntries(entries, key = 'order', direction = 'desc', choices = {}) {
    return [...entries].sort((a, b) => {
        if (key === 'order') return a.order - b.order;
        const av = score(a, key), bv = score(b, key);
        if (av === null || bv === null) return av === bv ? a.order - b.order : av === null ? 1 : -1;
        if (av !== bv) return direction === 'desc' ? bv - av : av - bv;
        const tied = entries.filter(entry => score(entry, key) === av);
        const ids = resolvedOrder(tied, av, choices);
        return ids ? ids.indexOf(a.id) - ids.indexOf(b.id) : a.order - b.order;
    });
}

function scoreGroups(entries, key, choices = {}) {
    const groups = [];
    for (const entry of sortedEntries(entries, key, 'desc', choices)) {
        const value = score(entry, key);
        if (value === null) continue;
        if (groups.at(-1)?.score === value) groups.at(-1).entries.push(entry);
        else groups.push({ score: value, entries: [entry] });
    }
    let rank = 1;
    return groups.map(group => {
        const result = { ...group, rank, key: tieKey(group.entries, group.score) };
        rank += group.entries.length;
        return result;
    });
}

export function podiumTies(entries, key = 'total', choices = {}) {
    return scoreGroups(entries, key, choices).filter(group => group.entries.length > 1 && group.rank <= 3);
}

export function podium(entries, key = 'total', choices = {}) {
    return scoreGroups(entries, key, choices).flatMap(group => {
        const resolved = Boolean(resolvedOrder(group.entries, group.score, choices));
        return group.entries.map((entry, index) => ({ ...entry,
            rank: group.rank + (resolved ? index : 0), score: group.score,
        }));
    }).filter(entry => entry.rank <= 3);
}
