## Options Store 配置

### `state` {#options-state}

<!-- api-reference-details -->

**类型签名：** `DefineStoreOptions<State, Getters, Actions>['state']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [本组示例](/wevu/api/store#example-store-options)。

- 类型：`() => Record<string, any>`。
- 用途：返回每个 Store 的初始响应式状态。

### `getters` {#options-getters}

<!-- api-reference-details -->

**类型签名：** `DefineStoreOptions<State, Getters, Actions>['getters']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [本组示例](/wevu/api/store#example-store-options)。

- 用途：声明派生状态；getter 可接收 state，并可通过 `this` 访问 state、其他 getters 和 actions。

### `actions` {#options-actions}

<!-- api-reference-details -->

**类型签名：** `DefineStoreOptions<State, Getters, Actions>['actions']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [本组示例](/wevu/api/store#example-store-options)。

- 用途：声明 Store 方法；Action 内的 `this` 指向 Store 实例，并会触发 `$onAction()` 订阅。

### 本组示例 {#example-store-options}

Options Store 的 getter 和 Action 可通过 `this` 访问同一个 Store。

```ts
import { defineStore } from 'wevu'

export const useCart = defineStore('cart', {
  state: () => ({ count: 0, price: 20 }),
  getters: { total: state => state.count * state.price },
  actions: {
    add(quantity = 1) { this.count += quantity },
    clear() { this.count = 0 },
  },
})
```
