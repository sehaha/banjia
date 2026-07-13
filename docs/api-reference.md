# Move Guide — API 参考文档 / API Reference

> 项目：**banjia (Move Guide · 家庭搬家执行指南)**
> 线上地址 Base URL：`https://banjia-two.vercel.app`
> 版本 Version：v1 · 更新日期 2026-07-12

本项目是一个 **零传统后端** 的家庭搬家协作应用：前端为静态 SPA（localStorage + 多设备同步），后端仅由一组 **Vercel Serverless Functions**（`/api/*`）组成，负责 AI 助手、多设备同步、飞书（Lark）集成、以及「送朋友的搬家计划」分享链接。

> **导入飞书：** 本文件为标准 Markdown。在飞书云文档中「新建 → 导入 → 选择本 `.md` 文件」，标题、表格、代码块会自动转换；或直接复制全文粘贴进飞书文档。

---

## 目录 / Contents

1. [通用约定 General](#1-通用约定-general)
2. [Assistant · AI 助手](#2-assistant--ai-助手)
3. [Sync · 多设备同步](#3-sync--多设备同步)
4. [Plan · 送朋友的搬家计划（玩具版）](#4-plan--送朋友的搬家计划玩具版)
5. [Complete · 任务完成深链](#5-complete--任务完成深链)
6. [Lark Push · 主动推送](#6-lark-push--主动推送)
7. [Lark Webhooks · 事件与卡片回调](#7-lark-webhooks--事件与卡片回调)
8. [Scheduled / Admin · 定时与管理](#8-scheduled--admin--定时与管理)
9. [数据模型 Data Models](#9-数据模型-data-models)
10. [环境变量 Environment Variables](#10-环境变量-environment-variables)

---

## 1. 通用约定 General

| 项目 | 说明 |
|---|---|
| **Base URL** | `https://banjia-two.vercel.app` |
| **协议** | HTTPS |
| **数据格式** | 除特别说明外，请求与响应均为 `application/json`（UTF-8） |
| **鉴权** | 面向家庭内部使用，多数端点无鉴权。管理/定时类端点用 `CRON_SECRET`；飞书 Webhook 用加密 + Verification Token 校验（见 §7） |
| **错误约定** | 业务错误多以 `200 + { ok:false, error }` 返回（便于前端优雅降级）；`401` 表示鉴权失败；`405` 表示方法不允许 |
| **存储** | 共享数据存于 Upstash Redis（通过 `KV_REST_API_*` 环境变量）；未配置时相关端点返回 `{ configured:false }` |

**鉴权方式速查**

| 端点 | 鉴权 |
|---|---|
| `/api/assistant`, `/api/sync`, `/api/plan`, `/api/complete`, `/api/lark` | 无 |
| `/api/cron/remind`, `/api/lark-calendar`, `/api/lark-guide` | `CRON_SECRET` |
| `/api/lark-event`, `/api/lark-callback` | 飞书加密 + Verification Token |

---

## 2. Assistant · AI 助手

运行一轮 AI 搬家助手对话。此「大脑」被网页端和飞书群机器人共用（同一套 12 个工具 + 系统提示）。

### `POST /api/assistant`

**鉴权：** 无（服务端持有 `ANTHROPIC_API_KEY`）

**请求体 Request Body**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `messages` | `ChatMessage[]` | 是 | 对话历史，取最近 12 条 |
| `context` | `AssistantContext` | 是 | 当前看板上下文（见 [数据模型](#9-数据模型-data-models)）。`context.lang='en'` 时助手用英文回复 |

`ChatMessage`：`{ "role": "user" | "assistant", "content": string }`

**响应 Response `200`**

| 字段 | 类型 | 说明 |
|---|---|---|
| `reply` | `string` | 助手的自然语言回复 |
| `actions` | `AssistantAction[]` | 结构化操作（见 [AssistantAction](#assistantaction)），由调用方应用到看板 |

**示例 Example**

```bash
curl -X POST https://banjia-two.vercel.app/api/assistant \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{ "role": "user", "content": "帮爸爸加个任务：明天去新房量沙发尺寸" }],
    "context": { "lang": "zh", "today": "7/9 周四", "members": [{"id":"dad","name":"爸爸","role":""}], "tasks": [], "progress": {"total":0,"done":0} }
  }'
```

```json
{
  "reply": "好的，帮你处理了。",
  "actions": [
    { "type": "add_task", "title": "去新房量沙发尺寸", "owner": "爸爸", "date": "07-10", "priority": "P1" }
  ]
}
```

**错误 Errors**

| 状态码 | 说明 |
|---|---|
| `405` | 非 POST 方法 |
| `200` `{ reply: "…未配置…" }` | 服务端缺少 `ANTHROPIC_API_KEY` |

---

## 3. Sync · 多设备同步

家庭共享看板的读写。前端每 4 秒轮询 + 防抖推送，实现多设备实时同步。数据以「信封 Envelope」形式整体存储（last-write-wins）。

### `GET /api/sync`

读取某房间的看板信封。

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `room` | `string` | 是 | 房间码，如 `55VA8N` |

**响应 `200`**

```json
{ "configured": true, "envelope": { "data": { "...SharedBoard": "" }, "rev": 12, "updatedAt": 1783582404875, "origin": "lark" } }
```

- 房间为空时 `envelope: null`
- Redis 未配置时 `{ "configured": false }`

### `POST /api/sync`

写入（覆盖）某房间的看板信封。

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `room` | `string` | 是 | 房间码 |
| `envelope` | `Envelope` | 是 | 见 [Envelope](#envelope) |

**响应 `200`**：`{ "configured": true, "ok": true }`

**错误**：`400`（缺 `room` 或 `envelope`）；`405`（非 GET/POST）

---

## 4. Plan · 送朋友的搬家计划（玩具版）

零后端的「分享一份搬家计划」功能。为了让链接短且可信（微信里不像木马），把配置存进 Redis，只在 URL 里放一个 7 位短码：`https://banjia-two.vercel.app/?p=AB2CD3K`。

### `POST /api/plan`

保存一份计划配置，返回短码。

**请求体**：`{ "config": MoveConfig }`（见 [MoveConfig](#moveconfig)）

**响应 `200`**：`{ "configured": true, "code": "AB2CD3K" }`

分享链接 = `https://banjia-two.vercel.app/?p=<code>`

### `GET /api/plan`

按短码取回配置。

**Query**：`code`（必填）

**响应 `200`**：`{ "configured": true, "config": MoveConfig | null }`

**示例**

```bash
# 生成
curl -X POST https://banjia-two.vercel.app/api/plan -H "Content-Type: application/json" \
  -d '{"config":{"name":"Alex","from":"San Francisco, CA","to":"Seattle, WA","date":"2026-08-20","size":"1br","template":"long","by":"Sarah","lang":"en"}}'
# → {"configured":true,"code":"5DFD6VG"}

# 取回
curl "https://banjia-two.vercel.app/api/plan?code=5DFD6VG"
```

**错误**：`400`（POST 缺 `config` / GET 缺 `code`）；`200 {configured:false}`（Redis 未配置）

---

## 5. Complete · 任务完成深链

飞书简报卡上的「✅ 我来完成」按钮跳转到此端点。它把任务在共享看板中标记为完成（网页 ≤4 秒同步），并返回一个**样式化的 HTML 确认页**（非 JSON）。纯 URL 按钮无需任何飞书回调配置即可工作。

### `GET /api/complete`

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `room` | `string` | 是 | 房间码 |
| `task` | `string` | 是 | 任务 id |
| `t` | `string` | 否 | 任务标题（用于展示，URL 编码） |

**响应 `200`**：`Content-Type: text/html` — 完成/未完成的确认页面，页内含「打开搬家清单」按钮（带房间码 `#room=`，确保落到同步看板）。

---

## 6. Lark Push · 主动推送

面向客户端的飞书推送（Webhook/凭证留在服务端）。

### `GET /api/lark`

探测飞书是否已配置。

**响应 `200`**：`{ "configured": true }`

### `POST /api/lark`

向全部家庭成员推送一张卡片（今日简报或提醒）。

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `kind` | `"brief" \| "alert"` | 否 | 默认 `brief` |
| `board` | `SharedBoard` | `brief` 时用 | 用于计算今日简报 |
| `today` | `string` | 否 | `MM-DD`，默认当天 |
| `room` | `string` | 否 | 房间码（写入卡片「打开清单」链接 `#room=`） |
| `appUrl` | `string` | 否 | 应用地址 |
| `title` / `content` | `string` | `alert` 时用 | 提醒标题 / 正文（Markdown） |

**响应 `200`**：

```json
{ "configured": true, "ok": true, "sent": 5, "total": 5, "results": [{ "userId": "…", "ok": true, "code": 0 }] }
```

---

## 7. Lark Webhooks · 事件与卡片回调

供飞书开放平台回调，**不由前端调用**。两者都：处理 `url_verification` 握手；当设置了 `LARK_ENCRYPT_KEY` 时要求 AES-256-CBC 加密载荷（拒绝明文，防伪造）；可选校验 `LARK_VERIFICATION_TOKEN`。

### `POST /api/lark-event`

家庭群 **@机器人** 加/改/完成任务的入口。订阅事件 `im.message.receive_v1`。

**行为：** 解密 → `url_verification` 返回 `challenge` → token 校验 → 按 `event_id` 去重 → 群聊需被 @（私聊始终响应）→ 去掉 @ 提及 → 在房间看板上跑 AI 助手 → 应用操作 → 在群里回复。

**响应：** `200 {}`（或 `{ challenge }`）。同步处理（含 AI 调用 ~5–7s）；飞书重试由去重保证幂等。

**飞书后台配置：** 事件订阅请求网址填 `https://banjia-two.vercel.app/api/lark-event`。

### `POST /api/lark-callback`

飞书消息卡片回调（`card.action.trigger` / 旧版）。收到 `complete_task` 动作时把任务标记完成并返回「已完成」卡片。

> 备注：实际生产已改用 §5 的深链方案（`/api/complete`），此端点保留兼容。

---

## 8. Scheduled / Admin · 定时与管理

管理/定时类端点，用 `CRON_SECRET` 保护。

### `GET /api/cron/remind`

**定时：** Vercel Cron `0 15 * * *`（约美西 8:00 AM）。读取 `LARK_SYNC_ROOM` 房间看板，向全体家人推送今日简报。

**鉴权：** 若设置了 `CRON_SECRET`，需 `Authorization: Bearer <CRON_SECRET>`。

**响应 `200`**：`{ "ok": true, "configured": true, "sent": 5, "total": 5, "results": [...] }`，或 `{ ok:false, reason }`。

```bash
curl https://banjia-two.vercel.app/api/cron/remind -H "Authorization: Bearer <CRON_SECRET>"
```

### `POST /api/lark-calendar`

一次性、幂等地在飞书日历上创建搬家里程碑事件，并把全体家人设为参与者（已同步则跳过）。

**鉴权：** `Authorization: Bearer <CRON_SECRET>` 或 `?key=<CRON_SECRET>`。

**响应 `200`**：`syncMilestones()` 结果（含创建的日历 / 事件数）。

### `GET /api/lark-guide`

给某位家庭成员私信发送「使用说明」卡片。

**鉴权：** `?secret=<CRON_SECRET>` 或 `Authorization: Bearer <CRON_SECRET>`。

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `secret` | `string` | 是* | `CRON_SECRET`（或用 Bearer 头） |
| `user` | `string` | 否 | 飞书 `user_id`，默认爸爸 `783a2174` |
| `kind` | `"general" \| "assistant"` | 否 | `general`=完整说明；`assistant`=更啰嗦、只讲小助手的版本 |

**响应 `200`**：`{ "user": "…", "kind": "general", "configured": true, "ok": true, "code": 0, "msg": "success" }`

```bash
curl "https://banjia-two.vercel.app/api/lark-guide?secret=<CRON_SECRET>&user=38e38gcd&kind=assistant"
```

---

## 9. 数据模型 Data Models

### AssistantContext

```typescript
interface AssistantContext {
  lang?: 'zh' | 'en';          // 'en' 时助手用英文回复
  today: string;               // "7/9 周四"
  person?: string;             // 当前使用者名字
  schedule?: { date: string; weekday: string; stage: string; goal: string }[];
  members: { id: string; name: string; role: string }[];
  tasks: { title: string; owner: string; date: string; priority: string; status: string; blocking: boolean }[];
  utils?: { name: string; provider: string; type: string; status: string; note: string }[];
  docs?: { title: string; tag: string; body: string }[];
  memory?: string[];
  progress: { total: number; done: number; pct?: number; inProgress?: number; p0Remaining?: number };
}
```

### AssistantAction

助手可返回的 12 种结构化操作（`type` + 各自字段）：

| type | 关键字段 | 说明 |
|---|---|---|
| `add_task` | `title, owner?, date?, priority?, category?` | 新增任务 |
| `reassign` | `match, owner` | 改派负责人 |
| `set_status` | `match, status` | 改状态 `not_started\|in_progress\|done\|issue` |
| `set_priority` | `match, priority` | 改优先级 `P0\|P1\|P2` |
| `set_date` | `match, date` | 改日期 `MM-DD` |
| `set_blocking` | `match, blocking` | 标记是否阻塞搬家 |
| `delete_task` | `match` | 删除任务 |
| `add_member` | `name, role?` | 添加成员 |
| `rename_member` | `match, name` | 成员改名 |
| `set_utility` | `name, status` | 改服务开通状态 |
| `bulk_update` | `filter{}, set{}` | 批量修改 |
| `remember` | `note` | 记住长期偏好 |

> `match` = 任务标题关键词（模糊匹配，可能触发消歧）。

### Envelope

```typescript
interface Envelope {
  data: SharedBoard;
  rev: number;        // 单调递增版本
  updatedAt: number;  // 毫秒时间戳
  origin: string;     // 写入方标识（客户端 id 或 'lark'）
}
```

### SharedBoard

```typescript
interface SharedBoard {
  tasks: Task[];
  utils: Utility[];
  docs: DocTemplate[];
  members: Person[];
  memory: string[];
}
interface Task { id: string; title: string; owner: string; date: string; category: string;
  priority: 'P0'|'P1'|'P2'; blocking: boolean; status: 'not_started'|'in_progress'|'done'|'issue';
  description?: string; notes?: string; phone?: string; link?: string; }
interface Utility { id: string; type: 'new'|'old'; name: string; provider: string; address: string;
  start: string; status: 'not_started'|'in_progress'|'done'|'issue'; note: string; }
interface DocTemplate { id: string; title: string; tag: string; body: string; }
interface Person { id: string; name: string; role: string; hue: number; }
```

### MoveConfig

「送朋友的搬家计划」配置。

```typescript
interface MoveConfig {
  name: string;                        // 朋友的名字（首屏）
  from: string;                        // "上海 · 徐汇" / "San Francisco, CA"
  to: string;
  date: string;                        // 搬家日 ISO "YYYY-MM-DD"
  size: 'studio'|'1br'|'2br'|'3br';    // 只影响「约 N 个纸箱」文案
  template: 'local'|'long';            // 同城 / 跨城（跨城多 6 条任务）
  by?: string;                         // 落款（你的名字）
  wish?: string;                       // 全部完成时撒花送上的祝福语
  lang?: 'zh'|'en';                    // 计划渲染语言（朋友始终看到此语言）
}
```

---

## 10. 环境变量 Environment Variables

| 变量 | 用途 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API 密钥（AI 助手） |
| `ASSISTANT_MODEL` | 助手模型，默认 `claude-haiku-4-5` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash Redis REST（同步 + 计划存储）。亦支持 `UPSTASH_REDIS_REST_URL` / `_TOKEN` |
| `LARK_APP_ID` / `LARK_APP_SECRET` | 飞书自建应用凭证 |
| `LARK_DOMAIN` | 飞书网关，默认 `open.larksuite.com`（国际版） |
| `LARK_USER_IDS` | 家庭成员 `user_id` 列表（推送目标） |
| `LARK_MEMBERS` | `{user_id: 名字}` JSON（用于「已由 X 完成」） |
| `LARK_SYNC_ROOM` | 家庭房间码（定时简报读取此看板） |
| `LARK_ENCRYPT_KEY` | 飞书事件加密 Key（设置后 Webhook 要求加密载荷） |
| `LARK_VERIFICATION_TOKEN` | 飞书事件校验 Token |
| `CRON_SECRET` | 保护定时/管理端点 |
| `APP_URL` | 应用地址，默认 `https://banjia-two.vercel.app/` |

> ⚠️ **安全：** 所有密钥仅通过环境变量注入，切勿写入代码或提交到仓库。

---

*文档结束 · End of reference*
