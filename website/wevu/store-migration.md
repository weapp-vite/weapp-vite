---
title: Store 迁移指南
description: 将旧版 wevu Store 迁移到 Pinia 风格 Store，逐项检查初始化、状态解包、重置、订阅、插件和生命周期变化。
keywords:
  - wevu
  - Store
  - 迁移
  - Pinia
---

# Store 迁移指南

本文比较 [PR #1051 合并前的 `9a8ca79e`](https://github.com/weapp-vite/weapp-vite/tree/9a8ca79e9aeb2eb0c0c95e118dfbea0be9d3d6d4/packages-runtime/wevu/src/store) 与本 PR 最终实现，面向已经使用 wevu Store 的项目。这里的“PR 前”不是上游 Pinia，也不是此前文档承诺的行为，而是该提交实际可运行的 Store 实现。

本次按 **minor** 发布，版本由发布流程计算；**旧 Store 消费者仍需迁移**。新代码推荐 `createPinia()`，以 Pinia **4.0.3** 的命名和主要公开用法为参照。小程序仍从 `wevu` 或 `wevu/store` 导入，不改成 `pinia`。Store 使用 wevu 响应式与小程序调度，不承诺兼容上游全部能力、Web SSR、Pinia HMR、Vue Devtools 或所有第三方插件。

`createStore()`、`StoreManager` 和已有公开 API 名称继续保留。`createStore === createPinia`，返回类型一致，不新增弃用警告。既有项目无需仅为改名而批量修改；保留名称并不恢复旧版隐式初始化、外部 ref 或自动快照重置行为。

## 1. 迁移范围与顺序

| 分类 | 检查内容 | 操作 |
| --- | --- | --- |
| 必改 | 无 manager / 只调用 `createStore()` | 安装同一实例，组件外显式传参，测试隔离实例 |
| 必改（Setup 消费者） | 外部 `store.field.value`、从 `storeToRefs` 取 actions | 外部解包访问，actions 从 Store 解构 |
| 条件迁移 | 使用 Setup `$reset`、Options 动态初值或额外字段 | Setup 自定义重置；Options 检查工厂与字段保留 |
| 条件迁移 | 嵌套 patch、同步订阅、持久化、插件、显式泛型 | 按第 5–8 节检查数据形状、通知及异常 |
| 新增能力 | 状态树、释放与活动实例 API | 按需采用；不能假设旧版已有相同行为 |

建议先保存升级前可运行的代码、依赖与锁文件，再依次修改入口、Store 定义、页面与服务消费者、插件和测试。没有使用 Store 的项目不需要执行这些 Store 迁移步骤。不要全局删除 `.value`。

## 2. 初始化与实例共享（必改）

**PR 前行为：** `useStore()` 可以在没有 manager 时调用。`createStore()` 会保存隐式 manager，`defineStore()` 在**定义时**捕获它；`install()` 不承担实际注入。每个 `defineStore()` 返回函数在闭包中缓存一个实例，manager 不能用于隔离同一定义。

**PR 后行为：** 创建 manager 不会激活它。`useStore(pinia)` 优先选择显式实例，否则读取应用注入或活动实例；都没有时抛错。实例按 **manager + Store ID** 缓存，同一个 manager 中相同 ID 复用实例，不同 manager 相互隔离。不要在每个页面重新创建 manager，也不要给不同 Store 重复使用同一个 ID。

改前（普通模块中可直接调用）：

```ts
import { defineStore, ref } from 'wevu'

const useCounter = defineStore('counter', () => ({ count: ref(0) }))
const counter = useCounter()
counter.count.value++
```

改后，共享实例单独放在模块中：

```ts
// stores/manager.ts
import { createPinia } from 'wevu'

export const pinia = createPinia()
```

```vue
<!-- app.vue -->
<script setup lang="ts">
import { use } from 'wevu'
import { pinia } from './stores/manager'

use(pinia)
</script>
```

`use()` 只能在 **app setup** 中调用，不能放在普通模块顶层或页面 setup 中。使用 `createApp()` 的入口采用下面的安装方式，并保留项目原有的应用注册流程：

```ts
import { createApp } from 'wevu'
import { pinia } from './stores/manager'

const app = createApp({})
app.use(pinia)
```

组件外使用同一个实例，在业务函数内取得 Store，避免 import 时早于插件安装创建实例：

```ts
// services/counter.ts，在应用安装完成后调用
import { useCounter } from '../stores/counter'
import { pinia } from '../stores/manager'

export function incrementCounter() {
  useCounter(pinia).increment()
}
```

旧名称仍有效，以下是**迁移后**保留 `createStore()` 的写法：

```ts
import { createApp, createPinia, createStore, defineStore } from 'wevu'

console.log(createStore === createPinia) // true
const manager = createStore()
const app = createApp({})
app.use(manager)
const useCounter = defineStore('counter', { state: () => ({ count: 0 }) })
const counter = useCounter(manager)
```

**验证结果：** 安装后页面 `useCounter()` 与服务 `useCounter(pinia)` 返回同一个实例。单独 `createPinia()` 后且无其他活动实例时，省略参数调用仍应报错。测试中使用独立 `createPinia()` 并显式传参；需要覆盖隐式调用时使用新增的 `setActivePinia()`，结束后清理（见第 10 节）。插件须先注册，再安装 manager，最后创建 Store（见第 8 节）。

## 3. Setup 状态访问（必改）

**PR 前行为：** Setup 返回的 ref/computed 原样暴露，外部也用 `.value`。普通返回属性可以赋值，其直接赋值也会触发旧订阅，但不等于 ref/reactive 状态。

**PR 后行为：** Store 边界自动解包 ref/computed；Setup 内部的 ref 和 `storeToRefs()` 返回值仍用 `.value`。仅返回的 ref/reactive 状态进入 `$state`；computed、actions、普通属性不进入状态树。普通属性不会被 `storeToRefs()` 提取，也不能依赖 `$subscribe`、patch 或持久化自动处理它。

Store 定义的内部代码不需要去掉 `.value`：

```ts
import { computed, defineStore, ref } from 'wevu'

export const useCounter = defineStore('counter', () => {
  const count = ref(0)
  const doubled = computed(() => count.value * 2)
  function increment() {
    count.value++
  }
  return { count, doubled, increment, label: 'counter' }
})
```

改前：

```ts
const store = useCounter()
store.count.value++
console.log(store.doubled.value) // 2
```

改后（已安装应用，或显式传入 manager）：

```ts
const store = useCounter(pinia)
store.count++
console.log(store.doubled) // 2
const { count } = storeToRefs(store)
count.value++
```

如果旧定义返回 `visits: 0` 并依赖订阅保存它，应改成 `visits: ref(0)`。`shallowRef` 和 `shallowReactive` 的浅层边界仍保留，不会因为 Store 自动解包而把内部对象变成深层响应式。

**验证结果：** 首次 `increment()` 后外部 `store.count === 1`、`store.doubled === 2`；`storeToRefs(store).count.value === 1`。`Object.keys(store.$state)` 只有 `count`，没有 `doubled`、`increment`、`label`。

## 4. 解构 state、getters 与 actions（必改）

**PR 前行为：** `storeToRefs()` 遍历可枚举属性，除状态外也透传 actions，并为部分普通属性创建可写 computed。

**PR 后行为：** 只提取响应式 state/getters/插件属性，排除 actions、普通属性和管理 API；只读 getter 保持只读。

改前（沿用第 3 节定义）：

```ts
const store = useCounter()
const { count, doubled, increment } = storeToRefs(store)
increment()
console.log(count.value, doubled.value) // 1, 2
```

改后：

```ts
const store = useCounter(pinia)
const { count, doubled } = storeToRefs(store)
const { increment } = store
increment()
console.log(count.value, doubled.value) // 1, 2
```

**验证结果：** actions 解构后仍可调用；`storeToRefs(store)` 中没有 `increment` 和 `label`。不要用 `const { count } = store` 替代 `storeToRefs()`，否则得到当时的数值，后续更新不会同步到该变量。

## 5. 重置策略（使用 `$reset` 时迁移）

### 5.1 Setup：从自动快照改为自定义 `$reset`

**PR 前行为：** 框架自动记录初始快照并重置；Setup 返回的同名 `$reset` 会被基础 API 覆盖。

**PR 后行为：** Setup 必须自行返回 `$reset`，按业务决定哪些字段重置、是否重新读配置、是否取消请求。没有提供时，开发模式调用抛错，生产模式为空操作。

改前：

```ts
const useCounter = defineStore('counter', () => ({ count: ref(0) }))
const store = useCounter()
store.count.value = 5
store.$reset()
console.log(store.count.value) // 0
```

改后：

```ts
const useCounter = defineStore('counter', () => {
  const count = ref(0)
  function $reset() {
    count.value = 0
  }
  return { count, $reset }
})
const store = useCounter(pinia)
store.count = 5
store.$reset()
console.log(store.count) // 0
```

**验证结果：** 数值恢复为 `0`。自定义 `$reset` 是 action，内部直接写 ref 按直接修改通知，不会自动产生旧版的 `patch object`；若业务要求一次补丁通知，可在调用处使用 `store.$patch(() => store.$reset())`。

### 5.2 Options：从首次快照改为重新调用工厂

**PR 前行为：** `$reset()` 恢复首次创建时的深拷贝快照，并删除后来加到 state 的额外字段。

**PR 后行为：** 每次 `$reset()` 重跑 `state()` 工厂，把结果合并到已有 state。工厂未返回的额外字段**仍然保留**，不是清空整个状态对象。

下列定义两版都有效：

```ts
const initialCount = 1
const useCounter = defineStore('counter', {
  state: (): { count: number, extra?: string } => ({ count: initialCount }),
})
```

改前：

```ts
const store = useCounter()
store.$state.extra = 'temporary'
initialCount = 10
store.$reset()
console.log(store.count, store.$state.extra) // 1, undefined
```

改后：

```ts
const store = useCounter(pinia)
store.$state.extra = 'temporary'
initialCount = 10
store.$reset()
console.log(store.count, store.$state.extra) // 10, 'temporary'
// 如果业务要求删除额外字段，再显式清理。
store.$patch((state) => {
  delete state.extra
})
```

**验证结果：** 新工厂初值为 `10`，显式删除后 `extra` 不存在。上面 reset 和清理各发布一次 patch 通知；若必须恰好一次，应在一个函数 patch 内直接赋工厂结果并删除额外字段，避免再调用 `$reset()`。时间、用户配置、随机值等动态初值都要重新检查。

## 6. `$state` 和 patch（使用补丁或持久化时迁移）

**PR 前行为：** Options 有 `$state`；Setup 的 `$state` 在运行时为 `undefined`，旧公开 Setup 类型也未提供它。旧 Setup `$patch` 的目标并非返回的状态，不能用它作为成功更新 Setup 状态的迁移前示例。

**PR 后行为：** 两种 Store 都有 `$state`，manager 通过 `pinia.state.value[id]` 持有状态。Setup 的订阅第二参数也是这个解包后的状态，而不再是包含 ref/actions 的旧实例对象。

改前（Setup 使用真实可用的直接赋值）：

```ts
const store = useCounter()
store.count.value = 2
store.$subscribe((_mutation, state) => console.log(state.count.value))
```

改后：

```ts
const store = useCounter(pinia)
store.$patch({ count: 2 })
console.log(store.$state.count) // 2
store.$subscribe((_mutation, state) => console.log(state.count))
```

Options 对象 patch 从**浅合并**变为**普通对象深合并**；数组整体替换。两版均可使用下面的定义：

```ts
const useProfile = defineStore('profile', {
  state: (): { profile: { name?: string, age: number }, tags: string[], visits: number } => ({
    profile: { name: 'Ada', age: 18 },
    tags: ['old'],
    visits: 0,
  }),
})
```

改前：

```ts
const store = useProfile()
store.$patch({ profile: { age: 20 }, tags: ['new'] })
console.log(store.profile.name, store.tags) // undefined, ['new']
```

改后：

```ts
const store = useProfile(pinia)
store.$patch({ profile: { age: 20 }, tags: ['new'] })
console.log(store.profile.name, store.tags) // 'Ada', ['new']
// 原业务若需要替换整个嵌套对象，用函数 patch 明确赋值。
store.$patch(state => state.profile = { age: 21 })
console.log(store.profile.name) // undefined
```

两版 Options 的 `$state = value` 都保留原状态对象连接并合并顶层字段，**不会**清除省略字段；新版也不是深层 patch：

```ts
const state = store.$state
store.$state = { profile: { age: 22 }, tags: [], visits: 2 }
console.log(store.$state === state) // true
console.log(store.profile.name) // undefined
```

**验证结果：** 对象 patch 保留 `profile.name`，数组只剩新元素；函数赋值可替换整个 `profile`，`$state` 对象身份不变。持久化仅保存 state，不把整个 Store（含方法、getter、插件服务）直接序列化。

## 7. 通知与生命周期（使用监听时迁移）

**PR 前行为：** 直接修改同步通知；普通订阅没有随页面作用域解绑，`detached` 选项没有实际区分。Options reset / `$state` 赋值通知为 `patch object`；嵌套 patch 合并为外层一次通知。

**PR 后行为：** 直接修改默认异步，需 `flush: 'sync'` 才同步；显式 patch 仍同步发布。注册在页面/组件 setup 作用域中的普通 `$subscribe`、`$onAction` 随卸载解绑，`onHide` 不解绑，共享 Store 仍保留。

改前（Options Store）：

```ts
const store = useProfile()
const events: string[] = []
const stop = store.$subscribe(mutation => events.push(mutation.type))
store.visits++
console.log(events) // ['direct']
// 页面卸载时需要手动 stop()
```

改后，默认异步：

```ts
const store = useProfile(pinia)
const events: string[] = []
const stop = store.$subscribe(mutation => events.push(mutation.type))
store.visits++
console.log(events) // []
await nextTick()
console.log(events) // ['direct']
stop()
```

需要同步的业务显式选择：

```ts
const stop = store.$subscribe((_mutation, state) => {
  console.log(state.visits)
}, { flush: 'sync' })
```

| 单独执行的操作 | PR 前 | PR 后 |
| --- | --- | --- |
| 直接修改一次 | 同步一次 `direct` | 默认异步一次 `direct`；sync 同步一次 |
| 连续直接修改两次 | 两次同步通知 | 同轮默认订阅通常合并；sync 逐次通知 |
| 对象 `$patch` | 一次 `patch object` | 一次 `patch object`，额外携带原始 payload |
| 函数 `$patch` | 一次 `patch function` | 一次 `patch function` |
| Options `$reset()` / `$state = ...` | 一次 `patch object` | 一次 `patch function` |
| Setup 自定义 `$reset()` | 同名函数被自动 reset 覆盖 | 按实现的写入方式通知，且作为 action 被监听 |
| 嵌套 patch | 合并为外层一次 | 每次 patch 保留独立通知 |

嵌套通知可用以下 Options 例子核对，两版操作相同，仅初始化不同：

```ts
store.$patch((state) => {
  state.visits = 1
  store.$patch({ visits: 2 })
  state.visits = 3
})
```

**验证结果：** PR 前只有外层 `patch function`；PR 后默认订阅依次收到 `patch object`、`patch function`。sync 订阅还会在内层 patch 恢复监听后观察最后的写入，顺序为 `patch object`、`direct`、`patch function`。等待 `nextTick()` 不应再冒出重复的 patch 来源 `direct`。

普通同步 `watch` / effect 会逐次看到 patch 内写入，不再依赖旧 patch 的 batch 合并。显式 `batch()` 中每次 patch 仍保留通知，批次结束不额外补发该批次的 direct；需要单独观察的直接修改放到批次外。默认异步订阅在 patch 后需要等待 `nextTick()` 恢复监听，不应把紧跟 patch 的直接写入当成必然有独立通知。`nextTick()` 只等待 JavaScript 调度，不代表小程序视图已提交。

跨页面长驻监听使用 detached，并保存取消函数：

```ts
const stopState = store.$subscribe(saveState, { detached: true })
const stopAction = store.$onAction(logAction, true)
// saveState / logAction 是业务回调；业务退出时手动清理。
stopState()
stopAction()
```

无注册作用域的订阅同样需要手动清理。不要把所有订阅改为 detached；页面普通监听自动解绑即可。取消监听或释放 Store 不会取消已经开始的 action 的 `after/onError`；请求取消与过期结果处理仍由业务负责。

## 8. 插件与异常（使用插件或监听时迁移）

**PR 前行为：** manager 的插件可立即用于捕获该 manager 的 Store 定义；插件收到 `{ store }`，直接修改 Store，返回扩展对象被忽略。插件和订阅异常被默认吞掉，action 调用前监听异常也被吞掉。

**PR 后行为：** `pinia.use(plugin)` 在安装前先排队，安装后用于**新创建**的 Store，不追补已缓存实例。插件获得 `{ store, pinia, app, options }`，可返回扩展对象。插件、订阅、action 监听的异常不再默认吞掉；同步通知可向调用者抛出，异步通知进入调度错误路径。

改前（先创建 manager，再定义 Store，不能颠倒）：

```ts
const manager = createStore()
manager.use(({ store }) => {
  store.lastUpdated = ref(0)
})
const useCounter = defineStore('counter', () => ({ count: ref(0) }))
const store = useCounter()
```

改后：

```ts
const pinia = createPinia()
pinia.use(({ store, pinia, app, options }) => {
  store.$onAction(({ name }) => console.log(store.$id, name))
  return { lastUpdated: ref(0) }
})
const app = createApp({})
app.use(pinia)
const useCounter = defineStore('counter', () => ({ count: ref(0) }))
const store = useCounter(pinia)
```

**验证结果：** 插件执行一次，`storeToRefs(store)` 可提取插件返回的响应式属性；只激活或显式传 manager 并不会替代安装，安装前创建的 Store 不获得排队插件。插件属性若需要静态类型，应按项目扩展 Store 类型，不假定插件返回值能自动推导到所有 Store。

插件或 Setup 初始化抛错时，新版清理失败实例的 scope、缓存和此次新建的 state，再抛出原错误；修正错误后可重新 `useStore(pinia)`。已有 state 不会被无条件删除，插件已经执行的网络/日志等外部副作用也不会自动回滚。旧版 Setup 失败可能再次尝试，但没有这套清理保证；旧插件失败被吞掉，不能依赖它来触发重试。

把允许失败的遥测、持久化或日志回调自身包在业务 `try/catch` 中，并记录错误。不要依赖框架继续吞错；尤其 action 调用前监听抛错时，action 本体可能根本不执行。

## 9. 类型与 action（显式类型或结果监听时迁移）

**PR 前行为：** Setup 的 `defineStore<T>` 与 Options 的 `defineStore<S, G, A>` 不带 ID 泛型；Setup 属性类型包含 Ref。action 包装把带 `.then` 的返回值视为异步结果。

**PR 后行为：** Setup 泛型为 `<Id, T>`，Options 为 `<Id, S, G, A>`。优先使用推导；显式泛型需补 ID。Setup 外部类型自动解包，只读 getters 不能赋值；`storeToRefs` 保留 getter 的只读性。

改前：

```ts
import type { Ref } from 'wevu'

const useCounter = defineStore<{ count: Ref<number> }>('counter', () => ({ count: ref(0) }))
const useOptions = defineStore<{ count: number }, Record<never, never>, Record<never, never>>('options', {
  state: () => ({ count: 0 }),
})
```

改后：

```ts
import type { Ref, StoreManager } from 'wevu'

const useCounter = defineStore<'counter', { count: Ref<number> }>('counter', () => ({ count: ref(0) }))
const useOptions = defineStore<'options', { count: number }, Record<never, never>, Record<never, never>>('options', {
  state: () => ({ count: 0 }),
})
const manager: StoreManager = createPinia()
const count: number = useCounter(manager).count
```

`StoreManager` 现在是 `Pinia` 的类型别名。`ActionContext`、`ActionSubscriber`、`DefineStoreOptions`、`MutationType`、`StoreSubscribeOptions`、`SubscriptionCallback`、`StoreToRefsResult` 等公开名称继续保留；其中 `MutationType` 也新增运行时值。保留类型名称不保证旧代码里所有手写泛型和属性赋值仍能通过检查。

action 的同步返回值与原生 Promise 结果继续透传；新版包装使用 `instanceof Promise` 判断异步结果。旧代码若返回自定义 thenable，`after` 可能提前收到 thenable 本身，应归一化：

```ts
// PR 前：返回自定义 thenable，旧包装会调用其 then。
function load() {
  return requestThenable()
}
```

```ts
// PR 后：用原生 Promise 归一化，再交给 action 包装。
async function load() {
  return await requestThenable()
}
```

**验证结果：** `await store.load()` 与 `after(value)` 都得到最终业务值，失败会进入 `onError` 并继续向调用者抛出。监听回调自身抛错也要测试：例如异步 action 的 `after` 抛错会进入包装的 catch / `onError`，即使请求本身已成功。重复注册同一个结果回调不应被用来实现计数，因为新版用 Set 去重。迁移时检查调用次数、副作用和最终 rejected Promise，避免只检查 action 本体。

## 10. 释放与活动实例（新增能力）

**PR 前行为：** 没有 `$dispose()`、`disposePinia()`、`setActivePinia()`、`getActivePinia()`。旧代码通常靠模块缓存维持 Store，只能手动取消返回的订阅。不存在“旧 `$dispose` 后恢复初始值”的迁移契约。

**PR 后行为：** `$dispose()` 停止 Store scope、watcher 和订阅并删除实例缓存，**保留 state**；`disposePinia()` 释放整个 manager 并清空状态，已释放的 manager 不可再用。

改前（只能清理自己的监听，不能释放 Store）：

```ts
const store = useCounter()
const stop = store.$subscribe(() => {})
stop()
```

改后，采用新增释放能力：

```ts
const store = useCounter(pinia)
store.count = 7
store.$dispose()
const retained = useCounter(pinia)
console.log(retained.count) // 7

retained.$dispose()
delete pinia.state.value[useCounter.$id]
const fresh = useCounter(pinia)
console.log(fresh.count) // 0（Store 工厂初值）
```

**验证结果：** 第一次重建保留 `7`，先释放再删除 state 后重建得到 `0`。旧引用不会冻结或自动指向新实例；重建后重新取得 Store 和 refs。页面卸载通常只清理自己的监听，不释放仍被其他页面使用的 Store。

测试中可显式传实例，或使用新增活动实例 API：

```ts
import { createPinia, disposePinia, getActivePinia, setActivePinia } from 'wevu'
import { useCounter } from './stores/counter'

const pinia = createPinia()
setActivePinia(pinia)
try {
  const store = useCounter()
  store.increment()
  console.log(store.count, getActivePinia() === pinia) // 1, true
}
finally {
  disposePinia(pinia)
  setActivePinia(undefined)
}
```

每个测试创建独立实例；需要插件时先用测试 app 安装，不能只 `setActivePinia`。`getActivePinia()` 优先读取应用注入，再读活动实例，多应用/并行测试不要依赖一个共享活动变量。

## 11. 完整项目示例：入口、Store、页面和插件

以下两组使用相同目录：`src/app.vue`、`src/stores/manager.ts`、`src/stores/counter.ts`、`src/pages/counter/index.vue`。沿用项目现有 weapp-vite 配置和页面注册方式。

### 11.1 PR 前项目

```ts
// src/stores/manager.ts
import { createStore } from 'wevu'

export const manager = createStore()
manager.use(({ store }) => {
  store.$onAction(({ name }) => console.log('action', name))
})
```

```ts
// src/stores/counter.ts
import { computed, defineStore, ref } from 'wevu'
import './manager' // 必须在 defineStore 前执行，让旧定义捕获 manager

export const useCounter = defineStore('counter', () => {
  const count = ref(0)
  const doubled = computed(() => count.value * 2)
  function increment() {
    count.value++
  }
  return { count, doubled, increment }
})
```

```vue
<!-- src/app.vue -->
<script setup lang="ts">
import { use } from 'wevu'
import { manager } from './stores/manager'

use(manager) // 旧 manager.install 不承担注入；隐式 manager 已在模块中保存
</script>
```

```vue
<!-- src/pages/counter/index.vue -->
<script setup lang="ts">
import { onUnmounted, storeToRefs } from 'wevu'
import { useCounter } from '../../stores/counter'

const store = useCounter()
const { count, doubled, increment } = storeToRefs(store)
const stop = store.$subscribe((_mutation, state) => console.log(state.count.value))
onUnmounted(stop)
function reset() {
  store.$reset() // 旧版自动快照
}
function addTwo() {
  store.count.value += 2
}
</script>

<template>
  <view>{{ count }} / {{ doubled }}</view>
  <button @tap="increment">加一</button>
  <button @tap="addTwo">加二</button>
  <button @tap="reset">重置</button>
</template>
```

### 11.2 迁移后项目

```ts
// src/stores/manager.ts
import { createPinia } from 'wevu'

export const pinia = createPinia()
pinia.use(({ store }) => {
  store.$onAction(({ name }) => console.log('action', name))
})
```

```ts
// src/stores/counter.ts
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

```vue
<!-- src/app.vue -->
<script setup lang="ts">
import { use } from 'wevu'
import { pinia } from './stores/manager'

use(pinia) // 安装后，页面首次创建 Store 才会执行排队插件
</script>
```

```vue
<!-- src/pages/counter/index.vue -->
<script setup lang="ts">
import { storeToRefs } from 'wevu'
import { useCounter } from '../../stores/counter'

const store = useCounter()
const { count, doubled } = storeToRefs(store)
const { increment } = store
store.$subscribe((_mutation, state) => console.log(state.count)) // 默认异步，卸载自动解绑
function reset() {
  store.$reset()
}
function addTwo() {
  store.count += 2
}
</script>

<template>
  <view>{{ count }} / {{ doubled }}</view>
  <button @tap="increment">加一</button>
  <button @tap="addTwo">加二</button>
  <button @tap="reset">重置</button>
</template>
```

**验证结果：** 两版首屏为 `0 / 0`，依次加一、加二后为 `3 / 6`，重置后为 `0 / 0`。新版插件会额外看到自定义 `$reset` action；默认订阅日志异步输出。第二个页面调用同一个 `useCounter()` 可观察共享状态，卸载重进不会叠加普通订阅。

## 12. 搜索检查、真实小程序验收与回退

在业务源码中搜索以下模式，逐处检查；搜索命中不是一律替换：

```sh
rg 'createStore|createPinia|useStore|use[A-Z].*Store' src
rg 'storeToRefs|\.value|\$reset|\$state|\$patch' src
rg '\$subscribe|\$onAction|detached|defineStore<' src
```

- [ ] 每个应用安装一个共享 manager，组件外明确归属；没有 import 阶段提前创建插件 Store。
- [ ] Store ID 在同一 manager 内唯一；测试不再依赖同一定义的跨用例模块单例。
- [ ] 外部 Setup ref/computed 去掉 `.value`；内部 ref、普通 ref 和 `storeToRefs` 保留 `.value`。
- [ ] actions 从 Store 解构；需要持久化的普通属性改为 ref/reactive。
- [ ] Setup 提供业务重置；Options 动态工厂、额外字段、深合并和数组替换均已检查。
- [ ] 订阅第二参数、异步时机、通知类型/次数、detached 清理与异常处理均已检查。
- [ ] 手写泛型、只读 getter、thenable 返回和 action 结果回调通过类型与业务测试。

先运行项目类型检查、构建和 Store 测试，然后在**目标小程序真实 runtime** 完成以下验收；构建或类型通过不能替代这些观察：

| 路径 | 验收结果 |
| --- | --- |
| 冷启动直接进入 Store 页面 | 无“没有活动的 Pinia”，插件先于消费生效，首屏 state/getters 正确 |
| 页面 A 修改 → 页面 B 查看 → 返回 A | 同 manager 的值和 computed 一致，不创建额外 manager |
| 隐藏页面 → 卸载页面 → 再次进入 | 隐藏不解绑，卸载普通监听停止，重进每次操作仅产生预期次数，共享状态保留 |
| Setup reset / Options reset | 自定义重置与工厂初值符合业务，额外字段按预期保留或删除 |
| 直接写入 / patch / 嵌套 patch / `$state` | 值、通知类型、次数和时机符合第 7 节；视图最终正确 |
| 插件失败 → 修复后重试 | 原异常可见，没有残留失败实例/重复监听，重试成功 |
| Store 释放 → 重建 → 删除 state 后重建 | 先保留原值，再恢复工厂初值；detached 监听可手动清理 |

若回归失败，记录具体页面、操作、状态值、通知顺序和控制台错误。回退时一起恢复升级前的**业务代码、依赖声明和锁文件**，重新安装依赖并重新构建小程序，再执行冷启动验收；不要仅降依赖或仅回退 `.value` 修改，也不要继续使用新版生成的旧产物。若持久化结构在迁移中改变，回退前按业务的数据版本策略还原或清理相应数据。

## 13. 核对依据与支持边界

前后行为对照来自基线与本 PR 的 `packages-runtime/wevu/src/store/`。回归依据包括 `test/store.test.ts`、`test/store-pinia.test.ts`、`test/store-pinia-boundaries.test.ts`、`test/store-batching.test.ts`、`test/store-extra-coverage.test.ts`、`test/store-manager-alias.test.ts` 及 `test-d/store*.test-d.ts`。文中的“验证结果”是各示例应满足的检查点，不代表你的项目已经完成真实小程序验收。

完整 API、wevu 调度与上游差异见 [Store（状态管理）](./store)。
