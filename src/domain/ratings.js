export function parseRating(input) {
    if (input === null || (typeof input === 'string' && input.trim() === '')) return null;
    if (typeof input !== 'number' && typeof input !== 'string') throw new Error('Podaj ocenę od 1 do 10, co 0,5.');
    const text = String(input).trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(text)) throw new Error('Podaj liczbę, np. 7,5.');
    const value = Number(text.replace(',', '.'));
    if (!Number.isFinite(value) || value < 1 || value > 10 || !Number.isInteger(value * 2)) {
        throw new Error('Ocena musi wynosić od 1 do 10, co 0,5.');
    }
    return value;
}

const numberFormat = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });
export function formatRating(value) {
    return value === null || value === undefined ? '—' : numberFormat.format(value);
}

export function ratingTone(value) {
    if (value === null || value === undefined) return 'score-empty';
    if (value >= 8) return 'score-high';
    if (value < 5) return 'score-low';
    return 'score-neutral';
}
