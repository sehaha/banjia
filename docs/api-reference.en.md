# Move Guide — API Reference

> Project: **banjia (Move Guide)**
> Base URL: `https://banjia-two.vercel.app`
> Version: v1 · Updated 2026-07-12

Move Guide is a **backend-light** family moving-coordination app. The frontend is a static SPA (localStorage + multi-device sync); the backend is a small set of **Vercel Serverless Functions** (`/api/*`) covering the AI assistant, multi-device sync, Lark (Feishu) integration, and a share-by-link "moving plan for a friend" feature.

> **Import into Lark:** this file is standard Markdown. In Lark Docs choose **New → Import → select this `.md`** (titles, tables and code blocks convert automatically), or just copy the whole file and paste it into a Lark doc.

---

## Contents

1. [General](#1-general)
2. [Assistant](#2-assistant)
3. [Sync](#3-sync)
4. [Plan (share-by-link)](#4-plan-share-by-link)
5. [Complete (deep link)](#5-complete-deep-link)
6. [Lark Push](#6-lark-push)
7. [Lark Webhooks](#7-lark-webhooks)
8. [Scheduled / Admin](#8-scheduled--admin)
9. [Data Models](#9-data-models)
10. [Environment Variables](#10-environment-variables)

---

## 1. General

| Item | Detail |
|---|---|
| **Base URL** | `https://banjia-two.vercel.app` |
| **Protocol** | HTTPS |
| **Format** | `application/json` (UTF-8) unless noted otherwise |
| **Auth** | Built for one family, so most endpoints are unauthenticated. Admin/scheduled endpoints use `CRON_SECRET`; Lark webhooks are verified with encryption + a verification token (see §7) |
| **Errors** | Business errors usually return `200 + { ok:false, error }` (so the client can degrade gracefully); `401` = auth failure; `405` = method not allowed |
| **Storage** | Shared data lives in Upstash Redis (via `KV_REST_API_*` env vars); when unconfigured, related endpoints return `{ configured:false }` |

**Auth at a glance**

| Endpoint | Auth |
|---|---|
| `/api/assistant`, `/api/sync`, `/api/plan`, `/api/complete`, `/api/lark` | None |
| `/api/cron/remind`, `/api/lark-calendar`, `/api/lark-guide` | `CRON_SECRET` |
| `/api/lark-event`, `/api/lark-callback` | Lark encryption + verification token |

---

## 2. Assistant

Runs one turn of the AI moving assistant. This shared "brain" is used by both the web app and the Lark group bot (same 12 tools + system prompt).

### `POST /api/assistant`

**Auth:** none (the server holds `ANTHROPIC_API_KEY`)

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `messages` | `ChatMessage[]` | Yes | Conversation history (last 12 kept) |
| `context` | `AssistantContext` | Yes | Current board context (see [Data Models](#9-data-models)). When `context.lang='en'` the assistant replies in English |

`ChatMessage`: `{ "role": "user" | "assistant", "content": string }`

**Response `200`**

| Field | Type | Description |
|---|---|---|
| `reply` | `string` | The assistant's natural-language reply |
| `actions` | `AssistantAction[]` | Structured operations (see [AssistantAction](#assistantaction)) for the caller to apply to the board |

**Example**

```bash
curl -X POST https://banjia-two.vercel.app/api/assistant \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{ "role": "user", "content": "Add a task for Dad: measure the sofa at the new place tomorrow" }],
    "context": { "lang": "en", "today": "7/9 Thu", "members": [{"id":"dad","name":"Dad","role":""}], "tasks": [], "progress": {"total":0,"done":0} }
  }'
```

```json
{
  "reply": "Done — added it.",
  "actions": [
    { "type": "add_task", "title": "Measure the sofa at the new place", "owner": "Dad", "date": "07-10", "priority": "P1" }
  ]
}
```

**Errors**

| Status | Description |
|---|---|
| `405` | Non-POST method |
| `200` `{ reply: "…not configured…" }` | Server is missing `ANTHROPIC_API_KEY` |

---

## 3. Sync

Read/write the shared family board. The frontend polls every 4s and pushes (debounced) for real-time multi-device sync. Data is stored whole as an "Envelope" (last-write-wins).

### `GET /api/sync`

Read a room's board envelope.

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `room` | `string` | Yes | Room code, e.g. `55VA8N` |

**Response `200`**

```json
{ "configured": true, "envelope": { "data": { "...SharedBoard": "" }, "rev": 12, "updatedAt": 1783582404875, "origin": "lark" } }
```

- `envelope: null` when the room is empty
- `{ "configured": false }` when Redis is not configured

### `POST /api/sync`

Write (overwrite) a room's board envelope.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `room` | `string` | Yes | Room code |
| `envelope` | `Envelope` | Yes | See [Envelope](#envelope) |

**Response `200`**: `{ "configured": true, "ok": true }`

**Errors**: `400` (missing `room` or `envelope`); `405` (non GET/POST)

---

## 4. Plan (share-by-link)

A zero-backend "share a moving plan" feature. To keep links short and trustworthy (so they don't look like spam in a messenger), the config is stored in Redis and the URL only carries a 7-char code: `https://banjia-two.vercel.app/?p=AB2CD3K`.

### `POST /api/plan`

Store a plan config, return a short code.

**Request Body**: `{ "config": MoveConfig }` (see [MoveConfig](#moveconfig))

**Response `200`**: `{ "configured": true, "code": "AB2CD3K" }`

Share link = `https://banjia-two.vercel.app/?p=<code>`

### `GET /api/plan`

Fetch a config by code.

**Query**: `code` (required)

**Response `200`**: `{ "configured": true, "config": MoveConfig | null }`

**Example**

```bash
# create
curl -X POST https://banjia-two.vercel.app/api/plan -H "Content-Type: application/json" \
  -d '{"config":{"name":"Alex","from":"San Francisco, CA","to":"Seattle, WA","date":"2026-08-20","size":"1br","template":"long","by":"Sarah","lang":"en"}}'
# → {"configured":true,"code":"5DFD6VG"}

# fetch
curl "https://banjia-two.vercel.app/api/plan?code=5DFD6VG"
```

**Errors**: `400` (POST missing `config` / GET missing `code`); `200 {configured:false}` (Redis not configured)

---

## 5. Complete (deep link)

The "✅ I'll do it" button on a Lark brief card links here. It marks the task done in the shared board (web reflects in ≤4s) and returns a **styled HTML confirmation page** (not JSON). Plain URL buttons work with zero Lark callback configuration.

### `GET /api/complete`

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `room` | `string` | Yes | Room code |
| `task` | `string` | Yes | Task id |
| `t` | `string` | No | Task title for display (URL-encoded) |

**Response `200`**: `Content-Type: text/html` — a done/not-done confirmation page with an "Open the list" button (carries the room code `#room=` so it lands on the synced board).

---

## 6. Lark Push

Client-facing Lark push (credentials stay server-side).

### `GET /api/lark`

Check whether Lark is configured.

**Response `200`**: `{ "configured": true }`

### `POST /api/lark`

Push a card (daily brief or alert) to all family members.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `kind` | `"brief" \| "alert"` | No | Defaults to `brief` |
| `board` | `SharedBoard` | for `brief` | Used to compute today's brief |
| `today` | `string` | No | `MM-DD`, defaults to today |
| `room` | `string` | No | Room code (written into the card's "open list" link `#room=`) |
| `appUrl` | `string` | No | App URL |
| `title` / `content` | `string` | for `alert` | Alert title / body (Markdown) |

**Response `200`**:

```json
{ "configured": true, "ok": true, "sent": 5, "total": 5, "results": [{ "userId": "…", "ok": true, "code": 0 }] }
```

---

## 7. Lark Webhooks

For the Lark Open Platform to call back — **not called by the frontend**. Both endpoints: handle the `url_verification` handshake; require AES-256-CBC-encrypted payloads when `LARK_ENCRYPT_KEY` is set (plaintext rejected, anti-spoof); optionally verify `LARK_VERIFICATION_TOKEN`.

### `POST /api/lark-event`

Entry point for **@mentioning the bot** in the family group to add/edit/complete tasks. Subscribe to the `im.message.receive_v1` event.

**Behavior:** decrypt → answer `url_verification` with `challenge` → token check → dedupe by `event_id` → require an @mention in groups (always respond in DMs) → strip the mention → run the AI assistant on the room board → apply the actions → reply in the chat.

**Response:** `200 {}` (or `{ challenge }`). Processing is synchronous (includes an AI call, ~5–7s); Lark retries are made idempotent by the dedupe.

**Lark console:** set the event-subscription request URL to `https://banjia-two.vercel.app/api/lark-event`.

### `POST /api/lark-callback`

Lark message-card callback (`card.action.trigger` / legacy). On a `complete_task` action it marks the task done and returns a "done" card.

> Note: production switched to the deep-link approach in §5 (`/api/complete`); this endpoint is kept for compatibility.

---

## 8. Scheduled / Admin

Admin/scheduled endpoints, protected by `CRON_SECRET`.

### `GET /api/cron/remind`

**Schedule:** Vercel Cron `0 15 * * *` (~8:00 AM US-Pacific). Reads the `LARK_SYNC_ROOM` board and pushes today's brief to all family members.

**Auth:** if `CRON_SECRET` is set, requires `Authorization: Bearer <CRON_SECRET>`.

**Response `200`**: `{ "ok": true, "configured": true, "sent": 5, "total": 5, "results": [...] }`, or `{ ok:false, reason }`.

```bash
curl https://banjia-two.vercel.app/api/cron/remind -H "Authorization: Bearer <CRON_SECRET>"
```

### `POST /api/lark-calendar`

One-shot, idempotent creation of the major move milestones on a Lark calendar, with all family members as attendees (skips if already synced).

**Auth:** `Authorization: Bearer <CRON_SECRET>` or `?key=<CRON_SECRET>`.

**Response `200`**: the `syncMilestones()` result (calendar / event counts).

### `GET /api/lark-guide`

DM a "how to use" guide card to a family member.

**Auth:** `?secret=<CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `secret` | `string` | Yes* | `CRON_SECRET` (or use the Bearer header) |
| `user` | `string` | No | Lark `user_id`, defaults to `783a2174` |
| `kind` | `"general" \| "assistant"` | No | `general` = full guide; `assistant` = gentler, assistant-only walkthrough |

**Response `200`**: `{ "user": "…", "kind": "general", "configured": true, "ok": true, "code": 0, "msg": "success" }`

```bash
curl "https://banjia-two.vercel.app/api/lark-guide?secret=<CRON_SECRET>&user=38e38gcd&kind=assistant"
```

---

## 9. Data Models

### AssistantContext

```typescript
interface AssistantContext {
  lang?: 'zh' | 'en';          // 'en' → assistant replies in English
  today: string;               // "7/9 Thu"
  person?: string;             // current user's name
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

The 12 structured operations the assistant can return (`type` + fields):

| type | Key fields | Description |
|---|---|---|
| `add_task` | `title, owner?, date?, priority?, category?` | Add a task |
| `reassign` | `match, owner` | Reassign owner |
| `set_status` | `match, status` | Set status `not_started\|in_progress\|done\|issue` |
| `set_priority` | `match, priority` | Set priority `P0\|P1\|P2` |
| `set_date` | `match, date` | Set date `MM-DD` |
| `set_blocking` | `match, blocking` | Mark whether it blocks the move |
| `delete_task` | `match` | Delete a task |
| `add_member` | `name, role?` | Add a member |
| `rename_member` | `match, name` | Rename a member |
| `set_utility` | `name, status` | Set a utility's status |
| `bulk_update` | `filter{}, set{}` | Bulk edit |
| `remember` | `note` | Remember a long-term preference |

> `match` = task-title keyword (fuzzy; may trigger disambiguation).

### Envelope

```typescript
interface Envelope {
  data: SharedBoard;
  rev: number;        // monotonic version
  updatedAt: number;  // ms timestamp
  origin: string;     // writer id (client id, or 'lark')
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

Config for the "moving plan for a friend" feature.

```typescript
interface MoveConfig {
  name: string;                        // the friend's name (first screen)
  from: string;                        // "San Francisco, CA"
  to: string;
  date: string;                        // move day, ISO "YYYY-MM-DD"
  size: 'studio'|'1br'|'2br'|'3br';    // only affects the "~N boxes" copy
  template: 'local'|'long';            // local / long-distance (long adds 6 tasks)
  by?: string;                         // signature (your name)
  wish?: string;                       // blessing shown with confetti on completion
  lang?: 'zh'|'en';                    // plan render language (the friend always sees this)
}
```

---

## 10. Environment Variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (AI assistant) |
| `ASSISTANT_MODEL` | Assistant model, defaults to `claude-haiku-4-5` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash Redis REST (sync + plan storage). `UPSTASH_REDIS_REST_URL` / `_TOKEN` also accepted |
| `LARK_APP_ID` / `LARK_APP_SECRET` | Lark self-built app credentials |
| `LARK_DOMAIN` | Lark gateway, defaults to `open.larksuite.com` (international) |
| `LARK_USER_IDS` | Family member `user_id` list (push targets) |
| `LARK_MEMBERS` | `{user_id: name}` JSON (for "completed by X") |
| `LARK_SYNC_ROOM` | Family room code (the scheduled brief reads this board) |
| `LARK_ENCRYPT_KEY` | Lark event encrypt key (when set, webhooks require encrypted payloads) |
| `LARK_VERIFICATION_TOKEN` | Lark event verification token |
| `CRON_SECRET` | Protects scheduled/admin endpoints |
| `APP_URL` | App URL, defaults to `https://banjia-two.vercel.app/` |

> ⚠️ **Security:** all secrets are injected via environment variables only — never commit them to the repo.

---

*End of reference*
