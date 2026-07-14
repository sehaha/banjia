// Minimal runnable Lark bot server (Express). Demonstrates the whole loop:
//   • event webhook  (url_verification → decrypt → dedup → @mention echo)
//   • a test endpoint to push a card
//
// Run:
//   npm i express
//   LARK_APP_ID=cli_xxx LARK_APP_SECRET=xxx LARK_ENCRYPT_KEY=xxx \
//   LARK_VERIFICATION_TOKEN=xxx node server.express.js
//
// Then set your Lark app's event request URL to  https://<public-host>/lark/event
// (use a tunnel like ngrok/cloudflared for local dev), subscribe im.message.receive_v1,
// grant a message-read scope, and PUBLISH a new app version.
import express from 'express';
import { parseEvent, verifyToken, seenEvent, sendText, sendCard, card, md, openUrlButton, larkConfigured } from './lark-core.js';

const app = express();
app.use(express.json());

app.get('/', (_req, res) => res.json({ ok: true, configured: larkConfigured() }));

// ---- Event webhook ----
app.post('/lark/event', async (req, res) => {
  const evt = parseEvent(req.body);
  if (!evt) return res.json({});                                   // reject plaintext / bad decrypt
  if (evt.type === 'url_verification') return res.json({ challenge: evt.challenge }); // handshake
  if (!verifyToken(evt)) return res.json({});

  if (evt.header?.event_type === 'im.message.receive_v1') {
    // Ack fast; Lark retries on slow/failed replies, so dedup keeps it idempotent.
    if (await seenEvent(evt.header.event_id)) return res.json({});
    res.json({}); // 200 immediately (<3s), then keep working

    const msg = evt.event.message;
    const isGroup = msg.chat_type === 'group';
    const mentioned = Array.isArray(msg.mentions) && msg.mentions.length > 0;
    if (isGroup && !mentioned) return; // in groups, only respond when @mentioned

    let text = '';
    try { text = JSON.parse(msg.content || '{}').text || ''; } catch { /* */ }
    text = text.replace(/@_user_\d+/g, '').replace(/@_all/g, '').trim();
    await sendText(msg.chat_id, `👋 收到 / got it: ${text}`, 'chat_id');
    return;
  }
  res.json({});
});

// ---- Test: push a card to a chat/user ----  POST /send { "id": "oc_xxx", "idType": "chat_id" }
app.post('/send', async (req, res) => {
  const { id, idType = 'chat_id' } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });
  const c = card({
    title: '📢 测试卡片 / Test card', template: 'blue',
    elements: [md('**Hello from lark-core** 👋'), openUrlButton('Open', 'https://example.com')],
  });
  res.json(await sendCard(id, c, idType));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`lark example server on :${port}  (configured=${larkConfigured()})`));
