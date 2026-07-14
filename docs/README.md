# Move Guide · 文档索引 / Docs Index

**banjia (Move Guide · 家庭搬家执行指南)** 的文档目录。
Documentation for **banjia (Move Guide)** — a family moving-coordination app.

- 线上 / Live: https://banjia-two.vercel.app
- 计划生成器 / Plan builder: https://banjia-two.vercel.app/config

---

## 文档 / Documents

| 文件 | 语言 | 用途 |
|---|---|---|
| [api-reference.md](./api-reference.md) | 中英对照 / Bilingual | 完整 API 参考（Yodeck 结构）。适合导入飞书文档阅读。 |
| [api-reference.en.md](./api-reference.en.md) | English | 纯英文版参考，方便英文读者阅读/分享。 |
| [openapi.yaml](./openapi.yaml) | OpenAPI 3.0.3 | 机器可读规范，可导入 Apifox / Postman / 飞书 API 表格，一键测试。 |

三份内容一致，按需求选格式：**读文档**用 `.md`，**测接口**用 `openapi.yaml`。
All three cover the same surface — use the `.md` files to **read**, `openapi.yaml` to **test**.

---

## 快速上手 / Quick Start

**导入飞书 / Import into Lark**
新建 → 导入 → 选择某个 `.md` 文件（标题、表格、代码块自动转换），或直接复制全文粘贴。
New → Import → pick a `.md` file, or copy-paste the whole file into a Lark doc.

**导入 Apifox / Postman**
Import → OpenAPI/Swagger → 选择 `docs/openapi.yaml`。
Import → OpenAPI/Swagger → select `docs/openapi.yaml`.

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

端点有增改时，同步更新这三份文件（保持一致），再重新导入飞书 / Apifox 即可。
When endpoints change, update all three files together, then re-import into Lark / Apifox.

> ⚠️ 所有密钥仅走环境变量，切勿写入文档或提交仓库。
> ⚠️ All secrets stay in environment variables — never in docs or commits.
