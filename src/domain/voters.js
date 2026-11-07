export function normalizeVoterName(value) {
    if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > 80) {
        throw new Error('Imię musi mieć od 1 do 80 znaków.');
    }
    return value.trim();
}
