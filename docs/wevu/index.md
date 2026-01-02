# wevu 文档索引（精要）

本目录聚焦 wevu 的核心理念、API 设计与使用方式，内容来自内部总结并对齐官方思路。建议按顺序阅读：

- 概览与理念
  - 介绍与定位：wevu 是什么、为何选择它 → 参见 wevu/intro.md
  - 快速上手：启动、构建与最佳实践 → 参见 wevu/quick-start.md
- 核心 API
  - 创建小程序：createApp → 参见 wevu/app.md
  - 定义页面：defineComponent（页面事件桥接与生命周期）→ 参见 wevu/page.md
  - 页面 hooks 对应表：Page hooks ↔ 原生 Page 回调 → 参见 wevu/page-hooks-mapping.md
  - 定义组件：defineComponent（props 响应性与生命周期）→ 参见 wevu/component.md
  - 页面组件：组件作为页面的生命周期整合 → 参见 wevu/page-component.md
  - 依赖注入：provide / inject 的用法与注意 → 参见 wevu/provide-inject.md
  - 状态管理：Store（wevu 适配）→ 参见 wevu.md
- 其他
  - 兼容性与性能 → 参见 wevu/compatibility.md 与 wevu/performance.md
  - 与其他方案的对比 → 参见 wevu/comparisons.md
  - 与 weapp-vite 集成建议 → 参见 wevu/weapp-vite.md

提示

- 所有示例仅涉及小程序逻辑（JS 层），模板/样式/配置保持原生写法。
- wevu 的 `setup()` 必须同步；在 `setup()` 中注册的生命周期需同步调用。
- 模板中使用的 `ref` 会自动解包，无需写 `.value`。
- 如果确需在 `setup()` 中访问实例（替代 `this`），请使用 `getCurrentInstance()`，并仅在同步阶段读取。
- `createApp/defineComponent` 在调用时会立即注册原生 `App()/Component()`（在微信中 `Component()` 可用于页面/组件）。
- 对于 `onPageScroll/onShareTimeline/...` 等“按需派发/按需展示”的页面事件，如你不想手写原生 `onXXX`，可用 `features` 开启注入（见 wevu/page.md）。
- `createApp` 支持 `app.use(plugin)` 安装插件，并可通过 `app.config.globalProperties` 注入全局属性（在 methods/computed/watch 中可作为实例属性读取；不会同步到模板数据）。

API 速览

```ts
import {
  computed,
  // 运行时
  createApp,
  defineComponent,
  // 响应式与工具
  getCurrentInstance,
  onError,
  onHide,
  // 生命周期钩子（示例）
  onLaunch,
  onPageNotFound,
  onPageScroll,
  onReady,
  onShow,
  onThemeChange,
  onUnhandledRejection,
  onUnload,
  reactive,
  readonly,
  ref,
  watch,
  watchEffect,
  // ...
} from 'wevu'
```
