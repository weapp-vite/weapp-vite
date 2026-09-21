## Store 实例 API

### `$id` {#store-id}

<!-- api-reference-details -->

**类型签名：** `ReturnType<ReturnType<typeof defineStore>>['$id']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [本组示例](/wevu/api/store#example-store-instance)。

- 用途：读取 `defineStore()` 声明的 Store 标识。
- 适用：Setup Store 与 Options Store。

### `$state` {#store-state}

<!-- api-reference-details -->

**类型签名：** `ReturnType<ReturnType<typeof defineStore>>['$state']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [本组示例](/wevu/api/store#example-store-instance)。

- 用途：读取或通过 function patch 合并响应式 state，维持已有响应式连接。
- 适用：Setup/Options Store 均支持；Setup state 不包含 computed/actions。

### `$patch()` {#store-patch}

<!-- api-reference-details -->

**类型签名：** `ReturnType<ReturnType<typeof defineStore>>['$patch']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [本组示例](/wevu/api/store#example-store-instance)。

- 用途：通过部分对象或回调函数批量修改状态。
- 订阅类型：分别触发 `patch object` 或 `patch function`。

### `$reset()` {#store-reset}

<!-- api-reference-details -->

**类型签名：** `ReturnType<ReturnType<typeof defineStore>>['$reset']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [本组示例](/wevu/api/store#example-store-instance)。

- 用途：Options Store 重新调用 state 工厂；Setup Store 返回自定义 `$reset`。
- 适用：未自定义的 Setup `$reset` 在开发模式报错、生产模式为空操作。

### `$subscribe()` {#store-subscribe}

<!-- api-reference-details -->

**类型签名：** `ReturnType<ReturnType<typeof defineStore>>['$subscribe']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [本组示例](/wevu/api/store#example-store-instance)。

- 用途：订阅 Store 状态变化，回调接收 mutation 信息和当前状态。
- 返回值：取消订阅函数。
- 选项：支持 watch 选项，默认异步，`flush: 'sync'` 同步。默认随注册作用域解绑，`{ detached: true }` 保留订阅。

### `$onAction()` {#store-onaction}

<!-- api-reference-details -->

**类型签名：** `ReturnType<ReturnType<typeof defineStore>>['$onAction']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [本组示例](/wevu/api/store#example-store-instance)。

- 用途：订阅 Action 调用，可通过 `after()` 和 `onError()` 监听成功结果或错误。第二个参数 `true` 脱离注册作用域；解绑/释放不会取消在途 action 已登记的结果回调。
- 返回值：取消订阅函数。

### 本组示例 {#example-store-instance}

实例 API 可以批量更新、重置并观察 mutation 与 Action 结果。

```ts
const stopState = counter.$subscribe((mutation, state) => {
  console.log(mutation.type, state.count)
})
const stopAction = counter.$onAction(({ name, after, onError }) => {
  after(result => console.log(name, result))
  onError(error => console.error(name, error))
})

counter.$patch({ count: 2 })
counter.$patch((state) => {
  state.count += 1
})
counter.$reset()
stopState()
stopAction()
```

### `$dispose()` {#store-dispose}

<!-- api-reference-details -->

**类型签名：** `() => void`

**运行时说明：** 停止 Store scope、清理订阅和实例缓存，保留 Pinia 状态。再次 useStore 创建新实例并复用状态。幂等释放，页面卸载不会自动销毁 Store。

**示例：** `store.$dispose()`；需全新状态再执行 `delete pinia.state.value[store.$id]`。
