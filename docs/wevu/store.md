# Store（状态管理）

wevu Store 面向小程序，公开用法和主要行为以 Pinia 4.0.3 为参照，导入来自 `wevu` 或 `wevu/store`。响应式核心、依赖追踪、调度与 `setData` 使用 wevu 的实现，不承诺复刻 Vue/Pinia 的内部执行时序。支持 Setup/Options Store、独立 Pinia 实例、基础插件和订阅作用域。Web SSR、Vue Devtools 和 Pinia HMR 不在支持范围内。

## 初始化

在小程序 `app.vue` 中安装一次：

```vue
<script setup lang="ts">
import { createPinia, use } from 'wevu'

const pinia = createPinia()
use(pinia)
</script>
```

使用 `createApp()` 时调用 `app.use(pinia)`。组件外可调用 `useCounter(pinia)`；测试可用 `setActivePinia(createPinia())`。`createStore()` 保留为 `createPinia()` 的同实现兼容别名，不新增弃用警告；既有应用无需仅为改名而修改。未安装、未传入且无活动实例时，`useStore()` 会报错。不同 Pinia 的实例和状态隔离，同一个 Pinia 中相同 ID 复用实例。

## 定义与使用

```ts
import { computed, defineStore, ref, storeToRefs } from 'wevu'

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

// 在安装后的页面/组件 setup 中使用
const store = useCounter()
store.count++
console.log(store.doubled)
const { count, doubled } = storeToRefs(store)
const { increment } = store
count.value++
```

只有 setup 内部的 ref 和 `storeToRefs()` 返回值使用 `.value`。`storeToRefs()` 包含响应式 state、getters 和插件响应式属性，不包含 actions、普通属性和管理 API；只读 getter 仍只读。向模板暴露解构出的 refs 和 actions。

Options Store 的 getter/action 中可以用 `this`：

```ts
export const useProfile = defineStore('profile', {
  state: () => ({ profile: { name: 'Ada', age: 18 }, visits: 0 }),
  getters: { label: state => `${state.profile.name}: ${state.visits}` },
  actions: { visit() {
    this.visits++
  } },
})
```

## 修改与重置

两种 Store 均有 `$state`。Setup Store 的 state 只包含返回的 ref/reactive，不包含 computed 和 actions。

```ts
const profile = useProfile()
profile.$patch({ profile: { age: 20 } }) // 保留 name
profile.$patch((state) => {
  state.visits++
})
profile.$state = { profile: { name: 'Lin', age: 21 }, visits: 2 }
profile.$reset()
```

对象 patch 深层合并普通对象、替换数组；函数 patch 接收自动解包后的 state。`$state` 赋值通过 function patch 合并字段，保留响应式连接。Options `$reset()` 重新调用 state 工厂；Setup 必须返回自定义 `$reset`，未提供时开发模式报错、生产模式为空操作。

## 订阅与作用域

```ts
const stop = store.$subscribe((mutation, state) => {
  console.log(mutation.type, mutation.storeId, state.count)
  if (mutation.type === 'patch object') {
    console.log(mutation.payload)
  }
}, { flush: 'sync' })

const stopAction = store.$onAction(({ name, args, after, onError }) => {
  after(result => console.log(name, args, result))
  onError(error => console.error(error))
})
```

直接修改默认随 watcher 调度异步通知；`flush: 'sync'` 同步通知。`$patch` 同步发布 `patch object` 或 `patch function`，对象 patch 附带原 payload；`$state` 和 Options `$reset` 发布 `patch function`。支持 `deep`、`immediate`、`once` 等 wevu watch 选项。

`$patch` 暂停 Store 内部订阅的重复依赖收集；同步订阅在 patch 结束后刷新，默认异步订阅在同一轮调度中合并刷新。普通 `watch(..., { flush: 'sync' })` 仍逐次观察 patch 内的写入；页面渲染和 `setData` 由小程序调度器合并。

显式使用 `batch(() => { ... })` 时，普通同步 watcher 按 wevu 的批处理语义合并执行。批次内每次 `$patch` 仍同步发布自己的 patch 通知，内部订阅在外层批次结束后恢复，不再重复发布该批次的 `direct`。需要单独观察的直接修改应放在批次之外；默认异步订阅需等待 `nextTick()` 后恢复。

大列表优先按业务拆分 Store，使用 `shallowRef`、`shallowReactive` 或 `markRaw` 明确更新边界。深订阅仍有遍历成本，批处理不会使任意大状态的观察变成常数开销。Pinia 版本升级需审查公开行为变化，并通过小程序 runtime 与性能回归；不自动追随其内部调度实现。

默认订阅绑定注册时的作用域：页面 `onUnload`、组件 `detached` 后自动解绑；`onHide` 不解绑。`$subscribe(cb, { detached: true })`、`$onAction(cb, true)` 或无作用域登记的订阅由调用方取消。取消订阅或释放 Store 不取消已经开始的 action 的 `after/onError`。

## 显式释放

`store.$dispose()` 停止 Store scope、watcher 和登记的 cleanup，清空订阅并删除实例缓存，**保留 Pinia 的 state**。页面卸载不会销毁共享 Store。下一次 `useStore()` 创建新实例并复用原状态；重复释放旧实例不会删除新实例。

```ts
store.$dispose()
// 需要全新状态时，显式删除保存的状态
const pinia = getActivePinia()!
delete pinia.state.value[useCounter.$id]
const fresh = useCounter(pinia)
// 整个应用或测试结束后释放全部 Store 与状态
disposePinia(pinia)
```

上例中的 `getActivePinia`、`disposePinia` 同样从 `wevu` / `wevu/store` 导入。释放不会冻结旧引用、重建旧实例或取消业务异步任务。初始化失败允许后续重试；cleanup 抛错时仍尝试完成剩余清理后报告错误。

## 插件

```ts
const pinia = createPinia()
pinia.use(({ store, pinia, app, options }) => {
  console.log(store.$id, pinia, app, options.actions)
  return { lastUpdated: ref(0) }
})
// app.vue 用 use(pinia)，createApp 场景用 app.use(pinia)
```

插件在安装后作用于新创建的 Store，可以返回扩展属性。`PiniaCustomProperties` 和 `PiniaCustomStateProperties` 支持类型声明合并。不要假定依赖 Vue Devtools、Web SSR 或 Vue 响应式内部对象的第三方插件能直接运行。

## 从旧版迁移

本次按 minor 发布，但包含需要旧 Store 消费者迁移的不兼容变化。请先阅读 [Store 迁移指南](./store-migration.md)，再按下表检查消费者。推荐使用 `createPinia()` 创建管理器；旧名称 `createStore()` 仍可使用，通过应用安装、显式传参或测试中显式激活后使用：

| 旧写法/行为 | 当前写法/行为 |
| --- | --- |
| 无初始化直接 `useStore()` | `use(createPinia())`、`app.use(pinia)` 或 `useStore(pinia)` |
| `createStore()` 保存隐式 manager | `createPinia()` 后显式安装，不再隐式激活 manager |
| 外部 `store.count.value++` | `store.count++` |
| 从 `storeToRefs()` 解构 action | 从 Store 实例直接解构 action |
| Setup 自动快照 `$reset()` | 在 setup 返回自定义 `$reset` |
| 直接修改同步触发 `$subscribe` | 默认异步；确需同步时设置 `flush: 'sync'` |
| 旧版没有释放 API（新增能力） | `$dispose()` 保留状态，需要时显式删除 `pinia.state.value[id]` |
| 无作用域自动解绑 | 页面/组件 setup 中默认解绑，detached 或无作用域时手动取消 |

不要用 `$dispose()` 代替页面卸载钩子；共享 Store 的生命周期属于 Pinia，页面只拥有自己的订阅。
