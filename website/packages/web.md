---
title: "@weapp-vite/web"
description: "@weapp-vite/web 是实验性的 H5 运行时与 Vite 插件，用于把小程序模板能力映射到浏览器环境做验证。"
keywords:
  - Weapp-vite
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
        viewport: {
          mode: 'mini-program',
          maxWidth: 375,
          desktopBreakpoint: 600,
        },
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

## 视觉与组件适配

- 默认提供 375px 宽的居中小程序设备视口；移动宽度下自动铺满
- `rpx` 跟随设备容器宽度和 resize 更新
- `view`、`text`、`image`、`button`、`input`、`scroll-view`、`navigator`、`swiper` / `swiper-item` 及常用表单组件使用独立运行时标签，不会过早降级为无语义 DOM
- `page` 和原生组件 WXSS 选择器通过 PostCSS 结构化转换
- `image.mode`、input 常用属性与事件、scroll-view 滚动状态和事件已有基础适配
- `form`、`label`、`textarea`、checkbox/radio group 和 `switch` 支持表单收集、提交、重置及微信形状的交互事件
- `navigator` 复用页面栈和 mini-program bridge；`swiper` 支持受控状态、触摸、autoplay 及 `change` / `transition` / `animationfinish` 事件

需要保留旧的浏览器全宽行为时，将 `runtime.viewport.mode` 设置为 `responsive`。

## 能力边界

- 支持 `wx:if` / `wx:for` / 插值等常见语法
- 支持小程序到 DOM 事件桥接（如 `bindtap`）
- 未覆盖的原生组件、平台 API 和宿主细节仍需在微信 DevTools / 真机验证
