# Move Guide · 文档索引 / Docs Index

**banjia (Move Guide · 家庭搬家执行指南)** 的文档目录。
Documentation for **banjia (Move Guide)** — a family moving-coordination app.

- 线上 / Live: https://banjia-two.vercel.app
- 计划生成器 / Plan builder: https://banjia-two.vercel.app/config

---

## API 参考 / API Reference

| 文件 | 语言 | 用途 |
|---|---|---|
| [api-reference.md](./api-reference.md) | 中英对照 / Bilingual | 完整 API 参考（Yodeck 结构）。适合导入飞书文档阅读。 |
| [api-reference.en.md](./api-reference.en.md) | English | 纯英文版参考，方便英文读者阅读/分享。 |
| [openapi.yaml](./openapi.yaml) | OpenAPI 3.0.3 | 机器可读规范，可导入 Apifox / Postman / 飞书 API 表格，一键测试。 |

三份内容一致，按需求选格式：**读文档**用 `.md`，**测接口**用 `openapi.yaml`。
All three cover the same surface — use the `.md` files to **read**, `openapi.yaml` to **test**.

---

## Lark 复用工具包 / Reusable Lark Toolkit

想在**其他项目**里接飞书？把 [`examples/`](./examples/) 目录拷过去即可 —— 零第三方依赖，配好环境变量就能用。

> 📦 已抽成独立私有仓库：**[github.com/sehaha/lark-core](https://github.com/sehaha/lark-core)**（含家庭成员名单 `members.js`）。新项目优先用它；下面是同源副本。

| 文件 | 说明 |
|---|---|
| [lark-integration.md](./lark-integration.md) | **复用手册**：能力总览、飞书后台配置清单、调用实例、实质建议与踩坑。 |
| [examples/lark-core.js](./examples/lark-core.js) | 去耦合的核心模块（`getTenantToken` / `larkApi` / `sendText·sendCard·sendCardToMany` / 卡片积木 / `parseEvent·verifyToken·seenEvent`）。 |
| [examples/lark-core.d.ts](./examples/lark-core.d.ts) | TypeScript 类型声明（`--strict` 通过，与 `.js` 同目录自动识别）。 |
| [examples/server.express.js](./examples/server.express.js) | 最小可跑的 Express 机器人（事件 webhook + `/send` 测试）。 |
| [examples/vercel-api-lark-event.js](./examples/vercel-api-lark-event.js) | Vercel Serverless 版事件 webhook（放到 `api/lark-event.js`）。 |
| [examples/README.md](./examples/README.md) | 环境变量 + 运行指南（Express + 隧道联调 / Vercel / TypeScript）。 |

> 抓手：**`getTenantToken` + `larkApi` 是地基**，发消息 / 卡片 / 事件 / 日历都是其上的薄封装。

---

## 快速上手 / Quick Start

**导入飞书 / Import into Lark**
新建 → 导入 → 选择某个 `.md` 文件（标题、表格、代码块自动转换），或直接复制全文粘贴。
New → Import → pick a `.md` file, or copy-paste the whole file into a Lark doc.

**导入 Apifox / Postman**
Import → OpenAPI/Swagger → 选择 `docs/openapi.yaml`。
Import → OpenAPI/Swagger → select `docs/openapi.yaml`.

**复用 Lark / Reuse the Lark toolkit**
拷 `docs/examples/` → 配环境变量 → `node server.express.js`（或部署到 Vercel）。详见 [examples/README.md](./examples/README.md)。
Copy `docs/examples/`, set the env vars, run it. See [examples/README.md](./examples/README.md).

---

## 系统一览 / At a Glance

零传统后端：静态 SPA（localStorage + 多设备同步）+ 一组 Vercel Serverless Functions（`/api/*`）。
Backend-light: a static SPA (localStorage + multi-device sync) plus Vercel serverless functions.

| 能力 / Capability | 端点 / Endpoints |
|---|---|
| AI 助手 / AI assistant | `POST /api/assistant` |
| 多设备同步 / Multi-device sync | `GET·POST /api/sync` |
| 送朋友的搬家计划 / Share-by-link plan | `POST·GET /api/plan`, `/config`, `/?p=<code>` |
| 任务完成深链 / Task-complete deep link | `GET /api/complete` |
| 飞书推送 / Lark push | `GET·POST /api/lark` |
| 飞书 Webhook / Lark webhooks | `POST /api/lark-event`, `POST /api/lark-callback` |
| 定时与管理 / Scheduled & admin | `GET /api/cron/remind`, `POST /api/lark-calendar`, `GET /api/lark-guide` |

> 完整参数、请求/响应体、数据模型与环境变量见上面的 API 参考。
> Full params, request/response bodies, data models and env vars are in the API reference above.

---

## 维护 / Maintenance

- 端点有增改：同步更新三份 API 参考（`.md` ×2 + `openapi.yaml`），再重新导入飞书 / Apifox。
- Lark 能力有增改：更新 `examples/lark-core.js`（及其 `.d.ts`）与 `lark-integration.md`。

> ⚠️ 所有密钥仅走环境变量，切勿写入文档或提交仓库。
> ⚠️ All secrets stay in environment variables — never in docs or commits.
