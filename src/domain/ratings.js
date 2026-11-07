export function parseRating(input) {
    if (input === null || (typeof input === 'string' && input.trim() === '')) return null;
    if (typeof input !== 'number' && typeof input !== 'string') throw new Error('Podaj ocenę od 0 do 10, co 0,5.');
    const text = String(input).trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(text)) throw new Error('Podaj liczbę, np. 7,5.');
    const value = Number(text.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0 || value > 10 || !Number.isInteger(value * 2)) {
        throw new Error('Ocena musi wynosić od 0 do 10, co 0,5.');
    }
    return value;
}

// Permit an unfinished decimal separator while typing; reject other invalid edits.
export function filterRatingInput(input, previous = '') {
    const text = input.trim().replace('.', ',');
    if (text === '') return '';
    if (!/^\d+(?:,\d*)?$/.test(text)) return previous;
    const value = Number(text.replace(',', '.'));
    if (value > 10) return '10';
    if (!Number.isInteger(value * 2)) return previous;
    return text;
}

const numberFormat = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });
export function formatRating(value) {
    return value === null || value === undefined ? '—' : numberFormat.format(value);
}

export function ratingTone(value) {
    if (value === null || value === undefined) return 'score-empty';
    if (value >= 7) return 'score-high';
    if (value <= 2) return 'score-low';
    return 'score-neutral';
}
