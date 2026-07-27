---
title: Wot UI 与 uni-app 组件库
description: 使用实验性的 uni-app 源码兼容层和 WotUiResolver，在微信小程序与 Web 中运行 Wot UI 2.2.0 的 99 个公开 Vue 组件。
keywords:
  - Wot UI
  - uni-app
  - Vue SFC
  - 微信小程序
  - Web
  - 组件库
---

# Wot UI 与 uni-app 组件库兼容（实验性）

> [!WARNING]
> 这是实验性能力，当前兼容基线固定为 `@wot-ui/ui@2.2.0`。默认完全关闭；只有项目源码和 `weapp.uniApp.include` 明确列出的 npm 包会进入 uni-app 方言转换。

## 安装

```bash
pnpm add weapp-vite wevu @wot-ui/ui@2.2.0
```

## 配置

```ts
import { defineConfig } from 'weapp-vite/config'
import { WotUiResolver } from 'weapp-vite/resolvers'

export default defineConfig({
  weapp: {
    uniApp: {
      include: ['@wot-ui/ui'],
    },
    autoImportComponents: {
      resolvers: [WotUiResolver()],
      vueComponents: true,
      vueComponentsModule: 'wevu',
    },
  },
})
```

`WotUiResolver()` 使用 Wot UI 2.2.0 的真实公开 SFC 清单建立标签映射，并返回 `sourceType: 'wevu-sfc'` 与可解析的源码 ID。不要自行假设所有 `wd-*` 标签都能通过目录名拼接得到入口。

`weapp.uniApp` 的行为：

- 未配置或设为 `false` 时不扫描依赖，也不改变现有项目行为。
- 项目源码自动参与 uni-app 条件编译；npm 依赖必须出现在 `include` 白名单中。
- 微信目标启用 `MP-WEIXIN`，Web 目标启用 `H5`。
- 支持 script、template、style 中嵌套的 `#ifdef`、`#ifndef`、`#else`、`#endif` 和 `A || B`。
- 自由 `uni` 引用会在小程序目标静态绑定到 `wx`；Vue 运行时导入会按组件源码需要改写到 `wevu`。
- 转换错误会包含包名、SFC 路径和区块类型，不会静默输出残缺组件。

## 启动与构建

```bash
# 微信小程序
pnpm dev
pnpm build

# Web
pnpm dev:web
pnpm build:web
```

微信产物通过项目根 `project.config.json` 导入微信开发者工具。Web 项目需要按 Web runtime 约定提供引用 `/@weapp-vite/web/entry` 的 `index.html`。

## 兼容矩阵

矩阵以 `@wot-ui/ui@2.2.0/global.d.ts` 实际公开的 99 个 Vue SFC 为准。每个组件都有独立页面；依赖父容器的组件会在自己的页面内使用最小父组件承载。

```text
组件 | 独立页 | Web | 微信小程序 | Headless
wd-action-sheet | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-avatar | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-avatar-group | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-backtop | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-badge | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-button | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-calendar | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-calendar-view | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-card | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-cascader | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-cell | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-cell-group | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-checkbox | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-checkbox-group | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-circle | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-col | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-collapse | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-collapse-item | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-config-provider | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-count-down | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-count-to | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-curtain | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-datetime-picker | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-datetime-picker-view | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-dialog | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-divider | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-drop-menu | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-drop-menu-item | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-empty | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-fab | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-floating-panel | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-form | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-form-item | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-gap | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-grid | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-grid-item | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-icon | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-image-preview | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-img | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-img-cropper | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-index-anchor | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-index-bar | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-input | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-input-number | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-keyboard | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-loading | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-loadmore | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-navbar | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-navbar-capsule | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-notice-bar | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-notify | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-overlay | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-pagination | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-password-input | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-picker | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-picker-view | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-popover | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-popup | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-progress | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-radio | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-radio-group | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-rate | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-resize | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-root-portal | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-row | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-search | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-segmented | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-select-picker | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-sidebar | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-sidebar-item | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-signature | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-skeleton | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-slide-verify | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-slider | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-sort-button | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-step | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-steps | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-sticky | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-sticky-box | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-swipe-action | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-swiper | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-swiper-nav | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-switch | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-tab | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-tabbar | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-tabbar-item | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-table | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-table-column | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-tabs | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-tag | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-text | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-textarea | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-toast | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-tooltip | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-tour | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-transition | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-upload | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-video-preview | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
wd-watermark | 是 | 行为+移动/桌面视觉 | 行为+视觉 | 行为
```

`wd-swiper-indicator` 和 `wd-tour-step` 没有独立公开 SFC，分别在 `wd-swiper` / `wd-swiper-nav` 与 `wd-tour` 场景中覆盖，不伪造 resolver 入口。

## 已知边界

- 兼容矩阵承诺默认渲染、代表性 props/slot 和至少一个稳定状态；不承诺每个组件的全部 props、业务组合或宿主权限流程。
- 当前只承诺微信小程序和 Web；支付宝、抖音等其他 uni-app 条件分支尚未纳入验收。
- 这是面向当前组件场景的兼容层，不是完整 uni-app 运行时。未被组件触达的 `uni.*` API 不会因此自动具备实现。
- 上传、视频、图片、裁剪、签名和倒计时示例应使用本地固定资源与测试 mock，避免依赖公网、用户授权或实时时钟。
- 外部 SFC 的样式、资源和最终产物仍由 Vite/Rolldown transform、emit 和 write 管理；不要通过脚本手写构建产物。
