---
title: website-weapp-vite
description: Store API 统一从主入口导出，并补充 wevu 使用文档与案例合集。
keywords:
  - weapp-vite
  - changelog
  - website-weapp-vite
  - store
  - api
  - 统一从主入口导出
  - 并补充
  - wevu
---

# website-weapp-vite

## 1.0.4

### Patch Changes

- 🐛 **## unify-wevu-entry** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7) by @sonofmagic
  Store API 统一从主入口导出，并补充 wevu 使用文档与案例合集。

  ## zh-auto-wevu-page-features

  weapp-vite 在编译阶段自动根据页面中使用的 wevu hooks（如 `onPageScroll` / `onShareAppMessage` 等）推断并注入对应 `features.enableOnXxx = true`，降低手动维护 `PageFeatures` 标志位的成本。
  - 同时支持 `.vue` SFC 页面与手写 `.ts/.js` 页面（仅在识别到 wevu 相关调用时才处理，不影响未使用 wevu 的页面）。
  - 显式写入的 `features` 不会被覆盖（可用 `false` 显式禁用）。

  ## zh-wevu-component-lifetimes-hooks

  补齐组件 `lifetimes/pageLifetimes` 的 hook 派发能力：
  - wevu：新增 `onMoved` / `onError` / `onResize`，分别对应 `lifetimes.moved` / `lifetimes.error` / `pageLifetimes.resize`。
  - 文档：补充 `defineComponent` 组件侧 lifetimes/pageLifetimes → wevu hooks 对照表。

  ## zh-wevu-component-only-pages

  wevu 页面/组件注册统一走小程序 `Component()`：移除 `definePage` 与 `defineComponent({ type: 'page' })` 写法，页面能力通过 `features` 声明（滚动/分享/收藏等）；同时 weapp-vite 默认处理 `.vue` 时会生成/合并 `json` 并强制写入 `"component": true`（即使未提供 `<json>`）；同步更新文档与 demo，并删除 `createApp().mount()` 相关文档描述。

## 1.0.4-alpha.1

### Patch Changes

- [`25bb59e`](https://github.com/weapp-vite/weapp-vite/commit/25bb59ef81b5c5e85a54919e874b720a7f4d558b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - weapp-vite 在编译阶段自动根据页面中使用的 wevu hooks（如 `onPageScroll` / `onShareAppMessage` 等）推断并注入对应 `features.enableOnXxx = true`，降低手动维护 `PageFeatures` 标志位的成本。
  - 同时支持 `.vue` SFC 页面与手写 `.ts/.js` 页面（仅在识别到 wevu 相关调用时才处理，不影响未使用 wevu 的页面）。
  - 显式写入的 `features` 不会被覆盖（可用 `false` 显式禁用）。

- [`7af6104`](https://github.com/weapp-vite/weapp-vite/commit/7af6104c5a4ddec0808f7336766adadae3c3801e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 补齐组件 `lifetimes/pageLifetimes` 的 hook 派发能力：
  - wevu：新增 `onMoved` / `onError` / `onResize`，分别对应 `lifetimes.moved` / `lifetimes.error` / `pageLifetimes.resize`。
  - 文档：补充 `defineComponent` 组件侧 lifetimes/pageLifetimes → wevu hooks 对照表。

## 1.0.4-alpha.0

### Patch Changes

- [`e9545a0`](https://github.com/weapp-vite/weapp-vite/commit/e9545a0120ca4183cb956395a53cea0e1d0f5f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - wevu 页面/组件注册统一走小程序 `Component()`：移除 `definePage` 与 `defineComponent({ type: 'page' })` 写法，页面能力通过 `features` 声明（滚动/分享/收藏等）；同时 weapp-vite 默认处理 `.vue` 时会生成/合并 `json` 并强制写入 `"component": true`（即使未提供 `<json>`）；同步更新文档与 demo，并删除 `createApp().mount()` 相关文档描述。

## 1.0.3

### Patch Changes

- [`f1fd325`](https://github.com/weapp-vite/weapp-vite/commit/f1fd3250cfec6a508535618169de0f136ec5cbc2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade 升级依赖版本

## 1.0.2

### Patch Changes

- [`0ae2a53`](https://github.com/weapp-vite/weapp-vite/commit/0ae2a53198b8d3ab3e8a9ac18ee125e2017a8f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: change website url

## 1.0.1
