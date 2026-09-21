# Store 迁移指南

本文面向使用旧版 wevu Store 的小程序项目，对应 PR #1051 引入的 Pinia 风格 Store。此次按 **minor** 发布，但包含不兼容变化；升级依赖后仍须迁移旧代码。具体版本由发布流程生成，本文不预设版本号。未使用 Store 的项目不需要执行这些 Store 迁移步骤。

## 1. 先确认需要修改的地方

| 检查项 | 旧用法或假设 | 当前用法 |
| --- | --- | --- |
| 初始化 | 不初始化或只调用 `createStore()` | 应用安装 manager，或显式传入实例 |
| Setup 状态访问 | `store.count.value` | `store.count` |
| 解构 | 从 `storeToRefs()` 取 actions | state/getters 用 `storeToRefs()`，actions 从 Store 取 |
| 重置 | Setup 自动快照 `$reset()` | Setup 自行返回 `$reset`；Options 调用 state 工厂 |
| 订阅时机 | 直接修改后立即收到通知 | 默认异步，需要同步时设置 `flush: 'sync'` |
| 订阅清理 | 订阅默认永久保留 | 绑定注册作用域，卸载自动解绑；detached 手动管理 |
| 释放 | `$dispose()` 后重建得到初始值 | 状态保留；需要初始值时删除保存的 state 后重建 |
| 插件 | 创建 manager 后插件直接可用 | 安装 manager 后，对新创建的 Store 生效 |

先提交当前依赖锁文件及业务代码，再一起升级依赖、修改入口和 Store 消费者。不要全局替换 `.value`：Setup 内部、普通 ref 和 `storeToRefs()` 的结果仍使用 `.value`。

## 2. 在应用入口安装 manager

旧版可能只在入口调用 `createStore()`，甚至直接调用 `useCounter()`。现在 `createStore()` 仅创建独立实例，不会安装或激活它。

在 `app.vue` 中安装一次：

```vue
<script setup lang="ts">
import { createStore, use } from 'wevu'

use(createStore())
</script>
```

使用 `createApp()` 的入口改为：

```ts
import { createApp, createStore } from 'wevu'

const app = createApp({})
const pinia = createStore()
app.use(pinia)
// 继续执行项目原有的 app 注册流程
```

`use()` 只能在 app setup 中调用，不能放到普通模块顶层或页面 setup 中。`createPinia()` 是 `createStore()` 的兼容别名，新代码推荐使用 `createStore()`。没有安装、显式传参或活动实例时，调用 `useCounter()` 会报“没有活动的 Pinia”。

需要在组件外访问 Store 时，将同一个 manager 放在共享模块，入口负责安装；业务模块在调用时显式传参，避免导入模块时提前创建 Store：

```ts
// stores/manager.ts
import { createStore } from 'wevu'

export const pinia = createStore()
```

```vue
<!-- app.vue -->
<script setup lang="ts">
import { use } from 'wevu'
import { pinia } from './stores/manager'

use(pinia)
</script>
```

```ts
// services/counter.ts，在应用安装后调用
import { useCounter } from '../stores/counter'
import { pinia } from '../stores/manager'

export function incrementCounter() {
  useCounter(pinia).increment()
}
```

同一 manager 的同 ID Store 共享实例和状态。不要在各页面分别创建 manager，否则会得到相互隔离的状态。

## 3. 迁移状态访问与 actions 解构

下面的 `stores/counter.ts` 同时展示 Setup 状态和自定义重置，供后续示例复用：

```ts
import { computed, defineStore, ref } from 'wevu'

export const useCounter = defineStore('counter', () => {
  const count = ref(0)
  const doubled = computed(() => count.value * 2)
  function increment() {
    count.value++
  }
  function $reset() {
    count.value = 0
  }
  return { count, doubled, increment, $reset }
})
```

迁移前，Setup Store 外部使用 `store.count.value++`；迁移后，在已安装 manager 的页面/组件 setup 中这样使用：

```ts
import { storeToRefs } from 'wevu'
import { useCounter } from './stores/counter' // 按页面位置调整相对路径

const store = useCounter()
store.count++
console.log(store.doubled)

const { count, doubled } = storeToRefs(store)
const { increment } = store
count.value++
```

`storeToRefs()` 只提取响应式 state、getters 和插件响应式属性，不包含 actions、普通属性和管理 API；只读 getter 保持只读。直接解构 `const { count } = store` 会失去状态的响应式连接。向模板返回 refs 和 actions 即可。

## 4. 检查重置、patch 和 `$state`

旧版 Setup Store 自动生成的快照重置需要改为第 3 节这样的自定义 `$reset`。根据业务明确哪些字段恢复初始值；未提供时，开发模式调用会报错，生产模式为空操作。

Options Store 的 `$reset()` 重新执行 `state()` 工厂。Setup 和 Options 都有 `$state`；Setup 中只有返回的 ref/reactive 进入 state，computed 与 actions 不进入 state。

```ts
import { createStore, defineStore } from 'wevu'

const useProfile = defineStore('profile', {
  state: () => ({ profile: { name: 'Ada', age: 18 }, visits: 0, tags: ['old'] }),
})
const store = useProfile(createStore())

store.$patch({ profile: { age: 20 }, tags: ['new'] })
// profile.name 仍为 Ada；tags 整体替换
store.$patch((state) => {
  state.visits++
})
const state = store.$state
store.$state = { profile: { name: 'Lin', age: 21 }, visits: 2, tags: [] }
console.log(state === store.$state) // true
store.$reset() // 恢复 state 工厂返回的值
```

对象 `$patch` 深层合并普通对象、替换数组；函数 `$patch` 接收自动解包后的 state。`$state` 赋值通过 function patch 合并顶层字段，未提供的字段保留，不会整体替换 state 对象。不要把 `$state` 赋值当作清空旧字段的方法，也不要把它与对象 patch 的深层合并混为一谈。

## 5. 检查通知时机和订阅归属

旧代码若在直接写入后立即依赖订阅结果，应改为等待 `nextTick()`，或明确选择同步订阅。以下代码放在已安装 manager 的页面/组件 setup 中：

```ts
import { nextTick } from 'wevu'
import { useCounter } from './stores/counter' // 按页面位置调整相对路径

const store = useCounter()
const notifications: string[] = []
store.$subscribe(mutation => notifications.push(mutation.type))

async function incrementAndObserve() {
  store.count++
  await nextTick()
  console.log(notifications) // 首次调用时为 ['direct']
}

// 仅在业务确实需要同步响应时添加
const stopSync = store.$subscribe((_mutation, state) => {
  console.log(state.count)
}, { flush: 'sync' })
// 不再需要时调用 stopSync()
```

`$patch` 同步发布 `patch object` 或 `patch function`，对象 patch 带原始 payload；`$state` 赋值和 Options `$reset()` 发布 `patch function`。普通同步 watcher 仍逐次观察 patch 内写入，页面渲染和 `setData` 由小程序调度器合并。

显式 `batch()` 中每次 patch 保留自己的通知，批次结束后不会额外发布该批次的 `direct`。需要单独观察的直接修改放在批次外；默认异步订阅需等待 `nextTick()` 后恢复。

页面/组件 setup 中注册的普通 `$subscribe` 和 `$onAction` 随注册作用域卸载解绑，`onHide` 不解绑。不要为了保留共享状态把普通订阅全部改为 detached：共享 Store 本身不会随页面卸载销毁。

跨页面长驻监听可用 `$subscribe(callback, { detached: true })` 或 `$onAction(callback, true)`；保存返回的取消函数，在业务结束时手动取消。没有作用域的订阅同样需要手动清理。取消订阅和 `$dispose()` 不取消已经开始的 action 的 `after/onError`，业务请求的取消需自行处理。

## 6. 释放实例与恢复初始状态

旧代码若依赖释放后重建得到初始值，需要显式删除 manager 中保存的 state：

```ts
import { useCounter } from './stores/counter'
import { pinia } from './stores/manager'

const store = useCounter(pinia)
store.count = 7
store.$dispose()
const retained = useCounter(pinia)
console.log(retained.count) // 7

retained.$dispose()
delete pinia.state.value[useCounter.$id]
const fresh = useCounter(pinia)
console.log(fresh.count) // 0
```

`$dispose()` 停止 Store scope 和订阅、移除实例缓存，但保留 state。旧引用不会被冻结，也不会自动指向新实例；重建后应重新取得 Store 和 `storeToRefs()`。页面卸载通常只需清理页面自己的监听，不应销毁仍被其他页面使用的共享 Store。

测试应为每个用例创建独立 manager，并在结束后释放。复用第 3 节的 Store：

```ts
import { createStore, disposePinia, setActivePinia } from 'wevu'
import { useCounter } from './stores/counter'

const pinia = createStore()
setActivePinia(pinia)
try {
  const store = useCounter()
  store.increment()
  console.log(store.count) // 1
}
finally {
  disposePinia(pinia)
  setActivePinia(undefined)
}
```

`disposePinia()` 释放全部 Store 并清空状态，释放后的 manager 不再用于创建 Store。只需隔离状态的测试可以直接 `useCounter(pinia)`；验证插件时还须安装 manager。

## 7. 安装插件后再创建 Store

插件扩展可选，manager 初始化仍然必需。旧代码如果在 `createStore().use(plugin)` 后立即创建 Store，需要补上应用安装：

```ts
import { createApp, createStore, ref } from 'wevu'
import { useCounter } from './stores/counter'

const app = createApp({})
const pinia = createStore()
pinia.use(({ store }) => {
  store.$onAction(({ name }) => console.log(store.$id, name))
  return { lastUpdated: ref(0) }
})
app.use(pinia) // app.vue 中改为在 app setup 内 use(pinia)
const store = useCounter(pinia)
store.increment()
```

插件只作用于安装后新创建的 Store，不会追补已经缓存的实例。注册插件时应放在首次 Store 创建之前。插件中的扩展 ref 会自动解包，`storeToRefs()` 可提取其响应式属性。依赖 Vue Devtools、Web SSR 或 Vue 响应式内部对象的第三方插件不能假定直接运行。

## 8. 升级验收与回退

- 首次冷启动进入使用 Store 的页面，不出现“没有活动的 Pinia”；首屏 state/getters 正确。
- 页面 A 修改状态后进入页面 B，两页使用同一 manager，状态与 computed 一致。
- 页面隐藏不取消监听；卸载再进入后，普通监听没有重复通知，共享状态仍保留。
- 分别检查 Setup 自定义 `$reset`、Options 工厂重置、深层 patch 和数组替换的结果。
- 对直接修改、连续 patch、`$state` 赋值核对通知类型、次数和时机；默认异步场景等待 `nextTick()`。
- 验证 `$dispose()` 后重建保留值，删除 state 后重建恢复初始值；detached 监听能手动取消。
- 确认插件在首次创建前安装，并在目标小程序真实 runtime 中验证状态、渲染和生命周期；仅类型检查不能代替运行验证。

先运行项目自己的类型检查、构建和 Store 测试，再在目标小程序中完成上述路径。出现迁移问题时，将业务改动、依赖版本和锁文件一起回退到升级前提交，不要混用新运行时与旧 Store 消费方式。

完整 API 与支持边界见 [Store（状态管理）](./store.md)。
