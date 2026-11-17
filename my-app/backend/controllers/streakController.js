import { getStreak } from '../services/streak.js';
import { resolveTimeZone } from '../services/timeZone.js';

// GET /streak (CA-28) -> { count, countedToday }. The rule is in services/streak.js.
export async function showStreak(req, res) {
    const resolved = resolveTimeZone(req);
    if (resolved.error) return res.status(400).json({ error: resolved.error });

    const streak = await getStreak(req.user.id, resolved.timeZone);
    if (!streak) return res.status(401).json({ error: 'User no longer exists' });
    return res.json(streak);
}
