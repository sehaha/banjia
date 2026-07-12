// Scheduled daily brief: reads the family's synced board from Redis, computes
// today's summary, and pushes it to the Lark group. Triggered by Vercel Cron.
// Config: LARK_SYNC_ROOM (the family's room code), LARK_WEBHOOK_URL, and the
// KV_/UPSTASH_ Redis creds. Optionally CRON_SECRET to lock the endpoint down.
import { larkConfigured, sendCardToAll, summarize, buildBriefCard, readRoomBoard, currentDay } from '../../lib/lark.js';

export default async function handler(req, res) {
  // If a CRON_SECRET is set, require it (Vercel sends it as a Bearer token).
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (!larkConfigured()) {
    res.status(200).json({ configured: false, sent: false });
    return;
  }
  const room = process.env.LARK_SYNC_ROOM;
  if (!room) {
    res.status(200).json({ ok: false, reason: 'LARK_SYNC_ROOM not set' });
    return;
  }
  const board = await readRoomBoard(room);
  if (!board) {
    res.status(200).json({ ok: false, reason: 'no board found for room ' + room });
    return;
  }
  const appUrl = process.env.APP_URL || 'https://banjia-two.vercel.app/';
  const card = buildBriefCard(summarize(board, currentDay()), appUrl, room);
  const r = await sendCardToAll(card);
  res.status(200).json({ ok: !!r.ok, ...r });
}
