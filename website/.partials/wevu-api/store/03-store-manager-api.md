## Store Manager API

### `manager.install()` {#storemanager-install}

<!-- api-reference-details -->

**类型签名：** `StoreManager['install']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** Pinia 通过 `app.use(pinia)` 注入 Vue App；Wevu 小程序没有同等插件挂载阶段，`install()` 仅保留兼容入口。

**示例：** 见 [Store Manager共用示例](/wevu/api/store#store-examples)。

- 用途：保留与插件安装心智一致的接口。
- 差异：小程序环境不需要注册全局插件入口，当前实现不执行额外逻辑。

### `manager.use()` {#storemanager-use}

<!-- api-reference-details -->

**类型签名：** `StoreManager['use']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [Store Manager共用示例](/wevu/api/store#store-examples)。

- 用途：注册 Store 插件；每个新建 Store 会调用插件并传入 `{ store }`。
- 返回值：当前 `StoreManager`，支持链式调用。
