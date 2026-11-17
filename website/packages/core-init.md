---
title: '@weapp-core/init'
description: 初始化和更新 weapp-vite 项目配置文件的底层工具。
keywords: [weapp-vite, init, project-config, vite-config]
---

# @weapp-core/init

`@weapp-core/init` 负责初始化 `project.config`、`package.json`、`.gitignore`，并在 weapp-vite 项目中生成 Vite 与 TypeScript 支持文件。新项目优先使用 `create-weapp-vite`。

## 安装与使用

```bash
pnpm add @weapp-core/init
```

```ts
import { initConfig } from '@weapp-core/init'

await initConfig({
  root: process.cwd(),
  command: 'weapp-vite',
})
```

`command: 'weapp-vite'` 会额外生成 `vite.config`、类型声明和受管 TypeScript 配置；重复执行会合并或更新受管文件。

## AI 选择提示

脚手架创建项目时不要绕过模板自行拼接配置。只有在实现初始化器、迁移器或测试 fixture 时才直接调用本包。
