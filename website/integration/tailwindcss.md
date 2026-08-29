---
title: Tailwindcss 集成
description: 如果你是新项目，直接用官方模板创建即可，模板已集成 Tailwind CSS：
keywords:
  - integration
  - tailwindcss
  - 集成
  - 如果你是新项目
  - 直接用官方模板创建即可
  - 模板已集成
  - tailwind
  - CSS：
---

# Tailwindcss 集成

## 直接使用模板（推荐）

如果你是新项目，直接用官方模板创建即可，模板已集成 Tailwind CSS：

```sh
pnpm create weapp-vite
```

## 手动集成

`weapp-vite` 已内置 `weapp-tailwindcss@5.4.1` 的 compiler 集成，不需要安装或注册 `weapp-tailwindcss/vite`。

先安装 Tailwind CSS 4：

```sh
pnpm add -D tailwindcss
```

在 `src/app.css` 中引入 Tailwind，并确保这个文件被项目实际引入：

```css
@import 'tailwindcss';
```

Tailwind CSS v4 项目未配置 `weapp.tailwindcss` 时会自动启用内置集成；也可以显式传入 options：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    tailwindcss: {
      cssEntries: ['src/app.css'],
      rem2rpx: true,
      compiler: {
        maxRoots: 32,
        onRootEvicted(id) {
          console.log('Tailwind root evicted:', id)
        },
      },
    },
  },
})
```

显式设置 `tailwindcss: false` 可以关闭自动检测。`cssEntries` 只声明入口集合，不能代替 CSS 模块图导入。内置 compiler 会统一处理 WXSS、WXML 和 JavaScript；5.4.1 默认完成 WXSS 最终化，确保 Tailwind 的 `@plugin`、`@source` 等构建阶段指令不会进入产物。HMR 直接把真实变更文件交给 compiler，并根据 `@source` glob 精确失效关联 root。

大型多入口项目可以用 `compiler.maxRoots` 控制 root 缓存上限，并通过 `compiler.onRootEvicted` 观察被淘汰的 root id。

旧项目如果仍注册了外部插件，`weapp-vite` 会在 preflight 阶段移除所有 `weapp-tailwindcss:*` 插件并输出一次迁移警告；请删除对应 import 和 `plugins` 注册代码。

更多 `weapp-tailwindcss` core options 说明：

- https://tw.icebreaker.top/docs/quick-start/native/install
