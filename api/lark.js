// Client-facing Lark push: GET reports whether the webhook is configured;
// POST relays a brief/alert card to the family group (webhook stays server-side).
import { larkConfigured, sendCardToAll, summarize, buildBriefCard, buildAlertCard } from '../lib/lark.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ configured: larkConfigured() });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!larkConfigured()) {
    res.status(200).json({ configured: false });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { kind, board, today, appUrl, title, content, room } = body || {};
  try {
    let card;
    if (kind === 'alert') card = buildAlertCard(title || '搬家提醒', content || '', appUrl);
    else card = buildBriefCard(summarize(board || {}, today), appUrl, room);
    const r = await sendCardToAll(card);
    res.status(200).json(r);
  } catch (e) {
    res.status(200).json({ configured: true, ok: false, error: e?.message || 'push failed' });
  }
}
