## 页面事件 Hook

### `onPullDownRefresh()` {#onpulldownrefresh}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onPullDownRefresh']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page`
- 源码行为：注册到页面 `onPullDownRefresh`。

### `onReachBottom()` {#onreachbottom}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onReachBottom']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page`
- 源码行为：注册到页面 `onReachBottom`。

### `onPageScroll()` {#onpagescroll}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onPageScroll']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page`
- 源码行为：注册到页面 `onPageScroll`。

### `onRouteDone()` {#onroutedone}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onRouteDone']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page / Component`
- 源码行为：注册到 `onRouteDone`；组件通过 `pageLifetimes.routeDone` 桥接触发。

### `onTabItemTap()` {#ontabitemtap}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onTabItemTap']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page`
- 源码行为：注册到页面 `onTabItemTap`。

### `onResize()` {#onresize}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onResize']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page / Component`
- 源码行为：注册到 `onResize`；组件通过 `pageLifetimes.resize` 桥接触发。
