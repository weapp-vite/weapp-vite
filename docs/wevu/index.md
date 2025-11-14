# wevu 文档索引（精要）

本目录聚焦 wevu 的核心理念、API 设计与使用方式，内容来自内部总结并对齐官方思路。建议按顺序阅读：

- 概览与理念
  - 介绍与定位：wevu 是什么、为何选择它 → 参见 wevu/intro.md
  - 快速上手：启动、构建与最佳实践 → 参见 wevu/quick-start.md
- 核心 API
  - 创建小程序：createApp → 参见 wevu/app.md
  - 定义页面：definePage（含滚动/分享等能力声明）→ 参见 wevu/page.md
  - 定义组件：defineComponent（props 响应性与生命周期）→ 参见 wevu/component.md
  - 页面组件：组件作为页面的生命周期整合 → 参见 wevu/page-component.md
  - 依赖注入：provide / inject 的用法与注意 → 参见 wevu/provide-inject.md
  - 状态管理：Store（wevu 适配）→ 参见 wevu/store.md
- 其他
  - 兼容性与性能 → 参见 wevu/compatibility.md 与 wevu/performance.md
  - 与其他方案的对比 → 参见 wevu/comparisons.md
  - 与 weapp-vite 集成建议 → 参见 wevu/weapp-vite.md

提示

- 所有示例仅涉及小程序逻辑（JS 层），模板/样式/配置保持原生写法。
- wevu 的 `setup()` 必须同步；在 `setup()` 中注册的生命周期需同步调用。
- 模板中使用的 `ref` 会自动解包，无需写 `.value`。
- 如果确需在 `setup()` 中访问实例（替代 `this`），请使用 `getCurrentInstance()`，并仅在同步阶段读取。
- 所有 `createApp/definePage/defineComponent` 都返回“可挂载实例”；必须手动调用 `.mount()` 才会真正调用原生 `App()/Page()/Component()`。支持同一文件多次定义，只挂载一次即可避免原生“同文件重复构造函数调用”的限制。
- `createApp` 支持 `app.use(plugin)` 安装插件，并可通过 `app.config.globalProperties` 注入全局属性（在 methods/computed/watch 中可作为实例属性读取；不会同步到模板数据）。

API 速览

```ts
import {
  computed,
  // 运行时
  createApp,
  defineComponent,
  // 响应式与工具
  definePage,
  getCurrentInstance,
  onAppError,
  onAppHide, // 生命周期钩子（示例）
  onAppShow,
  onHide,
  onPageScroll,
  onReady,
  onShow,
  onUnload,
  reactive,
  readonly,
  ref,
  watch,
  watchEffect,
  // ...
} from 'wevu'
```
