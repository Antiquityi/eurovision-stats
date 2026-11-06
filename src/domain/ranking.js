export function summarize(entry) {
    const values = Object.values(entry.ratings).filter(value => value !== null);
    return { total: values.length ? values.reduce((sum, value) => sum + value, 0) : null,
        count: values.length, possible: Object.keys(entry.ratings).length };
}

export function score(entry, key) {
    return key === 'total' ? summarize(entry).total : entry.ratings[key] ?? null;
}

export function sortedEntries(entries, key = 'order', direction = 'desc') {
    return [...entries].sort((a, b) => {
        if (key === 'order') return a.order - b.order;
        const av = score(a, key), bv = score(b, key);
        if (av === null || bv === null) return av === bv ? a.order - b.order : av === null ? 1 : -1;
        return (direction === 'desc' ? bv - av : av - bv) || a.order - b.order;
    });
}

export function podium(entries, key = 'total') {
    let previous, rank;
    return sortedEntries(entries, key).filter(entry => score(entry, key) !== null).map((entry, index) => {
        const value = score(entry, key);
        if (value !== previous) rank = index + 1;
        previous = value;
        return { ...entry, rank, score: value };
    }).filter(entry => entry.rank <= 3);
}
