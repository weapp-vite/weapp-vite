---
description: Wevu Store Manager 的安装、插件和时序差异说明。
keywords:
  - Wevu Store Manager
  - createStore
  - Store 插件
  - Pinia 迁移
---

## Store Manager API

### `app.use(manager)` {#storemanager-install}

<!-- api-reference-details -->

**类型签名：** `StoreManager['install']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** 支持 `app.use(pinia)`；小程序 app.vue 通过既有 `use(pinia)` 安装。

**示例：** 见 [本组示例](/wevu/api/store#example-store-manager)。

- 用途：向应用安装 Pinia。
- 差异：安装时注入并激活 Pinia，再应用排队的插件。

### `manager.use()` {#storemanager-use}

<!-- api-reference-details -->

**类型签名：** `StoreManager['use']`

**运行时说明：** 状态由 Wevu 响应式系统追踪，并随所属页面或组件的渲染批次同步；解构 state/getter 时必须使用 `storeToRefs()`。

**Vue/Pinia 差异：** API 心智接近 Pinia，但实现使用 Wevu 响应式与小程序实例作用域；不包含 Pinia devtools、SSR hydration 和完整插件生态。

**示例：** 见 [本组示例](/wevu/api/store#example-store-manager)。

- 用途：注册 Store 插件；每个新建 Store 会调用插件并传入 `{ store, pinia, app, options }`，可返回扩展属性。
- 返回值：当前 `StoreManager`，支持链式调用。

### 本组示例 {#example-store-manager}

每个 Pinia 持有独立 state、实例缓存和根作用域。插件只影响安装后新创建的 Store；`useStore(pinia)` 支持多实例隔离。

```ts
import { createApp, createStore, defineStore } from 'wevu'

const app = createApp({})
const manager = createStore()
manager.use(({ store }) => {
  console.log('created store', store.$id)
})
app.use(manager)

const useSession = defineStore('session', { state: () => ({ token: '' }) })
const session = useSession()
```
