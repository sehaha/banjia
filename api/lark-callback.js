// Lark message-card callback: when a family member taps "✅ 我来完成" on a card,
// Lark POSTs here. We mark the task done in the shared room (web reflects in ≤4s)
// and return a refreshed "done" card. Handles URL verification + optional AES
// encryption. Configure this URL as the app's 消息卡片请求网址.
import crypto from 'crypto';
import { completeTask, larkMemberName, buildDoneCard } from '../lib/lark.js';

function decrypt(encrypt, key) {
  const aesKey = crypto.createHash('sha256').update(key).digest();
  const buf = Buffer.from(encrypt, 'base64');
  const iv = buf.subarray(0, 16);
  const data = buf.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  decipher.setAutoPadding(false);
  let out = Buffer.concat([decipher.update(data), decipher.final()]);
  out = out.subarray(0, out.length - out[out.length - 1]); // strip PKCS7 padding
  return JSON.parse(out.toString('utf8'));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  // If an Encrypt Key is configured, require + decrypt encrypted payloads
  // (rejecting plaintext closes a spoofing hole — only Lark has the key).
  const encKey = process.env.LARK_ENCRYPT_KEY;
  if (encKey) {
    if (!body || !body.encrypt) { res.status(200).json({}); return; }
    try { body = decrypt(body.encrypt, encKey); } catch { res.status(200).json({}); return; }
  }

  // Log what arrives (helps diagnose console/callback config).
  try { console.log('[lark-callback]', JSON.stringify({ type: body?.type, event_type: body?.header?.event_type || body?.event?.type, hasAction: !!(body?.action || body?.event?.action || body?.data?.action), keys: Object.keys(body || {}) })); } catch { /* noop */ }

  // URL verification handshake (when configuring the callback URL).
  if (body && body.type === 'url_verification') {
    res.status(200).json({ challenge: body.challenge });
    return;
  }

  // Optional token check.
  const vt = process.env.LARK_VERIFICATION_TOKEN;
  const token = body?.token || body?.header?.token || body?.event?.token;
  if (vt && token && token !== vt) { res.status(200).json({}); return; }

  // Card action (new card.action.trigger `event.action` / `data.action`, or legacy `action`).
  const action = body?.event?.action || body?.data?.action || body?.action;
  let value = action?.value || {};
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { /* leave as-is */ } }
  const op = body?.event?.operator || body?.data?.operator || {};
  const userId = op.user_id || body?.user_id || op.open_id || body?.open_id;

  const isNew = !!body?.event || !!body?.data || body?.schema === '2.0'; // card.action.trigger vs legacy card callback
  if (value.action === 'complete_task' && value.room && value.task_id) {
    const r = await completeTask(value.room, value.task_id);
    const name = larkMemberName(userId);
    if (r.ok) {
      const doneCard = buildDoneCard(value.title || r.task?.title || '任务', name, process.env.APP_URL || 'https://banjia-two.vercel.app/', value.room);
      // New callback model wants {toast, card:{type:"raw",data}}; legacy wants the raw card body.
      res.status(200).json(isNew ? { toast: { type: 'success', content: `✅ 已由 ${name} 完成` }, card: { type: 'raw', data: doneCard } } : doneCard);
      return;
    }
    res.status(200).json(isNew ? { toast: { type: 'error', content: '未能更新，请到网页操作' } } : { toast: { type: 'error', content: '未能更新' } });
    return;
  }
  res.status(200).json({});
}
