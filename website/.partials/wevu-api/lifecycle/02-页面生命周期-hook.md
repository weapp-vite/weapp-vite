## 页面生命周期 Hook

### `onLoad()` {#onload}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onLoad']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page`
- 源码行为：注册到页面 `onLoad`。

### `onReady()` {#onready}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onReady']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page / Component`
- 源码行为：注册到 `onReady`；组件通过 `lifetimes.ready` 触发。

### `onUnload()` {#onunload}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onUnload']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page / Component`
- 源码行为：在页面 `onUnload` 或组件 teardown 时统一触发。
