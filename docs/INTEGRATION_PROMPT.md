# 集成提示词 / Integration Prompt

把下面整段复制发给另一个项目（或它的 AI 助手），即可让它复用本仓库集成飞书。
Copy one of the blocks below into another project (or its AI assistant) to reuse this repo.

## Webhook 地址 / Webhook URLs

本仓库用**飞书自建应用**（不是「群自定义机器人 webhook」）。「webhook」指飞书后台要填的回调请求网址，指向你**自己部署**的端点：

| 用途 | 后台位置 | URL |
|---|---|---|
| 接收消息事件（群 @机器人 / 私聊） | 事件订阅 → 请求网址 | `https://<你的域名>/api/lark-event` |
| 卡片按钮回调（可选，通常用深链替代） | 回调配置 → 请求网址 | `https://<你的域名>/api/lark-callback` |

> 发消息是主动调 IM API（用 App 凭证），不需要 incoming webhook。
> 复用现有搬家项目同一应用时，可直接用其部署地址 `https://banjia-two.vercel.app/api/lark-event`。

---

## 中文提示词

```text
请集成飞书（Lark）消息能力，复用现成的私有模块仓库：github.com/sehaha/lark-core

【步骤】
1. 从 sehaha/lark-core 拷入 lark-core.js、lark-core.d.ts、members.js、members.d.ts 到本项目 lib/。
2. 配置环境变量（真实值只放 .env，勿提交）：
   LARK_APP_ID=cli_xxx
   LARK_APP_SECRET=xxx
   LARK_DOMAIN=open.larksuite.com        # 飞书中国版用 open.feishu.cn
   LARK_ENCRYPT_KEY=xxx                   # 事件加密Key（后台设了就必填）
   LARK_VERIFICATION_TOKEN=xxx
   # 可选：KV_REST_API_URL / KV_REST_API_TOKEN（事件去重）
   # 可选：LARK_USER_IDS / LARK_MEMBERS（覆盖 members.js 名单）
3. 创建事件 webhook 端点（参考仓库 examples/vercel-api-lark-event.js 或 examples/server.express.js）：
   路径 /api/lark-event，逻辑=parseEvent 解密 → url_verification 回 challenge →
   verifyToken 校验 → seenEvent 去重 → 处理 im.message.receive_v1（群里需被@）。
4. 到飞书开发者后台：事件订阅请求网址填 https://<你的域名>/api/lark-event，
   订阅 im.message.receive_v1，授予读消息权限（im:message 或 im:message.group_at_msg:readonly），
   要发消息再加 im:message:send_as_bot，然后【发布新版本】（否则不生效），把机器人加进群。

【发消息调用】
import { card, md, openUrlButton } from './lib/lark-core.js';
import { sendCardToFamily, sendToMember } from './lib/members.js';
const c = card({ title:'📢 通知', elements:[ md('**内容**'), openUrlButton('打开','https://x') ] });
await sendCardToFamily(c);        // 群发全体成员
await sendToMember('爸爸', c);     // 单发某人（按名字）
// 也可 sendText(id,'文字','user_id') / sendCard(id, c, 'chat_id')（群用 chat_id）

【关键坑，务必注意】
- 改权限/事件后一定要“发布新版本”才生效。
- 能用 open_url 深链按钮就别用 callback 卡片回调（回调配置繁琐易失效）。
- webhook 要 3 秒内返回 200，慢任务用 seenEvent 去重保证飞书重试幂等。
- 所有真实密钥只放环境变量，切勿写进代码或提交仓库。
- 群发对象用 chat_id，个人用 open_id/user_id。
```

---

## English prompt

```text
Please add Lark (Feishu) messaging by reusing this private module repo: github.com/sehaha/lark-core

STEPS
1. Copy lark-core.js, lark-core.d.ts, members.js, members.d.ts from sehaha/lark-core into this project's lib/.
2. Set env vars (real values in .env only, never commit):
   LARK_APP_ID=cli_xxx
   LARK_APP_SECRET=xxx
   LARK_DOMAIN=open.larksuite.com        # open.feishu.cn for Feishu China
   LARK_ENCRYPT_KEY=xxx                   # required if set in the console
   LARK_VERIFICATION_TOKEN=xxx
   # optional: KV_REST_API_URL / KV_REST_API_TOKEN (event dedup)
   # optional: LARK_USER_IDS / LARK_MEMBERS (override members.js)
3. Create the event webhook (see examples/vercel-api-lark-event.js or examples/server.express.js):
   path /api/lark-event → parseEvent (decrypt) → answer url_verification with challenge →
   verifyToken → seenEvent dedup → handle im.message.receive_v1 (require @mention in groups).
4. In the Lark console: set the event request URL to https://<your-host>/api/lark-event,
   subscribe im.message.receive_v1, grant a message-read scope (im:message or
   im:message.group_at_msg:readonly), add im:message:send_as_bot to send, then PUBLISH a new
   version (nothing takes effect otherwise), and add the bot to the group.

SENDING
import { card, md, openUrlButton } from './lib/lark-core.js';
import { sendCardToFamily, sendToMember } from './lib/members.js';
const c = card({ title:'Notice', elements:[ md('**body**'), openUrlButton('Open','https://x') ] });
await sendCardToFamily(c);          // broadcast to all members
await sendToMember('Dad', c);       // one member by name
// also: sendText(id,'hi','user_id') / sendCard(id, c, 'chat_id')  (groups use chat_id)

GOTCHAS
- Re-publish the app version after changing scopes/events, or nothing applies.
- Prefer open_url deep-link buttons over callback cards (callback config is fiddly).
- Return 200 within ~3s; use seenEvent dedup so Lark retries stay idempotent.
- Secrets in env only, never in code or commits.
- Groups use chat_id; individuals use open_id/user_id.
```
