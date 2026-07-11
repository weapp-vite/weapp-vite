## Store 实例 API

### `$id` {#store-id}

<!-- api-reference-details -->

**类型签名：** `ReturnType<ReturnType<typeof defineStore>>['$id']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [Store 实例共用示例](/wevu/api/store#store-examples)。

- 用途：读取 `defineStore()` 声明的 Store 标识。
- 适用：Setup Store 与 Options Store。

### `$state` {#store-state}

<!-- api-reference-details -->

**类型签名：** `ReturnType<ReturnType<typeof defineStore>>['$state']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [Store 实例共用示例](/wevu/api/store#store-examples)。

- 用途：读取或浅合并替换 Options Store 的响应式 state。
- 适用：仅 Options Store 的公共类型包含 `$state`；Setup Store 应直接使用 setup 返回的 state/ref。

### `$patch()` {#store-patch}

<!-- api-reference-details -->

**类型签名：** `ReturnType<ReturnType<typeof defineStore>>['$patch']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [Store 实例共用示例](/wevu/api/store#store-examples)。

- 用途：通过部分对象或回调函数批量修改状态。
- 订阅类型：分别触发 `patch object` 或 `patch function`。

### `$reset()` {#store-reset}

<!-- api-reference-details -->

**类型签名：** `ReturnType<ReturnType<typeof defineStore>>['$reset']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [Store 实例共用示例](/wevu/api/store#store-examples)。

- 用途：恢复 Store 创建时保存的初始状态快照。
- 适用：Setup Store 与 Options Store；Setup Store 中不可写的 computed/readonly ref 会被跳过。

### `$subscribe()` {#store-subscribe}

<!-- api-reference-details -->

**类型签名：** `ReturnType<ReturnType<typeof defineStore>>['$subscribe']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [Store 实例共用示例](/wevu/api/store#store-examples)。

- 用途：订阅 Store 状态变化，回调接收 mutation 信息和当前状态。
- 返回值：取消订阅函数。
- 选项：支持 `{ detached: true }`，用于跨页面生命周期保留订阅。

### `$onAction()` {#store-onaction}

<!-- api-reference-details -->

**类型签名：** `ReturnType<ReturnType<typeof defineStore>>['$onAction']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [Store 实例共用示例](/wevu/api/store#store-examples)。

- 用途：订阅 Action 调用，可通过 `after()` 和 `onError()` 监听成功结果或错误。
- 返回值：取消订阅函数。
