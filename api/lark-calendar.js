// One-shot: create the major move milestones on a Lark calendar with all family
// as attendees. Protected by CRON_SECRET. Idempotent (skips if already synced).
import { syncMilestones } from '../lib/lark.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization;
  const provided = auth || (req.query && req.query.key ? `Bearer ${req.query.key}` : '');
  if (secret && provided !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    const r = await syncMilestones();
    res.status(200).json(r);
  } catch (e) {
    res.status(200).json({ ok: false, error: e?.message || 'calendar sync failed' });
  }
}
