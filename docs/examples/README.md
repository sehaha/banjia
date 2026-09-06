# lark-core · 示例与用法 / Examples

可直接复用的 Lark（飞书）集成模块与最小可跑示例。配套说明见 [../lark-integration.md](../lark-integration.md)。

> 📦 **已抽成独立私有仓库：[github.com/sehaha/lark-core](https://github.com/sehaha/lark-core)**（含家庭成员名单 `members.js` 等）。新项目直接用那个仓库；此处为随搬家项目一起维护的同源副本。

## 文件

| 文件 | 说明 |
|---|---|
| [lark-core.js](./lark-core.js) | 核心模块（零第三方依赖，仅用 `node:crypto`）。拷进你项目的 `lib/` 即可。 |
| [lark-core.d.ts](./lark-core.d.ts) | TypeScript 类型声明。与 `.js` 放一起即被自动识别。 |
| [server.express.js](./server.express.js) | 最小可跑的 Express 机器人（事件 webhook + 测试发送）。 |
| [vercel-api-lark-event.js](./vercel-api-lark-event.js) | Vercel Serverless 版事件 webhook（放到 `api/lark-event.js`）。 |

## 环境变量

```bash
export LARK_APP_ID=cli_xxx
export LARK_APP_SECRET=xxx
export LARK_DOMAIN=open.larksuite.com        # 飞书中国版用 open.feishu.cn
export LARK_ENCRYPT_KEY=xxx                   # 事件加密 Key（后台设置了就必填）
export LARK_VERIFICATION_TOKEN=xxx            # 事件校验 Token
# 可选（事件去重，避免飞书重试重复处理）：
export KV_REST_API_URL=https://xxx.upstash.io
export KV_REST_API_TOKEN=xxx
```

## 跑 Express 示例

```bash
npm init -y && npm pkg set type=module && npm i express
node server.express.js         # 监听 :3000
```

本地联调需要一个公网地址（飞书要能回调到你）：

```bash
npx cloudflared tunnel --url http://localhost:3000
# 或： ngrok http 3000
```

然后到飞书开发者后台：
1. 事件订阅请求网址填 `https://<公网地址>/lark/event`
2. 订阅 `im.message.receive_v1`，授予读消息权限
3. **发布新版本**（否则不生效），把机器人加进群

**自测发送**（把 `oc_xxx` 换成真实 chat_id）：

```bash
curl -X POST http://localhost:3000/send -H "Content-Type: application/json" \
  -d '{"id":"oc_xxx","idType":"chat_id"}'
```

在群里 **@机器人** 说句话，它会回你 `👋 收到 / got it: …`。

## 用在 Vercel

1. 把 `lark-core.js` 放到项目 `lib/`，把 `vercel-api-lark-event.js` 放到 `api/lark-event.js`。
2. 在 Vercel 项目设置里配好上面的环境变量。
3. 部署后，事件请求网址填 `https://<你的域名>/api/lark-event`。

## TypeScript

`.d.ts` 与 `.js` 同名同目录即可被自动识别；如需显式引用：

```ts
import { sendCard, card, md, openUrlButton, type CardBody } from './lark-core.js';
const c: CardBody = card({ title: 'Hi', elements: [md('**hello**'), openUrlButton('Go', 'https://x')] });
await sendCard('oc_xxx', c, 'chat_id');
```
