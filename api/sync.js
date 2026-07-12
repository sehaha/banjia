// Shared-board sync backed by Upstash Redis (via the Vercel Marketplace "Upstash"
// integration, or a direct Upstash DB). Reads REST creds from env; if absent the
// endpoint reports { configured:false } and the client stays local-only.
//
// GET  /api/sync?room=CODE        -> { configured, envelope|null }
// POST /api/sync { room, envelope} -> { configured, ok }
// envelope = { data:{tasks,utils,docs,members,memory}, rev, updatedAt, origin }

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const CONFIGURED = !!(REST_URL && REST_TOKEN);

const key = (room) => 'mg:' + String(room).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

async function redisGet(k) {
  const r = await fetch(`${REST_URL}/get/${encodeURIComponent(k)}`, { headers: { Authorization: `Bearer ${REST_TOKEN}` } });
  if (!r.ok) throw new Error('redis get ' + r.status);
  const j = await r.json();
  return j.result; // string or null
}
async function redisSet(k, value) {
  const r = await fetch(`${REST_URL}/set/${encodeURIComponent(k)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}` },
    body: value,
  });
  if (!r.ok) throw new Error('redis set ' + r.status);
}

export default async function handler(req, res) {
  if (!CONFIGURED) {
    res.status(200).json({ configured: false });
    return;
  }
  try {
    if (req.method === 'GET') {
      const room = req.query.room;
      if (!room) { res.status(400).json({ error: 'room required' }); return; }
      const raw = await redisGet(key(room));
      res.status(200).json({ configured: true, envelope: raw ? JSON.parse(raw) : null });
      return;
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const { room, envelope } = body || {};
      if (!room || !envelope || !envelope.data) { res.status(400).json({ error: 'room and envelope required' }); return; }
      await redisSet(key(room), JSON.stringify(envelope));
      res.status(200).json({ configured: true, ok: true });
      return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(200).json({ configured: true, ok: false, error: e?.message || 'sync error' });
  }
}
