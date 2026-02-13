---
outline: [2, 4]
---

# Web 兼容矩阵 <span class="wv-badge wv-badge--experimental">experimental</span> {#web-compat-matrix}

本文用于说明 `weapp-vite` 在 Web 运行时（`@weapp-vite/web`）下的能力边界。
状态含义如下：

- `supported`：已实现且有基础测试覆盖。
- `partial`：可用但有明显限制或降级行为。
- `unsupported`：当前未实现，不应依赖。

> [!WARNING]
> Web 运行时仍处于实验阶段（experimental），用于预览/调试，不替代开发者工具与真机行为。

## 模板语法矩阵

| 能力                                | 状态          | 说明                                                              |
| ----------------------------------- | ------------- | ----------------------------------------------------------------- |
| `{{}}` 插值表达式                   | `supported`   | 支持文本与属性表达式。                                            |
| `wx:if / wx:elif / wx:else`         | `supported`   | 支持条件分支链路。                                                |
| `wx:for / wx:key`                   | `supported`   | 支持列表渲染与 key 生成。                                         |
| `<template name>` + `<template is>` | `supported`   | 支持模板注册与调用。                                              |
| `<import>` / `<wx-import>`          | `supported`   | 支持模板导入，缺失时告警。                                        |
| `<include>` / `<wx-include>`        | `supported`   | 支持模板包含，缺失时告警。                                        |
| `<wxs>`（内联与 src）               | `partial`     | 支持基础执行与 `require`，仅允许相对/绝对路径。                   |
| `<slot>`                            | `partial`     | 保留为原生 `slot` 标签；高级插槽语义不保证与小程序完全一致。      |
| 事件前缀 `bind/catch/capture`       | `partial`     | 采用表驱动映射并支持 `catch/capture` 标记；事件别名仍是高频子集。 |
| 复杂模板能力（如 `wx:model` 等）    | `unsupported` | 当前未进入 Web 编译主路径。                                       |

## 组件选项矩阵

| 能力                                             | 状态          | 说明                                                             |
| ------------------------------------------------ | ------------- | ---------------------------------------------------------------- |
| `properties`（含 `type/value/observer`）         | `supported`   | 支持属性反射、类型收敛与 observer。                              |
| `data` / `setData`                               | `supported`   | 支持基础状态更新与重渲染。                                       |
| `methods` / `triggerEvent`                       | `supported`   | 支持事件触发与组件方法调用。                                     |
| `lifetimes`（`created/attached/ready/detached`） | `supported`   | 支持基础生命周期。                                               |
| `pageLifetimes`（`show/hide`）                   | `partial`     | 在页面显示/隐藏时分发到组件；`resize` 依赖浏览器环境。           |
| `behaviors`（递归合并）                          | `supported`   | 支持递归合并 `data/properties/methods/lifetimes/pageLifetimes`。 |
| `observerInit`                                   | `supported`   | 可配置初始化阶段 observer 触发策略。                             |
| `relations` / `externalClasses` 等               | `unsupported` | 当前未在 runtime `ComponentOptions` 中实现。                     |

## `wx` API 矩阵（Web bridge）

| API                                                                                                      | 状态          | 说明                                                                       |
| -------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------- |
| `wx.navigateTo`                                                                                          | `supported`   | 支持基础页面栈推进。                                                       |
| `wx.redirectTo`                                                                                          | `supported`   | 支持替换当前页面。                                                         |
| `wx.reLaunch`                                                                                            | `supported`   | 支持重建路由栈。                                                           |
| `wx.switchTab`                                                                                           | `partial`     | 当前行为等价于 `redirectTo`。                                              |
| `wx.navigateBack`                                                                                        | `supported`   | 支持 `delta` 回退。                                                        |
| `wx.setNavigationBarTitle`                                                                               | `partial`     | 依赖默认导航栏组件存在。                                                   |
| `wx.setNavigationBarColor`                                                                               | `partial`     | 依赖默认导航栏组件存在。                                                   |
| `wx.showNavigationBarLoading` / `hideNavigationBarLoading`                                               | `partial`     | 依赖默认导航栏组件存在。                                                   |
| `wx.showLoading` / `wx.hideLoading`                                                                      | `partial`     | 提供轻量 DOM loading 层，视觉行为为近似实现。                              |
| `wx.showModal`                                                                                           | `partial`     | 基于浏览器 `confirm/alert`，`confirmText/cancelText` 不生效。              |
| `wx.showToast`                                                                                           | `partial`     | 提供轻量 DOM toast，样式与真机不完全一致。                                 |
| `wx.setClipboardData` / `wx.getClipboardData`                                                            | `partial`     | 依赖浏览器剪贴板权限；失败时会回调 `fail`。                                |
| `wx.request`                                                                                             | `partial`     | 基于 `fetch` 桥接，支持常见 JSON/text 场景；上传下载与高级拦截能力未覆盖。 |
| `wx.setStorage` / `getStorage` / `removeStorage` / `clearStorage` / `getStorageInfo`                     | `partial`     | 基于内存 + `localStorage` 前缀桥接；与真机容量和隔离策略不完全一致。       |
| `wx.setStorageSync` / `getStorageSync` / `removeStorageSync` / `clearStorageSync` / `getStorageInfoSync` | `partial`     | 提供同步桥接，缺失 key 时 `getStorageSync` 返回空字符串。                  |
| `wx.getSystemInfoSync`                                                                                   | `partial`     | 基于浏览器环境推断，字段为近似值。                                         |
| `wx.canIUse`                                                                                             | `partial`     | 支持 API 级能力探测（`wx.xxx`）；复杂组件/样式规则探测未覆盖。             |
| `getCurrentPages` / `getApp`                                                                             | `supported`   | 提供基础桥接能力。                                                         |
| 其他常见 API（设备能力、文件、支付等）                                                                   | `unsupported` | 尚未内置桥接，需业务层自行兼容。                                           |

## 已知限制

1. Web 侧表达式与 WXS 执行依赖动态求值机制，行为与小程序引擎存在差异。
   如需更保守或更严格的行为，可通过 `weapp.web.pluginOptions.runtime.executionMode` 调整为 `safe` 或 `strict`。
2. 事件映射与组件标签映射优先覆盖高频场景，未承诺全量等价。
3. `analyze --platform h5` 目前仅支持 Web 静态配置分析（`weapp.web` 与 `executionMode`），不包含分包体积、源码映射和仪表盘能力。
4. 运行时告警已支持 `runtime.warnings.level` 与 `runtime.warnings.dedupe`，但当前可观测信息仍以控制台输出为主。

## 建议用法

1. 将 Web 运行时作为“开发期预览与调试层”，不要直接等价真机验收。
2. 新增 Web 能力时，同步更新本矩阵，并补齐单测/E2E 用例。
3. 需要查看 Web 侧静态分析时，可执行 `weapp-vite analyze --platform h5 --json`。
4. 若业务依赖 `unsupported` 能力，建议在业务侧提供平台分支与降级策略。
