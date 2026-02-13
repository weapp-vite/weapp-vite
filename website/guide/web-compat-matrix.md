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

| API                                                                                                      | 状态          | 说明                                                                                                    |
| -------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| `wx.navigateTo`                                                                                          | `supported`   | 支持基础页面栈推进。                                                                                    |
| `wx.redirectTo`                                                                                          | `supported`   | 支持替换当前页面。                                                                                      |
| `wx.reLaunch`                                                                                            | `supported`   | 支持重建路由栈。                                                                                        |
| `wx.switchTab`                                                                                           | `partial`     | 当前行为等价于 `redirectTo`。                                                                           |
| `wx.navigateBack`                                                                                        | `supported`   | 支持 `delta` 回退。                                                                                     |
| `wx.setNavigationBarTitle`                                                                               | `partial`     | 依赖默认导航栏组件存在。                                                                                |
| `wx.setNavigationBarColor`                                                                               | `partial`     | 依赖默认导航栏组件存在。                                                                                |
| `wx.showNavigationBarLoading` / `hideNavigationBarLoading`                                               | `partial`     | 依赖默认导航栏组件存在。                                                                                |
| `wx.showLoading` / `wx.hideLoading`                                                                      | `partial`     | 提供轻量 DOM loading 层，视觉行为为近似实现。                                                           |
| `wx.nextTick`                                                                                            | `partial`     | 基于微任务队列调度回调，时序近似小程序行为。                                                            |
| `wx.showModal`                                                                                           | `partial`     | 基于浏览器 `confirm/alert`，`confirmText/cancelText` 不生效。                                           |
| `wx.showToast`                                                                                           | `partial`     | 提供轻量 DOM toast，样式与真机不完全一致。                                                              |
| `wx.stopPullDownRefresh`                                                                                 | `partial`     | Web 侧作为 no-op 成功桥接，便于兼容下拉刷新调用链。                                                     |
| `wx.pageScrollTo`                                                                                        | `partial`     | 支持 `scrollTop/duration` 的基础滚动，`selector` 等高级能力未覆盖。                                     |
| `wx.createCanvasContext`                                                                                 | `partial`     | 基于浏览器 2D Canvas 上下文桥接高频绘制命令，绘图状态与高级 API 未全量覆盖。                            |
| `wx.createWorker`                                                                                        | `partial`     | 基于浏览器 Worker 桥接消息收发与错误监听（`postMessage/onMessage/onError`），线程模型与真机不完全一致。 |
| `wx.createSelectorQuery`                                                                                 | `partial`     | 支持 `in/select/selectAll/selectViewport` 与 `boundingClientRect/scrollOffset/fields/node` 高频子集。   |
| `wx.setClipboardData` / `wx.getClipboardData`                                                            | `partial`     | 依赖浏览器剪贴板权限；失败时会回调 `fail`。                                                             |
| `wx.request`                                                                                             | `partial`     | 基于 `fetch` 桥接，支持常见 JSON/text 场景；上传下载与高级拦截能力未覆盖。                              |
| `wx.downloadFile`                                                                                        | `partial`     | 基于 `fetch` + `Blob URL` 桥接，返回临时 URL；文件系统语义与真机不一致。                                |
| `wx.chooseImage`                                                                                         | `partial`     | 优先使用 `showOpenFilePicker`，降级到文件输入框选择；结果为浏览器临时 URL。                             |
| `wx.previewImage`                                                                                        | `partial`     | 使用浏览器 `window.open` 预览图片，依赖浏览器弹窗策略。                                                 |
| `wx.login` / `wx.getAccountInfoSync`                                                                     | `partial`     | 提供 Web 环境下的占位登录码与账号信息，用于调试链路，不等价真实登录态。                                 |
| `wx.showShareMenu` / `wx.updateShareMenu`                                                                | `partial`     | 提供 API 级成功回调桥接，不覆盖平台级分享能力差异。                                                     |
| `wx.getExtConfigSync` / `wx.getExtConfig`                                                                | `partial`     | 返回 Web runtime 注入的扩展配置快照（默认空对象）。                                                     |
| `wx.reportAnalytics`                                                                                     | `partial`     | 在运行时内存中记录事件用于调试，不会真实上报到微信数据分析后台。                                        |
| `wx.navigateToMiniProgram` / `wx.exitMiniProgram`                                                        | `partial`     | 提供 API 级桥接用于流程调试，不执行真实小程序容器跳转/退出。                                            |
| `wx.openCustomerServiceChat`                                                                             | `partial`     | 可选地通过浏览器打开客服链接，企业微信会话能力不等价。                                                  |
| `wx.requestPayment`                                                                                      | `partial`     | 仅提供成功回调级占位桥接，不涉及真实支付签名与交易流程。                                                |
| `wx.createRewardedVideoAd` / `wx.createInterstitialAd`                                                   | `partial`     | 提供广告对象生命周期桥接（`load/show/onError/onClose`），不触发真实广告网络与平台策略。                 |
| `wx.getNetworkType` / `wx.onNetworkStatusChange` / `wx.offNetworkStatusChange`                           | `partial`     | 基于 `navigator.onLine` 与浏览器网络事件，网络类型为近似值。                                            |
| `wx.getLocation`                                                                                         | `partial`     | 基于浏览器 Geolocation API 桥接，坐标与精度字段受浏览器权限策略影响。                                   |
| `wx.vibrateShort`                                                                                        | `partial`     | 通过浏览器 `navigator.vibrate` 触发短振动，实际效果受设备与权限限制。                                   |
| `wx.getBatteryInfo` / `wx.getBatteryInfoSync`                                                            | `partial`     | 优先读取浏览器 Battery API，缺失时回退到缓存近似值。                                                    |
| `wx.getFileSystemManager`                                                                                | `partial`     | 提供基于内存的文件读写桥接（`writeFile/readFile` 及 sync 版本），用于开发调试，不等价真机沙箱文件系统。 |
| `wx.setStorage` / `getStorage` / `removeStorage` / `clearStorage` / `getStorageInfo`                     | `partial`     | 基于内存 + `localStorage` 前缀桥接；与真机容量和隔离策略不完全一致。                                    |
| `wx.setStorageSync` / `getStorageSync` / `removeStorageSync` / `clearStorageSync` / `getStorageInfoSync` | `partial`     | 提供同步桥接，缺失 key 时 `getStorageSync` 返回空字符串。                                               |
| `wx.getSystemInfo` / `wx.getSystemInfoSync` / `wx.getWindowInfo`                                         | `partial`     | 基于浏览器环境推断，字段为近似值。                                                                      |
| `wx.getDeviceInfo` / `wx.getSystemSetting` / `wx.getAppAuthorizeSetting`                                 | `partial`     | 返回浏览器可推断字段与默认授权状态（多数字段为近似/占位值）。                                           |
| `wx.getAppBaseInfo`                                                                                      | `partial`     | 提供浏览器环境下的基础信息近似值（语言、主题、平台等）。                                                |
| `wx.getMenuButtonBoundingClientRect`                                                                     | `partial`     | 返回基于窗口尺寸的启发式胶囊按钮区域，不保证与真机一致。                                                |
| `wx.getLaunchOptionsSync` / `wx.getEnterOptionsSync`                                                     | `partial`     | 返回基于当前 Web runtime 路由推断的启动参数快照。                                                       |
| `wx.canIUse`                                                                                             | `partial`     | 支持 API 级能力探测（`wx.xxx`）；复杂组件/样式规则探测未覆盖。                                          |
| `getCurrentPages` / `getApp`                                                                             | `supported`   | 提供基础桥接能力。                                                                                      |
| 其他常见 API（多媒体高级能力等）                                                                         | `unsupported` | 尚未内置桥接，需业务层自行兼容。                                                                        |

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
