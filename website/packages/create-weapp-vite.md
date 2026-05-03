---
title: create-weapp-vite
description: create-weapp-vite 是官方脚手架，用于快速创建小程序工程，并在模板中对齐 Weapp-vite / Wevu 的版本组合。
keywords:
  - Weapp-vite
  - api
  - packages
  - create
  - weapp
  - vite
  - create-weapp-vite
  - 是官方脚手架
---

# create-weapp-vite

`create-weapp-vite` 是官方脚手架，用于快速创建小程序工程，并在模板中对齐 `weapp-vite` / `wevu` 的版本组合。

> [!IMPORTANT]
> 如果你在已有项目里手动安装 `weapp-vite` 与 `wevu`，也请保持两者版本号一致（例如 `weapp-vite@x.y.z` 与 `wevu@x.y.z`）。

## 何时使用

- 你想快速初始化新项目
- 你希望通过模板统一团队目录结构与依赖版本
- 你要在 CI 或自动化脚本里做非交互创建
- 你希望项目初始化后，顺手把推荐的 AI skills 与 `AGENTS.md` 一起就位

## 快速开始

```bash
pnpm create weapp-vite
# 或 npx create-weapp-vite
```

交互模式下，脚手架会默认询问是否安装推荐的 AI skills，并提前提示将执行：

```bash
npx skills add sonofmagic/skills
```

如果你选择跳过，也可以在项目创建完成后手动执行该命令。

同时，脚手架还会在项目根目录生成 `AGENTS.md`，把当前模板推荐的 AI 工作流、命令入口与约束一起写进去。

如果你想先了解这些 AI skills 分别适合什么任务，可以阅读 [AI Skills 使用指南](/guide/skills)；如果要把 issue 修复、文档同步、DevTools e2e 或迁移任务串成流程，可以阅读 [AI 任务工作流](/guide/ai-workflows)。

### 非交互模式

```bash
pnpm create weapp-vite my-app wevu

# 显式安装推荐 skills
pnpm create weapp-vite my-app wevu --install-skills

# 显式跳过推荐 skills 安装
pnpm create weapp-vite my-app wevu --no-install-skills
```

第二个参数是模板名，内部对应 `TemplateName` 枚举。

> **注意**：非交互模式下，如果你没有显式传 `--install-skills`，默认不会自动安装 AI skills；交互模式下默认值是“是”。

## CLI 参数

命令格式：

```bash
create-weapp-vite [targetDir] [templateName] [--install-skills] [--no-install-skills]
```

参数说明：

| 参数                  | 说明                                   |
| --------------------- | -------------------------------------- |
| `targetDir`           | 目标目录；交互模式默认 `my-app`        |
| `templateName`        | 模板名；非交互模式缺省时默认 `default` |
| `--install-skills`    | 非交互模式下显式安装推荐的 AI skills   |
| `--no-install-skills` | 非交互模式下显式跳过 AI skills 安装    |

交互流程会依次处理：

1. 目标目录
2. 是否覆盖已有目录
3. 模板选择
4. 是否安装推荐的 AI skills

## 可编程 API

```ts
import { createProject, TemplateName } from 'create-weapp-vite'

await createProject('my-app', TemplateName.wevu)
await createProject('my-app', TemplateName.wevu, { installSkills: true })
```

## 可选模板（当前实现）

| 模板名         | 说明                         |
| -------------- | ---------------------------- |
| `default`      | 默认原生小程序模板           |
| `plugin`       | 微信小程序插件模板           |
| `lib`          | 组件库模板（lib 模式）       |
| `wevu`         | Wevu + Vue SFC 模板          |
| `wevu-tdesign` | Wevu + TDesign + TailwindCSS |
| `tailwindcss`  | 原生小程序 + TailwindCSS     |
| `vant`         | Vant + TailwindCSS           |
| `tdesign`      | TDesign + TailwindCSS        |

## 初始化后会做什么

- 复制对应模板目录
- 自动整理 `gitignore` / `.gitignore`
- 对齐 `weapp-vite`、`wevu`、`@wevu/api` 等依赖版本
- 在项目根目录生成 `AGENTS.md`
- 按需执行 `npx skills add sonofmagic/skills`

如果 AI skills 安装失败，脚手架不会回滚项目创建，而是输出警告，并提示你稍后手动执行推荐命令。

## 与主文档的关系

- 工程创建后，日常开发请转到 [指引](/guide/) 与 [配置](/config/)。
- AI 协作、skills 与 MCP 接入请转到 [AI 协作指南](/guide/ai)、[AI Skills 使用指南](/guide/skills) 与 [@weapp-vite/mcp](/packages/mcp)。
