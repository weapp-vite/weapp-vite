---
title: QuickApp 实验支持
description: 使用 weapp-vite 构建原生 QuickApp，并把 Vue SFC 直接编译为 .ux；明确不支持微信小程序转换。
keywords:
  - quickapp
  - hap
  - vue sfc
  - ux
  - e2e
---

# QuickApp 实验支持

QuickApp 是 `weapp-vite` 的独立实验后端，支持原生快应用工程和 Vue SFC 直接编译为 `.ux`。它不属于 `weapp.platform`，也不把微信小程序转换成快应用。

## 快速开始

```bash
pnpm add -D hap-toolkit@2.1.0
wv build --platform quickapp
wv dev --platform quickapp
```

源码目录需要直接包含 `manifest.json`、`app.ux`，页面和组件可以使用原生 `.ux` 或当前支持范围内的 `.vue`。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  quickapp: {
    srcDir: 'src',
    outDir: 'dist/quickapp',
    testDir: 'test',
    toolkit: {
      enabled: true,
      e2e: false,
      devtool: 'source-map',
    },
  },
})
```

## 支持边界

Vue SFC 当前覆盖 `<script setup>`、TypeScript、基础 Options API、响应式状态、常用生命周期、条件/列表/显隐/属性/事件指令，以及本地 Vue 组件的 props 和事件。

以下能力会明确报错或不进入该后端：

- `v-model`、事件修饰符、动态事件名、无参数 `v-bind`。
- Web Vue DOM、Transition、Teleport、Suspense 等浏览器能力。
- `app.json`、WXML、WXSS、WXS、`usingComponents`。
- `wx.*`、`App/Page/Component`、`setData` 和微信生命周期转换。

## E2E

```bash
wv build --platform quickapp --quickapp-e2e
pnpm e2e:quickapp
```

构建 CI 通过真实 `hap-toolkit` 验证 RPK；设备 suite 使用一个 Android ADB 会话，通过 deep link 切换路由并用 `uiautomator` 做文本和点击断言。设备需要安装官方 QuickApp mockup/debugger，并完成 USB 调试授权。

更完整的配置项、Vue 矩阵和设备环境变量见 npm 包内的 `node_modules/weapp-vite/dist/docs/quickapp.md`。
