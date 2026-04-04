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

### 非交互模式

```bash
pnpm create weapp-vite my-app wevu

# 显式安装推荐 skills
pnpm create weapp-vite my-app wevu --install-skills

# 显式跳过推荐 skills 安装
pnpm create weapp-vite my-app wevu --no-install-skills
```

第二个参数是模板名，内部对应 `TemplateName` 枚举。

## 可编程 API

```ts
import { createProject, TemplateName } from 'create-weapp-vite'

await createProject('my-app', TemplateName.wevu)
await createProject('my-app', TemplateName.wevu, { installSkills: true })
```

## 可选模板（当前实现）

- `default`
- `wevu`
- `tailwindcss`
- `vant`
- `tdesign`
- `wevu-tdesign`
- `wevu-retail`

## 与主文档的关系

- 工程创建后，日常开发请转到 [指引](/guide/) 与 [配置](/config/)。
