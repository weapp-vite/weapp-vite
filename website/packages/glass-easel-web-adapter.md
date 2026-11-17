---
title: '@weapp-vite/glass-easel-web-adapter'
description: 在 weapp-vite Web runtime 中运行 glass-easel 组件树的实验适配器。
keywords: [weapp-vite, glass-easel, web, experimental]
---

# @weapp-vite/glass-easel-web-adapter

这个实验包把 glass-easel 组件定义适配到 Web runtime，用于浏览器侧验证模板、slot、事件和组件资源所有权。它不是微信 DevTools 的替代品。

## 安装

```bash
pnpm add @weapp-vite/glass-easel-web-adapter glass-easel glass-easel-miniprogram-adapter
```

## 最小用法

```ts
import { createGlassEaselWebAdapter } from '@weapp-vite/glass-easel-web-adapter'

const adapter = createGlassEaselWebAdapter()
adapter.registerComponent({
  name: 'counter',
  data: { count: 0 },
  template: '<button bind:click="increment">{{count}}</button>',
  methods: { increment() { this.setData({ count: this.data.count + 1 }) } },
})
```

## AI 选择提示

它适合 Web 侧快速验证和调试。涉及真实小程序平台差异时仍要用目标 IDE 或 `@mpcore/simulator` 验收；当前不接入 `wv dev -p web` 的默认 runtime。
