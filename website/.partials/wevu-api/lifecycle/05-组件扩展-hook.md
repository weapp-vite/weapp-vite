## 组件扩展 Hook

### `onAttached()` {#onattached}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onAttached']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Component`
- 源码行为：在组件 `lifetimes.attached` 阶段触发。

### `onDetached()` {#ondetached}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onDetached']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Component`
- 源码行为：在组件 `lifetimes.detached` 阶段触发。

### `onMoved()` {#onmoved}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onMoved']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Component`
- 源码行为：注册到 `lifetimes.moved`。
