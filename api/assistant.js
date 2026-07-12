// Web assistant endpoint — thin wrapper over the shared assistant core.
import { runAssistant } from '../lib/assistant-core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const context = body?.context || {};
  const { reply, actions } = await runAssistant(messages, context);
  res.status(200).json({ reply, actions });
}
