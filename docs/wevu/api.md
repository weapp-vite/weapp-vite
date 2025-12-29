## API 总览

wevu 暴露的核心能力与入口如下，详细说明请参见对应文档：

- 运行时入口
  - `createApp`（创建小程序；支持 `app.use()`、`app.config.globalProperties`）→ 参见 wevu/app.md
  - `defineComponent`（定义组件/页面；页面使用 `type: 'page'`）→ 参见 wevu/component.md 与 wevu/page.md
- 生命周期注册（示例）
  - 应用：`onAppShow`、`onAppHide`、`onAppError` 等
  - 页面/页面组件：`onShow`、`onHide`、`onUnload`、`onReady`、`onPageScroll`、`onRouteDone`、`onTabItemTap`、`onSaveExitState` 等
- 响应式与工具
  - `ref`、`reactive`、`computed`、`watch`、`watchEffect`、`readonly`、`getCurrentInstance` 等
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
  onAppError,
  onAppHide, // 生命周期
  onAppShow,
  onHide,
  onPageScroll,
  onReady,
  onShow,
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
