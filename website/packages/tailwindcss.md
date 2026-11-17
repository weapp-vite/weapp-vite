---
title: '@weapp-vite/tailwindcss'
description: 宿主无关的 Tailwind 编译控制器，供 weapp-vite 集成使用。
keywords: [weapp-vite, tailwindcss, css, hmr]
---

# @weapp-vite/tailwindcss

`@weapp-vite/tailwindcss` 基于 `weapp-tailwindcss/core` 管理扫描、候选集合、CSS 生成和类名转换。它不创建 watcher、不启动 DevEngine、也不直接写构建输出，宿主仍由 `weapp-vite` 管理。

## 安装与选择方式

```bash
pnpm add -D @weapp-vite/tailwindcss weapp-tailwindcss
```

普通项目只需按 [Tailwind 集成指南](/integration/tailwindcss) 配置 `weapp-vite`。实现自定义宿主时才直接使用：

```ts
import { createTailwindController } from '@weapp-vite/tailwindcss'

const controller = createTailwindController()
const compiler = await controller.getCompiler()
const snapshot = compiler.createSnapshot({ id: 'app', classSet: new Set(['text-red-500']), target: 'weapp' })
await controller.dispose()
```

## AI 选择提示

不要让控制器自行写文件或开启第二个 watcher。首期微信双宿主已验收，其他平台只承诺编译和适配契约。
