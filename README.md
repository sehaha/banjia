# Move Guide · 家庭搬家执行指南 / Family Moving Playbook

从 **17 Dava** 搬到 **25 New Dawn** 的家庭协作式搬家执行网页。
A collaborative family moving-coordination web app (move from **17 Dava** to **25 New Dawn**).

**localStorage 前端 + 一个 AI serverless 函数**，无需登录，打开即用。
家庭端负责查看与勾选，管理后台维护任务 / 服务 / 成员 / 模板，右下角还有一个可
语音对话的 AI 小助手（查询进度、加任务、改分工）。数据存本地，AI 密钥只走环境变量。

> **双语 / Bilingual:** 全站支持中文（默认）与英文，右上角 `中 / EN` 一键切换，选择记忆在本机。
> The whole UI ships in Chinese (default) and English — toggle with `中 / EN` in the top bar (persisted per device).

## 功能

**家庭端**
- 概览 Dashboard：深色 hero、当前阶段 / 距离搬家 / P0 待办 / 进行中、按人分组的今日任务、P0 紧急提醒、快捷入口
- 时间线 Timeline：7/5 ~ 7/11 每日一张卡片
- 家庭分工 People：按成员查看今日 / 未完成 / 已完成任务
- 任务清单 Checklist：按负责人 / 时间 / 分类筛选
- 服务开通 Utilities：新旧房服务状态一键切换
- 模板文件 Docs：话术与清单一键复制

**管理后台**
- 数据总览、任务管理（增删改）、服务管理、成员负载、模板编辑

## 数据保存

- 所有改动自动保存在浏览器 localStorage（key: `moveguide_v2`）
- 侧边栏支持「导出进度」JSON（发给家人）/「导入」/「重置」
- 无服务器、无数据库、无 API 密钥

## 技术栈

Vite + React 19 + TypeScript · oklch 调色板 · Noto Sans SC + Space Grotesk · 部署于 Vercel（静态 SPA）

## 启动

```bash
npm install
npm run dev      # 本地开发
npm run build    # 生产构建（tsc -b && vite build）
npm run preview  # 预览构建产物
```

目标搬家日：**7/9 周四**。所有数据只存在你自己的浏览器里。
