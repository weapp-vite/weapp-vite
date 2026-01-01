## API 总览

wevu 暴露的核心能力与入口如下，详细说明请参见对应文档：

- 运行时入口
  - `createApp`（创建小程序；支持 `app.use()`、`app.config.globalProperties`）→ 参见 wevu/app.md
  - `defineComponent`（定义组件/页面；统一通过小程序 `Component()` 注册）→ 参见 wevu/component.md 与 wevu/page.md
- 生命周期注册（示例）
  - 应用：`onAppShow`、`onAppHide`、`onAppError` 等
  - 页面/页面组件：`onLoad`、`onShow`、`onHide`、`onUnload`、`onReady`、`onPullDownRefresh`、`onReachBottom`、`onPageScroll`、`onRouteDone`、`onResize`、`onTabItemTap`、`onShareAppMessage`、`onShareTimeline`、`onAddToFavorites`、`onSaveExitState` 等
- 响应式与工具
  - `ref`、`reactive`、`computed`、`watch`、`watchEffect`、`readonly`、`getCurrentInstance` 等
- Vue `<script setup>` 兼容（用于承接 Vue SFC 编译产物）
  - `useAttrs`、`useSlots`、`useModel`、`mergeModels`
- 依赖注入
  - `provide`、`inject` → 参见 wevu/provide-inject.md
- 状态管理（Store 适配）
  - `createStore`、`defineStore`、`storeToRefs`（主入口导出）→ 参见 Store 章节

导入示例

```ts
import {
  computed, // 运行时
  createApp,
  createStore,
  defineComponent,
  defineStore,
  getCurrentInstance,
  inject,
  onAddToFavorites,
  onAppError,
  onAppHide, // 生命周期
  onAppShow,
  onHide,
  onLoad,
  onPageScroll,
  onPullDownRefresh,
  onReachBottom,
  onReady,
  onResize,
  onRouteDone,
  onSaveExitState,
  onShareAppMessage,
  onShareTimeline,
  onShow,
  onTabItemTap,
  onUnload, // 注入
  provide,
  reactive,
  readonly, // 响应式与工具
  ref,
  storeToRefs,
  watch,
  watchEffect
} from 'wevu'
```

提示

- 对于 `onPageScroll/onPullDownRefresh/onReachBottom/onShareTimeline/...` 等“按需派发”的页面事件：若你没有显式定义对应原生 `onXXX` 方法，可通过 `features` 开启注入（见 `docs/wevu/page.md` 与 `docs/wevu/page-hooks-mapping.md`）。

## Vue `<script setup>` 兼容 API

这些 API 的目标是：让 Vue SFC 编译器在 `<script setup>` 下生成的部分运行时代码（例如 `defineModel/defineSlots` 的产物）可以在 `wevu` 中运行。

### `useAttrs()`

- 返回 `setup(_, ctx)` 中的 `ctx.attrs`
- 小程序场景兜底为空对象 `{}`（目前不提供类似 Vue 的 attrs 语义）

### `useSlots()`

- 返回 `setup(_, ctx)` 中的 `ctx.slots`
- 小程序场景兜底为空对象（目前不提供 VDOM slots 语义）

### `useModel(props, name)`

- 返回一个 `ref`：读取时取 `props[name]`，写入时触发 `emit(\`update:${name}\`, value)`
- 主要用于承接 `defineModel()` 的编译产物

### `mergeModels(a, b)`

- 用于承接 Vue SFC 编译器的合并逻辑（对象浅合并、数组去重合并）
