# Move Guide · 家庭搬家执行指南 / Family Moving Playbook

从 **17 Dava** 搬到 **25 New Dawn** 的家庭协作式搬家执行网页。
A collaborative family moving-coordination web app.

打开即用、无需登录：家庭端查看与勾选，管理后台维护任务 / 服务 / 成员 / 模板，右下角还有一个可语音对话的 AI 小助手。看板默认存本地（localStorage），可选开启多设备同步、飞书推送与 AI —— 所有密钥只走环境变量。

> **双语 / Bilingual:** 全站支持中文（默认）与英文，右上角 `中 / EN` 一键切换，选择记忆在本机。
> The whole UI ships in Chinese (default) and English — toggle with `中 / EN` in the top bar.

- 线上 / Live: **https://banjia-two.vercel.app**
- 计划生成器 / Plan builder: **https://banjia-two.vercel.app/config**

---

## ✨ 功能 / Features

- **家庭端** — 概览 Dashboard、时间线、家庭分工、任务清单（按人/时间/分类筛选）、服务开通、模板文件（一键复制）
- **管理后台** — 数据总览、任务管理（增删改）、服务管理、成员负载、模板编辑
- **AI 小助手** — 语音/文字对话，查询进度、加任务、改分工；网页与飞书群共用同一套「大脑」
- **多设备同步** — 房间码共享一份清单，勾选/任务/成员实时同步（Upstash Redis）
- **飞书（Lark）集成** — 每日简报推送、群里 @机器人 增删改任务、任务完成深链、日历里程碑
- **送朋友的搬家计划** — `/config` 填几项生成专属短链，朋友点开看到写着自己名字的中/英文计划，完成时撒花送祝福
- **PWA** — 可安装、离线可用；有新版本时提示刷新

---

## 📚 文档 / Documentation

完整文档在 **[`docs/`](./docs/)**（可导入飞书阅读）：

| 入口 | 内容 |
|---|---|
| [docs/README.md](./docs/README.md) | 文档索引（总入口） |
| [docs/api-reference.md](./docs/api-reference.md) · [.en](./docs/api-reference.en.md) | API 参考（中英对照 / 纯英文） |
| [docs/openapi.yaml](./docs/openapi.yaml) | OpenAPI 3.0.3 规范（导入 Apifox / Postman） |
| [docs/lark-integration.md](./docs/lark-integration.md) + [docs/examples/](./docs/examples/) | **可复用的 Lark（飞书）工具包**：手册 + 核心模块 + TS 类型 + Express/Vercel 示例 |

> 想在别的项目接飞书？直接拷 [`docs/examples/`](./docs/examples/)，配好环境变量即可用。

---

## 🛠 技术栈 / Stack

- **前端**：Vite + React 19 + TypeScript · oklch 调色板 · Noto Sans SC + Space Grotesk · PWA
- **后端**：Vercel Serverless Functions（`/api/*`）· Upstash Redis（同步 & 短链）· Anthropic Claude（AI 助手）· Lark Open API
- **部署**：Vercel（静态 SPA + serverless）

---

## 🚀 启动 / Getting Started

```bash
npm install
npm run dev      # 本地开发（AI/同步/飞书需线上后端，本地仅前端）
npm run build    # 生产构建（tsc -b && vite build）
npm run preview  # 预览构建产物
```

可选能力通过环境变量启用（`ANTHROPIC_API_KEY`、`KV_REST_API_*`、`LARK_*`、`CRON_SECRET` 等），完整清单见 [docs/api-reference.md](./docs/api-reference.md#10-环境变量-environment-variables)。未配置时应用自动降级为纯本地模式。

> ⚠️ 所有密钥仅通过环境变量注入，切勿写入代码或提交仓库。

---

## 🔐 数据与隐私 / Data & Privacy

- 看板默认只存在你自己的浏览器（localStorage key `moveguide_v2`）；侧边栏可导出/导入/重置。
- 开启同步后，共享看板存于你自己的 Redis；「送朋友的计划」配置存于短链后端。
- 无账号、无登录、无第三方追踪。
