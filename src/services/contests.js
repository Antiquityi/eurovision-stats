import { parseRating } from '../domain/ratings.js';
import { normalizeVoterName } from '../domain/voters.js';

const ratingFields = 'contest_id,entry_id,voter_id,value,revision';

function checked({ data, error }) {
    if (error) throw error;
    return data;
}

export function createContestService(client) {
    return {
        async resolveTie(contestId, { scope, score, entryIds, reset = false }) {
            return checked(await client.rpc('resolve_podium_tie', {
                p_contest_id: contestId, p_scope: scope, p_score: score,
                p_entry_ids: entryIds, p_reset: reset,
            }));
        },
        async manageVoter(contestId, { action, voterId = null, name = null }) {
            if (!['add', 'rename', 'delete'].includes(action)) throw new Error('Invalid action');
            return checked(await client.rpc('manage_voter', {
                p_contest_id: contestId, p_action: action, p_voter_id: voterId,
                p_name: action === 'delete' ? null : normalizeVoterName(name),
            }));
        },
        async listContests() {
            return checked(await client.from('contests').select('id,year,title').order('year', { ascending: false }).order('title', { ascending: true }));
        },
        async getContest(id) {
            // A single embedded SELECT supplies a consistent database snapshot.
            const data = checked(await client.from('contests').select(`id,year,title,tie_breaks,voters(id,key,name,position),entries(id,order,country_code,country_name),ratings(${ratingFields})`).eq('id', id).single());
            const voters = data.voters.sort((a, b) => a.position - b.position);
            return {
                id: data.id, year: data.year, title: data.title, voters, ratings: data.ratings,
                tieBreaks: data.tie_breaks ?? {},
                entries: data.entries.sort((a, b) => a.order - b.order).map(entry => ({
                    id: entry.id, order: entry.order, countryCode: entry.country_code, countryName: entry.country_name,
                    ratings: Object.fromEntries(voters.map(voter => [voter.id, null])),
                })),
            };
        },
        async saveRating(entryId, voterId, value) {
            parseRating(value);
            // UPDATE only: imports/provisioning must create the rating matrix first.
            return checked(await client.from('ratings').update({ value }).eq('entry_id', entryId).eq('voter_id', voterId).select(ratingFields).single());
        },
    };
}
