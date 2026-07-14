// lark-core.js — framework-agnostic Lark (Feishu) integration. Node 18+ (global fetch).
// Reusable across projects. Zero third-party deps (node:crypto only for event decryption).
// All secrets via env: LARK_APP_ID, LARK_APP_SECRET, LARK_DOMAIN, LARK_ENCRYPT_KEY,
// LARK_VERIFICATION_TOKEN, and (optional, for seenEvent) KV_REST_API_URL/TOKEN.
// See docs/lark-integration.md for setup + recipes.
import crypto from 'node:crypto';

const DOMAIN = () => process.env.LARK_DOMAIN || 'open.larksuite.com'; // or open.feishu.cn
const APP_ID = () => process.env.LARK_APP_ID || '';
const APP_SECRET = () => process.env.LARK_APP_SECRET || '';
const base = () => `https://${DOMAIN()}`;

export function larkConfigured() { return !!(APP_ID() && APP_SECRET()); }

// ---- tenant_access_token (in-memory cache; ~2h TTL, refreshed 120s early) ----
let _tok = { value: '', exp: 0 };
export async function getTenantToken() {
  if (_tok.value && Date.now() < _tok.exp) return _tok.value;
  const r = await fetch(`${base()}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID(), app_secret: APP_SECRET() }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`Lark token error ${j.code}: ${j.msg}`);
  _tok = { value: j.tenant_access_token, exp: Date.now() + ((j.expire || 7200) - 120) * 1000 };
  return _tok.value;
}

// ---- generic API caller ----
export async function larkApi(path, { method = 'GET', body, query } = {}) {
  const token = await getTenantToken();
  const qs = query ? '?' + new URLSearchParams(query).toString() : '';
  const r = await fetch(`${base()}${path}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

// ---- messages ----
// receiveIdType: 'open_id' | 'user_id' | 'union_id' | 'chat_id' | 'email'
export async function sendMessage(receiveId, { msgType, content, receiveIdType = 'open_id' }) {
  const j = await larkApi('/open-apis/im/v1/messages', {
    method: 'POST', query: { receive_id_type: receiveIdType },
    body: { receive_id: receiveId, msg_type: msgType, content: JSON.stringify(content) },
  });
  return { ok: j.code === 0, code: j.code, msg: j.msg, messageId: j.data?.message_id };
}
export const sendText = (id, text, receiveIdType = 'open_id') =>
  sendMessage(id, { msgType: 'text', content: { text }, receiveIdType });
export const sendCard = (id, cardBody, receiveIdType = 'open_id') =>
  sendMessage(id, { msgType: 'interactive', content: cardBody, receiveIdType });

// broadcast (sequential; add a concurrency pool for large lists)
export async function sendCardToMany(ids, cardBody, receiveIdType = 'user_id') {
  const results = [];
  for (const id of ids) results.push({ id, ...(await sendCard(id, cardBody, receiveIdType)) });
  return { ok: results.some((r) => r.ok), sent: results.filter((r) => r.ok).length, total: results.length, results };
}

// ---- interactive card 2.0 helpers ----
export const card = ({ title, template = 'blue', elements = [] }) => ({
  schema: '2.0', config: { wide_screen_mode: true },
  header: { title: { tag: 'plain_text', content: title }, template }, body: { elements },
});
export const md = (content) => ({ tag: 'markdown', content });
export const hr = () => ({ tag: 'hr' });
export const openUrlButton = (text, url, type = 'default') =>
  ({ tag: 'button', text: { tag: 'plain_text', content: text }, type, behaviors: [{ type: 'open_url', default_url: url }] });
export const callbackButton = (text, value, type = 'primary') =>
  ({ tag: 'button', text: { tag: 'plain_text', content: text }, type, behaviors: [{ type: 'callback', value }] });

// ---- event webhook helpers ----
export function decryptEvent(encrypt, key) {
  const aesKey = crypto.createHash('sha256').update(key).digest();
  const buf = Buffer.from(encrypt, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, buf.subarray(0, 16));
  decipher.setAutoPadding(false);
  let out = Buffer.concat([decipher.update(buf.subarray(16)), decipher.final()]);
  out = out.subarray(0, out.length - out[out.length - 1]); // strip PKCS7 padding
  return JSON.parse(out.toString('utf8'));
}
// Decrypt if an Encrypt Key is set (reject plaintext = anti-spoof); else pass through.
export function parseEvent(body, { encryptKey = process.env.LARK_ENCRYPT_KEY } = {}) {
  if (encryptKey) {
    if (!body?.encrypt) return null;
    try { return decryptEvent(body.encrypt, encryptKey); } catch { return null; }
  }
  return body;
}
export function verifyToken(evt, token = process.env.LARK_VERIFICATION_TOKEN) {
  if (!token) return true;
  const t = evt?.token || evt?.header?.token;
  return !t || t === token;
}

// ---- optional cross-instance event dedup (Upstash Redis REST; SET NX EX) ----
export async function seenEvent(id, ttlSec = 600) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token || !id) return false;
  const key = 'evt:' + String(id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  try {
    const r = await fetch(`${url}/set/${encodeURIComponent(key)}/1/NX/EX/${ttlSec}`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    return (await r.json()).result !== 'OK'; // null = already existed = duplicate
  } catch { return false; }
}
