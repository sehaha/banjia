// Vercel serverless version of the Lark event webhook.
// Drop this at  api/lark-event.js  in a Vercel project (with lark-core.js in lib/),
// set the env vars, and point the Lark app's event request URL to
//   https://<your-vercel-app>/api/lark-event
// Subscribe im.message.receive_v1, grant a message-read scope, and PUBLISH a version.
import { parseEvent, verifyToken, seenEvent, sendText } from '../lib/lark-core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const evt = parseEvent(body);
  if (!evt) { res.status(200).json({}); return; }
  if (evt.type === 'url_verification') { res.status(200).json({ challenge: evt.challenge }); return; }
  if (!verifyToken(evt)) { res.status(200).json({}); return; }

  if (evt.header?.event_type === 'im.message.receive_v1') {
    if (await seenEvent(evt.header.event_id)) { res.status(200).json({}); return; }
    const msg = evt.event.message;
    const isGroup = msg.chat_type === 'group';
    const mentioned = Array.isArray(msg.mentions) && msg.mentions.length > 0;
    if (!isGroup || mentioned) {
      let text = '';
      try { text = JSON.parse(msg.content || '{}').text || ''; } catch { /* */ }
      text = text.replace(/@_user_\d+/g, '').replace(/@_all/g, '').trim();
      await sendText(msg.chat_id, `👋 收到 / got it: ${text}`, 'chat_id');
    }
  }
  res.status(200).json({});
}
