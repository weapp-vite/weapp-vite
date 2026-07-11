## Store 类型

### `StoreManager` {#storemanager}

<!-- api-reference-details -->

**类型签名：**

```ts
interface StoreManager {
  install: (app: any) => void
  _stores: Map<string, any>
  use: (plugin: (context: { store: any }) => void) => StoreManager
  _plugins: Array<(context: { store: any }) => void>
}
```

**运行时说明：** 该类型用于约束 Store 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/store` 以 `import type` 导入。

**示例：** 见 [本组示例](/wevu/api/store#example-store-types)。

- 用途：store 根管理器类型。

### `DefineStoreOptions` {#definestoreoptions}

<!-- api-reference-details -->

**类型签名：**

```ts
interface DefineStoreOptions<
  S extends Record<string, any>,
  G extends GetterTree<S>,
  A extends Record<string, any>,
> {
  state: () => S
  getters?: G & Record<string, (state: S) => any> & ThisType<S & StoreGetters<G> & A>
  actions?: A & ThisType<S & StoreGetters<G> & A>
}
```

**运行时说明：** 该类型用于约束 Store 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/store` 以 `import type` 导入。

**示例：** 见 [本组示例](/wevu/api/store#example-store-types)。

- 用途：定义 option 风格 store 的类型约束。

### `StoreToRefsResult` {#storetorefsresult}

<!-- api-reference-details -->

**类型签名：**

```ts
type StoreToRefsResult<T extends Record<string, any>> = {
  [K in keyof T]:
  T[K] extends (...args: any[]) => any
    ? T[K]
    : T[K] extends Ref<infer V>
      ? Ref<V>
      : Ref<T[K]>
}
```

**运行时说明：** 该类型用于约束 Store 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/store` 以 `import type` 导入。

**示例：** 见 [本组示例](/wevu/api/store#example-store-types)。

- 用途：`storeToRefs()` 返回结果类型。

### `ActionContext` {#actioncontext}

<!-- api-reference-details -->

**类型签名：**

```ts
interface ActionContext<TStore = any> {
  name: string
  store: TStore
  args: any[]
  after: (cb: (result: any) => void) => void
  onError: (cb: (error: any) => void) => void
}
```

**运行时说明：** 该类型用于约束 Store 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/store` 以 `import type` 导入。

**示例：** 见 [本组示例](/wevu/api/store#example-store-types)。

- 用途：`$onAction` 回调上下文。

### `ActionSubscriber` {#actionsubscriber}

<!-- api-reference-details -->

**类型签名：**

```ts
interface ActionSubscriber<TStore = any> {
  (context: ActionContext<TStore>): void
}
```

**运行时说明：** 该类型用于约束 Store 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/store` 以 `import type` 导入。

**示例：** 见 [本组示例](/wevu/api/store#example-store-types)。

- 用途：action 订阅回调签名。

### `SubscriptionCallback` {#subscriptioncallback}

<!-- api-reference-details -->

**类型签名：**

```ts
interface SubscriptionCallback<S = any> {
  (mutation: { type: MutationType, storeId: string }, state: S): void
}
```

**运行时说明：** 该类型用于约束 Store 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/store` 以 `import type` 导入。

**示例：** 见 [本组示例](/wevu/api/store#example-store-types)。

- 用途：状态变更订阅回调签名。

### `StoreSubscribeOptions` {#storesubscribeoptions}

<!-- api-reference-details -->

**类型签名：**

```ts
interface StoreSubscribeOptions {
  /**
   * @description 是否在卸载后仍保留订阅（适用于跨页面生命周期的订阅）
   */
  detached?: boolean
}
```

**运行时说明：** 该类型用于约束 Store 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/store` 以 `import type` 导入。

**示例：** 见 [本组示例](/wevu/api/store#example-store-types)。

- 用途：`$subscribe` 的订阅选项类型。

### `MutationType` {#mutationtype}

<!-- api-reference-details -->

**类型签名：**

```ts
type MutationType = 'patch object' | 'patch function' | 'direct'
```

**运行时说明：** 该类型用于约束 Store 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/store` 以 `import type` 导入。

**示例：** 见 [本组示例](/wevu/api/store#example-store-types)。

- 用途：store mutation 类型（`'patch object' | 'patch function' | 'direct'`）。

### 本组示例 {#example-store-types}

公开类型适合约束插件、订阅器和 Action 观察工具。

```ts
import type { ActionSubscriber, StoreManager, SubscriptionCallback } from 'wevu'

const logMutation: SubscriptionCallback<{ count: number }> = (mutation, state) => {
  console.log(mutation.storeId, mutation.type, state.count)
}

const logAction: ActionSubscriber = ({ name, args }) => console.log(name, args)
declare const manager: StoreManager
manager.use(({ store }) => {
  store.$subscribe(logMutation)
  store.$onAction(logAction)
})
```
