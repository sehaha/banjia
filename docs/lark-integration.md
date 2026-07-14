# Lark（飞书）集成复用手册 · Reusable Lark Integration Guide

把本项目里「与 Lark 打通」的能力抽成一个**与业务解耦、可直接拷贝**的模块，方便在其他项目里无缝复用。全部基于 **自建应用（self-built app）+ `tenant_access_token` + IM/事件/日历 API**，零第三方依赖（仅事件解密用到 Node 内置 `crypto`），全部密钥走环境变量。

> 适用运行时：Node 18+（自带 `fetch`）、Vercel/Netlify/Cloudflare Serverless、任意支持 `fetch` 的环境。
> 网关域名：Lark 国际版 `open.larksuite.com`，飞书中国版 `open.feishu.cn` —— 用与你租户匹配的那个。

---

## 目录

1. [能做什么](#1-能做什么)
2. [飞书后台配置清单](#2-飞书后台配置清单)
3. [环境变量](#3-环境变量)
4. [核心模块 `lark-core.js`（可直接拷贝）](#4-核心模块-lark-corejs可直接拷贝)
5. [调用方法与实例](#5-调用方法与实例)
6. [与本仓库现有代码的对应关系](#6-与本仓库现有代码的对应关系)
7. [实质性建议与常见坑](#7-实质性建议与常见坑)
8. [复用与打包建议](#8-复用与打包建议)

---

## 1. 能做什么

| 能力 | Lark API | 本模块函数 |
|---|---|---|
| 换取应用凭证（带缓存） | `auth/v3/tenant_access_token/internal` | `getTenantToken()` |
| 调用任意 Lark 接口 | 全部 `/open-apis/*` | `larkApi(path, opts)` |
| 发消息（文本/卡片，给人/群/多人） | `im/v1/messages` | `sendText / sendCard / sendCardToMany` |
| 构建交互卡片（card 2.0） | — | `card / md / hr / openUrlButton / callbackButton` |
| 接收事件（@机器人、进群等） | 事件订阅 | `parseEvent / verifyToken` |
| 卡片按钮回调 | 卡片回调 | `parseEvent`（同上） |
| 事件去重（防重试重复处理） | 需 Redis | `seenEvent(id)` |
| 日历事件 + 邀请参与者 | `calendar/v4/*` | 用 `larkApi` 组合（见 §5.6） |

---

## 2. 飞书后台配置清单

在 **开发者后台**（Lark: `open.larksuite.com`；飞书: `open.feishu.cn`）→ 创建**自建应用**，然后：

1. **启用「机器人」能力**（应用功能 → 机器人）。
2. **权限（Scopes）** 按需勾选：
   - `im:message:send_as_bot` —— 以机器人身份发消息（必备）
   - `im:message` 或 `im:message.group_at_msg:readonly` —— 读消息 / 读群里被 @ 的消息（做群机器人时）
   - `calendar:calendar` —— 日历读写（做日历时）
3. **事件订阅**（如需接收消息）：
   - 模式选 **Webhook（长连接以外）**，填「请求网址」= `https://你的域名/api/lark-event`
   - 订阅事件 `接收消息 im.message.receive_v1`（群 @ 机器人 / 私聊）
4. **卡片回调**（仅当你用 `callback` 按钮）：在「回调配置」填请求网址，并开启「消息卡片」能力。
   > ⚠️ 经验：`callback` 按钮容易因后台配置/未发版而不触发。**能用 `open_url` 深链就用深链**（见 §7）。
5. **加密（强烈建议）**：设置 **Encrypt Key** 与 **Verification Token**，服务端据此解密并校验来源。
6. **发布版本** —— ⚠️ **权限和事件订阅只有在「创建并发布新版本」后才生效**（最大的坑，见 §7）。
7. 把机器人**加入目标群**（群设置 → 机器人 → 添加）。

---

## 3. 环境变量

```bash
LARK_APP_ID=cli_xxx                 # 应用 App ID
LARK_APP_SECRET=xxx                 # 应用 App Secret（务必只放环境变量）
LARK_DOMAIN=open.larksuite.com      # 或 open.feishu.cn
LARK_ENCRYPT_KEY=xxx                # 事件加密 Key（设置了就要求加密载荷）
LARK_VERIFICATION_TOKEN=xxx         # 事件校验 Token
# 可选：广播目标 / 名字映射
LARK_USER_IDS=uid1,uid2,uid3        # 逗号分隔的 user_id 列表
LARK_MEMBERS={"uid1":"张三"}         # user_id → 名字（JSON）
# 可选：事件去重用的 Upstash Redis REST
KV_REST_API_URL=https://xxx.upstash.io
KV_REST_API_TOKEN=xxx
```

---

## 4. 核心模块 `lark-core.js`（可直接拷贝）

> 这是从本项目 `lib/lark.js` 里**抽出的通用部分并去耦合**（去掉了搬家看板等业务逻辑），可原样放进任何项目。相比原实现，这里**新增了 token 缓存**、把 `receive_id_type` 参数化、并把卡片构建做成小工具函数。

```js
// lark-core.js — framework-agnostic Lark (Feishu) integration. Node 18+ (global fetch).
import crypto from 'node:crypto';

const DOMAIN = () => process.env.LARK_DOMAIN || 'open.larksuite.com';
const APP_ID = () => process.env.LARK_APP_ID || '';
const APP_SECRET = () => process.env.LARK_APP_SECRET || '';
const base = () => `https://${DOMAIN()}`;

export function larkConfigured() { return !!(APP_ID() && APP_SECRET()); }

// ---- tenant_access_token（内存缓存，约 2h 有效，提前 120s 过期）----
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

// ---- 通用 API 调用 ----
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

// ---- 发消息 ----
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

// 广播给多个 id（顺序发送；量大时请自行加并发限制，见 §7）
export async function sendCardToMany(ids, cardBody, receiveIdType = 'user_id') {
  const results = [];
  for (const id of ids) results.push({ id, ...(await sendCard(id, cardBody, receiveIdType)) });
  return { ok: results.some((r) => r.ok), sent: results.filter((r) => r.ok).length, total: results.length, results };
}

// ---- 交互卡片 2.0 小工具 ----
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

// ---- 事件 Webhook ----
// AES-256-CBC 解密（设置了 Encrypt Key 时）
export function decryptEvent(encrypt, key) {
  const aesKey = crypto.createHash('sha256').update(key).digest();
  const buf = Buffer.from(encrypt, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, buf.subarray(0, 16));
  decipher.setAutoPadding(false);
  let out = Buffer.concat([decipher.update(buf.subarray(16)), decipher.final()]);
  out = out.subarray(0, out.length - out[out.length - 1]); // 去 PKCS7 padding
  return JSON.parse(out.toString('utf8'));
}
// 解析事件体：设了 Encrypt Key 就要求加密（拒绝明文=防伪造）；否则原样返回
export function parseEvent(body, { encryptKey = process.env.LARK_ENCRYPT_KEY } = {}) {
  if (encryptKey) {
    if (!body?.encrypt) return null;
    try { return decryptEvent(body.encrypt, encryptKey); } catch { return null; }
  }
  return body;
}
// 校验 Verification Token（可选）
export function verifyToken(evt, token = process.env.LARK_VERIFICATION_TOKEN) {
  if (!token) return true;
  const t = evt?.token || evt?.header?.token;
  return !t || t === token;
}

// ---- 事件去重（可选，需 Upstash Redis REST；SET NX EX）----
export async function seenEvent(id, ttlSec = 600) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token || !id) return false;
  const key = 'evt:' + String(id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  try {
    const r = await fetch(`${url}/set/${encodeURIComponent(key)}/1/NX/EX/${ttlSec}`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    return (await r.json()).result !== 'OK'; // null = 已存在 = 重复
  } catch { return false; }
}
```

---

## 5. 调用方法与实例

### 5.1 发文本 / 卡片

```js
import { sendText, sendCard, sendCardToMany, card, md, hr, openUrlButton } from './lark-core.js';

// 给某人发文本（默认 open_id；也可传 'user_id' / 'email'）
await sendText('ou_xxx', '你好 👋');
await sendText('zhangsan@company.com', 'Hi', 'email');

// 给「群」发文本 / 卡片（chat_id）
await sendText('oc_xxx', '群里的通知', 'chat_id');

// 构建并发送一张卡片
const c = card({
  title: '📢 今日提醒',
  template: 'blue', // blue/green/orange/red/wathet/turquoise/…
  elements: [
    md('**3 项**待办 · ⏰ 2 项逾期'),
    hr(),
    openUrlButton('🔗 打开系统', 'https://your.app/'),
  ],
});
await sendCard('oc_xxx', c, 'chat_id');

// 广播给多人（user_id 列表）
const ids = (process.env.LARK_USER_IDS || '').split(',').filter(Boolean);
const r = await sendCardToMany(ids, c, 'user_id');
// → { ok:true, sent:3, total:3, results:[{id,ok,code,msg,messageId}] }
```

### 5.2 调用任意 Lark API

```js
import { larkApi } from './lark-core.js';

// GET
const me = await larkApi('/open-apis/bot/v3/info');

// POST + query
const j = await larkApi('/open-apis/im/v1/messages', {
  method: 'POST',
  query: { receive_id_type: 'chat_id' },
  body: { receive_id: 'oc_xxx', msg_type: 'text', content: JSON.stringify({ text: 'hi' }) },
});
```

### 5.3 交互卡片按钮：深链 vs 回调

```js
// ✅ 推荐：open_url 深链按钮 —— 点击直接打开一个 URL（无需任何卡片回调配置，最稳）
openUrlButton('✅ 我来处理', 'https://your.app/api/done?id=123');

// callback 按钮 —— 点击回调你的服务器（需在后台配「卡片回调」+ 开启卡片能力 + 发版）
import { callbackButton } from './lark-core.js';
callbackButton('标记完成', { action: 'complete', id: '123' });
```

### 5.4 接收事件（群 @ 机器人 / 私聊）

`POST /api/lark-event`（Vercel/Express 形式类似）：

```js
import { parseEvent, verifyToken, seenEvent, sendText } from './lark-core.js';

export default async function handler(req, res) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const evt = parseEvent(body);                 // 解密（设了 key 时）
  if (!evt) return res.status(200).json({});    // 拒绝明文/解密失败

  // 1) URL 验证握手（配置回调地址时飞书会发一次）
  if (evt.type === 'url_verification') return res.status(200).json({ challenge: evt.challenge });

  // 2) 来源校验
  if (!verifyToken(evt)) return res.status(200).json({});

  // 3) 只处理「收到消息」，并按 event_id 去重（防飞书重试重复处理）
  if (evt.header?.event_type === 'im.message.receive_v1') {
    if (await seenEvent(evt.header.event_id)) return res.status(200).json({});
    const msg = evt.event.message;
    const chatId = msg.chat_id;
    const isGroup = msg.chat_type === 'group';
    const mentioned = Array.isArray(msg.mentions) && msg.mentions.length > 0;
    if (isGroup && !mentioned) return res.status(200).json({}); // 群里没 @ 机器人就忽略

    // 取出纯文本（去掉 @ 占位符）
    let text = '';
    try { text = JSON.parse(msg.content || '{}').text || ''; } catch { /* */ }
    text = text.replace(/@_user_\d+/g, '').replace(/@_all/g, '').trim();

    await sendText(chatId, `收到：${text}`, 'chat_id'); // 在群/会话里回复
  }
  res.status(200).json({});
}
```

> ⏱ 飞书要求 **~3 秒内** 返回 200，否则会重试。若处理很慢（如调 AI），要么**先 200 再异步处理**（用队列 / `waitUntil`），要么像上面一样**用 `seenEvent` 去重**保证重试幂等（本项目用的后者）。

### 5.5 卡片按钮回调

`POST /api/lark-callback`（用了 `callback` 按钮时）：

```js
import { parseEvent } from './lark-core.js';

export default async function handler(req, res) {
  let body = req.body; if (typeof body === 'string') body = JSON.parse(body || '{}');
  const evt = parseEvent(body);
  if (!evt) return res.status(200).json({});
  if (evt.type === 'url_verification') return res.status(200).json({ challenge: evt.challenge });

  const action = evt.event?.action || evt.action;       // 新版在 event.action
  const value = action?.value || {};                     // = callbackButton 里传的对象
  const userId = evt.event?.operator?.user_id;
  if (value.action === 'complete') {
    // …执行业务…；可返回 toast + 新卡片
    return res.status(200).json({ toast: { type: 'success', content: '已完成' } });
  }
  res.status(200).json({});
}
```

### 5.6 日历事件 + 邀请参与者

```js
import { larkApi } from './lark-core.js';

// 1) 创建应用日历
const cal = await larkApi('/open-apis/calendar/v4/calendars', {
  method: 'POST', body: { summary: '项目关键节点', permissions: 'public' },
});
const calId = cal.data.calendar.calendar_id;

// 2) 建事件（时间用秒级时间戳字符串）
const ev = await larkApi(`/open-apis/calendar/v4/calendars/${calId}/events`, {
  method: 'POST',
  body: {
    summary: '🚀 上线', description: '正式发布',
    start_time: { timestamp: String(Math.floor(Date.parse('2026-08-20T09:00:00-07:00') / 1000)) },
    end_time:   { timestamp: String(Math.floor(Date.parse('2026-08-20T10:00:00-07:00') / 1000)) },
    reminders: [{ minutes: 1440 }, { minutes: 60 }],
  },
});
const eventId = ev.data.event.event_id;

// 3) 邀请参与者（user_id）
await larkApi(`/open-apis/calendar/v4/calendars/${calId}/events/${eventId}/attendees`, {
  method: 'POST', query: { user_id_type: 'user_id' },
  body: { attendees: ['uid1', 'uid2'].map((id) => ({ type: 'user', user_id: id })), need_notification: true },
});
```

---

## 6. 与本仓库现有代码的对应关系

| 本项目 `lib/lark.js` 导出 | 复用模块对应 | 说明 |
|---|---|---|
| `tenantToken()`（私有） | `getTenantToken()` | 复用版**加了缓存** |
| `larkApi(path, method, token, body)` | `larkApi(path, {method, body, query})` | 复用版签名更顺手、自动取 token |
| `sendInteractiveToUser` / `sendCardToUser` | `sendCard(id, card, 'user_id')` | — |
| `sendCardToAll` | `sendCardToMany(ids, card, 'user_id')` | — |
| `sendTextToChat` / `sendCardToChat` | `sendText/sendCard(id, …, 'chat_id')` | — |
| `buildAlertCard` / `buildDoneCard` | `card()` + `md()`/`openUrlButton()` | 原版是搬家专用，复用版是通用积木 |
| `seenEvent(id)` | `seenEvent(id, ttl)` | 一致（去掉了 `mg:` 前缀耦合） |
| `roomAppLink` / `buildBriefCard` / `summarize` / `boardContext` / `applyActions*` / `completeTask` / `syncMilestones` / `MILESTONES` | —（**业务专用，不建议直接复用**） | 属于搬家看板逻辑，换项目请重写 |

事件/回调处理器可参考 `api/lark-event.js`、`api/lark-callback.js`；解密与 `url_verification` 逻辑已收进复用模块的 `parseEvent`。

---

## 7. 实质性建议与常见坑

**这几条是我们这次真踩过的，直接决定成败：**

1. **改权限/事件后一定要「发布新版本」** —— 否则怎么配都不生效。这是最容易卡住的一步。
2. **能用 `open_url` 深链就别用 `callback` 卡片回调。** 回调需要「回调配置 + 开启卡片能力 + 发版」多项齐全，且旧版 `value` 按钮在新卡片模型下不触发；深链按钮零配置、永远可用。本项目最终就是把「完成任务」从回调改成了深链页面。
3. **缓存 `tenant_access_token`。** 它约 2 小时有效。原项目每次发送都重新换 token，量大时会撞**频率限制**。复用模块已内置内存缓存（Serverless 冷启动后失效属正常，仍能显著减少调用）。
4. **Webhook 3 秒超时 + 幂等。** 飞书要求快速返回 200，否则重试。慢任务（AI、外部调用）要么「先 200 再异步」，要么用 `seenEvent` 去重让重试无害。**同步跑 AI ~5–7s 会触发重试，务必去重。**
5. **加密要「拒绝明文」。** 设了 Encrypt Key 后，只接受 `{encrypt}` 载荷、明文一律丢弃，能挡住伪造请求。`parseEvent` 已这么做。
6. **`receive_id_type` 别搞混。** 群用 `chat_id`，个人推荐 `open_id`（跨应用稳定），`user_id` 需要对应权限，邮件用 `email`。发群消息要用 `chat_id` 而不是 `user_id`。
7. **域名要匹配租户。** 国际版 `open.larksuite.com`、中国飞书 `open.feishu.cn`。二者后端常互通（我们建日历时返回过 feishu.cn 的 id），但**显式配置**避免歧义。
8. **广播加并发限制。** `sendCardToMany` 是顺序发送，几十人内没问题；上百人请用小并发池（如一次 5 个）或官方批量接口，避免限流。
9. **密钥只放环境变量，泄露即轮换。** App Secret / Encrypt Key / Token 一旦进过聊天或日志就当作已泄露，去后台重置。
10. **卡片文案国际化。** 卡片 `template` 颜色枚举有限（blue/green/orange/red/wathet/turquoise/carmine/violet/purple/indigo/grey 等）；正文用 `markdown` 元素即可中英混排。

---

## 8. 复用与打包建议

- **短期**：把上面的 `lark-core.js` 拷进新项目的 `lib/`，配好环境变量即可用。它无第三方依赖、纯 `fetch`。
- **中期**：抽成一个内部小包（如 `@you/lark-core`），`getTenantToken/larkApi/sendCard/parseEvent` 作为稳定 API，业务卡片各项目自建。
- **可选增强**：
  - token 缓存升级为 **跨实例缓存**（Redis），减少并发冷启动各自换 token。
  - 事件处理接 **消息队列**（如 Upstash QStash / SQS），Webhook 只负责入队 + 快速 200，真正处理异步做，彻底规避 3s 超时。
  - 增加 `getMessage / replyMessage / updateCard`（`im/v1/messages/:id` 系列）以支持「原地更新卡片」。
  - 用 TypeScript 声明类型（`ReceiveIdType`、事件 payload），减少调用出错。

> 一句话：**`getTenantToken` + `larkApi` 两个函数是地基**，其余（发消息、卡片、事件、日历）都是在这两者之上的薄封装 —— 复用时抓住这两个即可。

---

*手册结束 · 有问题可对照本仓库 `lib/lark.js` 与 `api/lark-*.js` 的真实实现。*
