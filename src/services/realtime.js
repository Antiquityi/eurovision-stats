export function createRealtimeService(client) {
    let sequence = 0;
    return {
        subscribe(contestId, { rating, contests, status }) {
            let closed = false;
            const channel = client.channel(`scoreboard-${++sequence}`);
            if (contestId) {
                for (const event of ['INSERT', 'UPDATE']) {
                    channel.on('postgres_changes', { event, schema: 'public', table: 'ratings', filter: `contest_id=eq.${contestId}` }, payload => {
                        if (!closed) rating(payload.new);
                    });
                }
            }
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'contests' }, () => { if (!closed) contests(); });
            channel.subscribe(value => { if (!closed) status(value); });
            return () => { closed = true; void client.removeChannel(channel); };
        },
    };
}
