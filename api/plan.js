// Short-code storage for toy "share a plan" links, so the URL stays tiny and
// trustworthy in WeChat (…/?p=AB2CD3K) instead of a 300-char base64 blob.
// POST { config } -> { code };   GET ?code=CODE -> { config }
// Backed by the same Upstash Redis as the family sync; degrades to { configured:false }.
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const CONFIGURED = !!(REST_URL && REST_TOKEN);

const key = (code) => 'plan:' + String(code).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16);
function genCode() {
  const s = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no confusable chars
  let r = '';
  for (let i = 0; i < 7; i++) r += s[Math.floor(Math.random() * s.length)];
  return r;
}
async function redisSet(k, v) {
  const r = await fetch(`${REST_URL}/set/${encodeURIComponent(k)}`, { method: 'POST', headers: { Authorization: `Bearer ${REST_TOKEN}` }, body: v });
  return r.ok;
}
async function redisGet(k) {
  const r = await fetch(`${REST_URL}/get/${encodeURIComponent(k)}`, { headers: { Authorization: `Bearer ${REST_TOKEN}` } });
  if (!r.ok) throw new Error('redis get ' + r.status);
  return (await r.json()).result;
}

export default async function handler(req, res) {
  if (!CONFIGURED) { res.status(200).json({ configured: false }); return; }
  try {
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const config = body?.config;
      if (!config || typeof config.name !== 'string') { res.status(400).json({ error: 'config required' }); return; }
      const code = genCode();
      await redisSet(key(code), JSON.stringify(config));
      res.status(200).json({ configured: true, code });
      return;
    }
    if (req.method === 'GET') {
      const code = req.query.code;
      if (!code) { res.status(400).json({ error: 'code required' }); return; }
      const raw = await redisGet(key(code));
      res.status(200).json({ configured: true, config: raw ? JSON.parse(raw) : null });
      return;
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(200).json({ configured: true, ok: false, error: e?.message || 'error' });
  }
}
