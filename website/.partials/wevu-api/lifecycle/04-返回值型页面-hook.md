## 返回值型页面 Hook

### `onShareAppMessage()` {#onshareappmessage}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onShareAppMessage']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page`
- 源码行为：单实例 Hook（`single: true`），返回值用于分享配置。

### `onShareTimeline()` {#onsharetimeline}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onShareTimeline']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page`
- 源码行为：单实例 Hook（`single: true`），返回值用于朋友圈分享配置。

### `onAddToFavorites()` {#onaddtofavorites}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onAddToFavorites']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page`
- 源码行为：单实例 Hook（`single: true`），返回值用于收藏配置。

### `onSaveExitState()` {#onsaveexitstate}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onSaveExitState']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [生命周期共用示例](/wevu/api/lifecycle#lifecycle-examples)。

- 作用域：`Page`
- 源码行为：单实例 Hook（`single: true`），返回值用于退出状态保存。
