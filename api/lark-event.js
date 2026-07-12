// Lark group bot: @mention the bot in the family group (or DM it) to add/complete
// tasks in natural language. Handles the `im.message.receive_v1` event, runs the
// shared assistant on the room's board, applies the actions, and replies in-chat.
// Configure this URL as the app's 事件订阅请求网址 and subscribe im.message.receive_v1.
import crypto from 'crypto';
import { runAssistant } from '../lib/assistant-core.js';
import { readRoomBoard, boardContext, applyActionsToRoom, sendTextToChat, seenEvent, larkRoom, currentDay } from '../lib/lark.js';

function decrypt(encrypt, key) {
  const aesKey = crypto.createHash('sha256').update(key).digest();
  const buf = Buffer.from(encrypt, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, buf.subarray(0, 16));
  decipher.setAutoPadding(false);
  let out = Buffer.concat([decipher.update(buf.subarray(16)), decipher.final()]);
  out = out.subarray(0, out.length - out[out.length - 1]); // strip PKCS7 padding
  return JSON.parse(out.toString('utf8'));
}

// Pull the human text out of a message, dropping @mention placeholders.
function messageText(msg) {
  let text = '';
  try {
    const c = JSON.parse(msg.content || '{}');
    if (msg.message_type === 'text') text = c.text || '';
    else if (msg.message_type === 'post') text = JSON.stringify(c); // rich text → best effort
    else text = c.text || '';
  } catch { /* leave blank */ }
  return text.replace(/@_user_\d+/g, '').replace(/@_all/g, '').replace(/\s+/g, ' ').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  // Decrypt when an Encrypt Key is configured (reject plaintext = anti-spoof).
  const encKey = process.env.LARK_ENCRYPT_KEY;
  if (encKey) {
    if (!body || !body.encrypt) { res.status(200).json({}); return; }
    try { body = decrypt(body.encrypt, encKey); } catch { res.status(200).json({}); return; }
  }

  // URL verification handshake.
  if (body && body.type === 'url_verification') { res.status(200).json({ challenge: body.challenge }); return; }

  // Optional token check.
  const vt = process.env.LARK_VERIFICATION_TOKEN;
  const token = body?.token || body?.header?.token;
  if (vt && token && token !== vt) { res.status(200).json({}); return; }

  const eventType = body?.header?.event_type || body?.event?.type;
  if (eventType !== 'im.message.receive_v1') { res.status(200).json({}); return; }

  // Ack fast; dedup so retries don't double-apply.
  const eventId = body?.header?.event_id || body?.event?.uuid;
  if (await seenEvent(eventId)) { res.status(200).json({}); return; }

  const ev = body.event || {};
  const msg = ev.message || {};
  const chatId = msg.chat_id;
  const chatType = msg.chat_type; // 'group' | 'p2p'
  const botMentioned = Array.isArray(msg.mentions) && msg.mentions.length > 0;

  // In groups only respond when @mentioned; in DMs always. Ack anything else.
  if (!chatId || (chatType === 'group' && !botMentioned)) { res.status(200).json({}); return; }

  const text = messageText(msg);
  if (!text) { res.status(200).json({}); return; }

  const room = larkRoom();
  try {
    const board = await readRoomBoard(room);
    if (!board) { await sendTextToChat(chatId, '⚠️ 还没连接到搬家清单（room 未配置）。'); res.status(200).json({}); return; }

    const ctx = boardContext(board, currentDay());
    const { reply, actions } = await runAssistant([{ role: 'user', content: text }], ctx);

    let results = [];
    if (actions.length) { const r = await applyActionsToRoom(room, actions); results = r.results || []; }

    const out = [reply, results.length ? '\n' + results.join('\n') : ''].join('').trim();
    await sendTextToChat(chatId, out || '好的。');
  } catch (e) {
    try { await sendTextToChat(chatId, '抱歉，处理出错了：' + (e?.message || '未知错误')); } catch { /* noop */ }
  }
  res.status(200).json({});
}
