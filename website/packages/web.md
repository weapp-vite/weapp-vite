---
title: "@weapp-vite/web"
description: "@weapp-vite/web 是实验性的 H5 运行时与 Vite 插件，用于把小程序模板能力映射到浏览器环境做验证。"
keywords:
  - weapp-vite
  - 运行时
  - packages
  - web
  - "@weapp-vite/web"
  - 是实验性的
  - h5
  - 运行时与
---

# @weapp-vite/web

`@weapp-vite/web` 是实验性的 H5 运行时与 Vite 插件，用于把小程序模板能力映射到浏览器环境做验证。

> 当前仍是 POC 阶段，适合技术验证，不建议直接作为生产方案。

## 何时使用

- 你要在浏览器快速验证小程序页面逻辑
- 你要做模板编译、事件桥接、路由行为的实验
- 你要为小程序 DSL 做 Web 演示或调试

## 安装

```bash
pnpm add -D @weapp-vite/web
```

## Vite 插件接入

```ts
import { weappWebPlugin } from '@weapp-vite/web'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    weappWebPlugin({
      srcDir: 'src',
      runtime: {
        executionMode: 'compat',
      },
    }),
  ],
})
```

## 运行时能力

包内同时导出运行时 API，例如：

- `defineComponent`
- `registerApp` / `registerPage` / `registerComponent`
- `navigateTo` / `navigateBack` / `getCurrentPages`
- `request` / `showToast` 等 polyfill API

## 能力边界

- 支持 `wx:if` / `wx:for` / 插值等常见语法
- 支持小程序到 DOM 事件桥接（如 `bindtap`）
- 样式与 API 兼容度仍在持续补齐
