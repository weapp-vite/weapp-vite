# wevu vs Vue 3：核心差异与小程序适配

> 深入对比 wevu 与 Vue 3 的架构差异，以及 wevu 如何适配微信小程序

## 目录

1. [核心架构对比](#核心架构对比)
2. [小程序适配的关键部分](#小程序适配)
3. [生命周期映射](#生命周期映射)
4. [双向绑定适配](#双向绑定)
5. [渲染层对比](#渲染层对比)

---

## 核心架构对比

### 架构图对比

#### Vue 3 架构

```text
┌─────────────────────────────────────────────────────────────┐
│                      Vue 3 Application                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐      ┌──────────────┐      ┌────────────┐ │
│  │  Component  │ ───> │ Reactive Sys │ ───> │ Renderer  │ │
│  │   (Setup)   │      │  (Proxy)     │      │  (VNode)   │ │
│  └─────────────┘      └──────────────┘      └────────────┘ │
│         │                    │                    │         │
│         │                    ▼                    ▼         │
│         │              ┌──────────┐         ┌─────────┐   │
│         │              │ Scheduler│         │ DOM API │   │
│         │              │(nextTick)│         │         │   │
│         │              └──────────┘         └─────────┘   │
│         │                                               │
└─────────────────────────────────────────────────────────────┘
                    ↓
        ┌─────────────────────────┐
        │    Virtual DOM Tree     │
        └─────────────────────────┘
                    ↓
        ┌─────────────────────────┐
        │     DOM Diff Patch      │
        └─────────────────────────┘
                    ↓
        ┌─────────────────────────┐
        │     Browser DOM         │
        └─────────────────────────┘
```

#### wevu 架构

```text
┌─────────────────────────────────────────────────────────────┐
│                       wevu Application                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐      ┌──────────────┐      ┌────────────┐ │
│  │ Component/  │ ───> │ Reactive Sys │ ───> │ Diff Algo  │ │
│  │    Page     │      │  (Proxy)     │      │(Snapshots) │ │
│  └─────────────┘      └──────────────┘      └────────────┘ │
│         │                    │                    │         │
│         │                    ▼                    ▼         │
│         │              ┌──────────┐         ┌─────────┐   │
│         │              │ Scheduler│         │ Adapter │   │
│         │              │(nextTick)│         │(setData)│   │
│         │              └──────────┘         └─────────┘   │
│         │                                               │
└─────────────────────────────────────────────────────────────┘
                    ↓
        ┌─────────────────────────┐
        │    Data Snapshots       │
        │  (Plain JS Objects)     │
        └─────────────────────────┘
                    ↓
        ┌─────────────────────────┐
        │   Diff Algorithm        │
        │  (Path-based Diff)      │
        └─────────────────────────┘
                    ↓
        ┌─────────────────────────┐
        │  Mini-Program setData   │
        │  { 'a.b.c': value }     │
        └─────────────────────────┘
                    ↓
        ┌─────────────────────────┐
        │   WeChat Native View    │
        └─────────────────────────┘
```

### 关键差异表

| 层级           | Vue 3               | wevu                | 差异说明        |
| -------------- | ------------------- | ------------------- | --------------- |
| **响应式系统** | Proxy + effect      | Proxy + effect      | ✅ **完全相同** |
| **调度器**     | queueJob + nextTick | queueJob + nextTick | ✅ **完全相同** |
| **数据模型**   | Virtual DOM Tree    | Data Snapshots      | ❌ **不同**     |
| **渲染算法**   | Virtual DOM Diff    | Snapshot Diff       | ❌ **不同**     |
| **视图更新**   | DOM API (patch)     | setData (小程序)    | ❌ **不同**     |
| **生命周期**   | Web 标准生命周期    | 小程序生命周期      | ❌ **不同**     |

### 相同的部分

#### 1. 响应式系统（100% 相同）

```typescript
// Vue 3 和 wevu 都是这样实现的

class RefImpl<T> {
  get value(): T {
    trackEffects(this.dep) // 收集依赖
    return this._value
  }

  set value(newValue: T) {
    if (!Object.is(newValue, this._rawValue)) {
      this._value = convertToReactive(newValue)
      triggerEffects(this.dep) // 触发更新
    }
  }
}
```

**完全一样！** wevu 直接复用了 Vue 3 的响应式系统设计。

#### 2. 调度器（99% 相同）

```typescript
// Vue 3 和 wevu 的调度器实现几乎一样

const resolvedPromise = Promise.resolve()
const jobQueue = new Set<Job>()

export function queueJob(job: Job) {
  jobQueue.add(job)
  if (!isFlushing) {
    resolvedPromise.then(flushJobs) // 微任务执行
  }
}
```

**唯一区别**：Vue 3 的 job 主要是执行 Virtual DOM patch，wevu 的 job 是执行 diff + setData。

### 不同的部分

#### 1. 渲染层（完全不同）

**Vue 3 的渲染流程：**

```typescript
// 文件：packages/vue/runtime-core/src/renderer.ts

function patch(n1, n2) {
  // 虚拟 DOM diff
  if (n1.type !== n2.type) {
    // 替换整个节点
  }
  else {
    // 更新属性、子节点
    patchElement(n1, n2)
  }

  // 最终调用 DOM API
  hostInsert(el, parent, anchor)
  hostSetElementText(el, text)
}
```

**wevu 的渲染流程：**

```typescript
// 文件：packages/wevu/src/runtime/app.ts

function job() {
  // 1. 收集快照（纯 JS 对象）
  const snapshot = collectSnapshot()

  // 2. Diff 快照（不是 Virtual DOM）
  const diff = diffSnapshots(latestSnapshot, snapshot)

  // 3. 调用小程序 setData
  adapter.setData(diff) // { 'user.name': 'Bob' }
}
```

**关键差异：**

| 特性          | Vue 3            | wevu             |
| ------------- | ---------------- | ---------------- |
| **数据结构**  | Virtual DOM Tree | Plain JS Objects |
| **Diff 算法** | 树形结构 Diff    | 深度对象 Diff    |
| **输出**      | DOM 操作列表     | setData 路径对象 |
| **更新方式**  | DOM API          | setData          |

#### 2. 视图层 API（完全不同）

**Vue 3 的 DOM 操作：**

```typescript
// Vue 3 直接操作 DOM

hostPatchProp(
  el,
  key,
  value,
  isSVG,
  prevChildren
)

// 最终调用：
el.textContent = text
el.setAttribute(key, value)
el.addEventListener(key, handler)
```

**wevu 的 setData 操作：**

```typescript
// wevu 通过小程序 setData 更新

adapter.setData({
  'user.name': 'Bob',
  'items[0].done': true
})

// 最终调用小程序 API：
this.setData({
  'user.name': 'Bob',
  'items[0].done': true
})
```

---

## 小程序适配

### 适配层架构

```text
┌─────────────────────────────────────────────────────────────┐
│                    wevu 适配层                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. 注册层 (register.ts)                               │  │
│  │     ├─ registerApp()        → App()                  │  │
│  │     └─ registerComponent()  → Component()            │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  2. 运行时层 (app.ts)                                  │  │
│  │     ├─ mount()               → 创建 runtime           │  │
│  │     ├─ adapter.setData()      → 桥接到小程序          │  │
│  │     └─ effect + scheduler     → 响应式更新            │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  3. Diff 层 (diff.ts)                                  │  │
│  │     ├─ toPlain()              → 响应式转普通对象       │  │
│  │     ├─ diffSnapshots()        → 计算差异              │  │
│  │     └─ assignNestedDiff()     → 生成 setData 路径    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  4. 双向绑定层 (bindModel.ts)                          │  │
│  │     ├─ bindModel()            → 创建 model 绑定       │  │
│  │     ├─ defaultParser()        → 解析小程序事件        │  │
│  │     └─ model()                → 生成小程序事件属性    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────────┐
        │    微信小程序原生 API                        │
        │    ├─ App() / Component()                   │
        │    ├─ setData()                             │
        │    ├─ triggerEvent()                        │
        │    └─ data / properties / methods            │
        └─────────────────────────────────────────────┘
```

### 1. 注册层适配 (register.ts)

**核心代码：**

```typescript
// 文件：packages/wevu/src/runtime/register.ts

// 🎯 关键：桥接到小程序 Component()（在微信中可用于页面/组件）
export function registerComponent<T extends object, C, M>(
  runtimeApp: RuntimeApp<T, C, M>,
  methods: M,
  watch: WatchMap | undefined,
  setup: DefineComponentOptions<T, C, M>['setup'],
  mpOptions: Record<string, any>,
) {
  const componentOptions: Record<string, any> = {
    ...mpOptions,
  }

  // 拦截 onLoad，挂载 runtime
  const userOnLoad = mpOptions.onLoad
  componentOptions.onLoad = function onLoad(this, ...args) {
    // 🔑 关键：在这里创建 wevu runtime
    mountRuntimeInstance(this, runtimeApp, watch, setup)

    if (typeof userOnLoad === 'function') {
      userOnLoad.apply(this, args)
    }
  }

  // 拦截 onUnload，清理 runtime
  const userOnUnload = mpOptions.onUnload
  componentOptions.onUnload = function onUnload(this, ...args) {
    teardownRuntimeInstance(this) // 🔑 清理

    if (typeof userOnUnload === 'function') {
      userOnUnload.apply(this, args)
    }
  }

  // 🎯 调用小程序原生 API
  Page(pageOptions)
}
```

**适配要点：**

1. **生命周期拦截**：在小程序生命周期中挂载/卸载 runtime
2. **方法桥接**：将 runtime.methods 桥接到小程序实例
3. **保留用户代码**：不覆盖用户定义的生命周期

**对比 Vue 3：**

```typescript
// Vue 3 的组件注册（Web）

const app = createApp(RootComponent)
app.mount('#root') // 直接挂载到 DOM

// 不需要拦截，因为 Web 没有生命周期概念
```

### 2. setData 适配 (app.ts + register.ts)

**核心代码：**

```typescript
// 文件：packages/wevu/src/runtime/register.ts

export function mountRuntimeInstance<T extends object, C, M>(
  target: InternalRuntimeState,
  runtimeApp: RuntimeApp<T, C, M>,
  watchMap: WatchMap | undefined,
  setup?: DefineComponentOptions<T, C, M>['setup'],
): RuntimeInstance<T, C, M> {
  // 🔑 关键：创建 adapter，桥接到小程序 setData
  const runtime = runtimeApp.mount({
    setData(payload: Record<string, any>) {
      // target 是小程序实例 (this)
      if (typeof target.setData === 'function') {
        target.setData(payload) // 🎯 调用小程序原生 API
      }
    },
  })

  // 挂载到实例上
  target.__wevu = runtime
}
```

**在 job 中使用：**

```typescript
// 文件：packages/wevu/src/runtime/app.ts

function job() {
  const snapshot = collectSnapshot()
  const diff = diffSnapshots(latestSnapshot, snapshot)

  // 🎯 关键：调用 adapter.setData
  // 实际上调用的是 target.setData()
  if (typeof currentAdapter.setData === 'function') {
    currentAdapter.setData(diff)
  }
}
```

**适配要点：**

1. **Adapter 模式**：通过 adapter 抽象层适配不同平台
2. **setData 路径**：生成小程序兼容的路径（`'a.b.c'`）
3. **错误处理**：捕获 setData 失败，避免中断

**对比 Vue 3：**

```typescript
// Vue 3 的 DOM 更新（Web）

function patch(n1, n2) {
  // 🎯 直接操作 DOM
  hostPatchProp(el, key, value)

  // 不需要 adapter，因为 Web 标准 API
}
```

### 3. Diff 算法适配 (diff.ts)

**核心需求：生成小程序 setData 兼容的路径**

```typescript
// 文件：packages/wevu/src/runtime/diff.ts

export function diffSnapshots(
  prev: Record<string, any>,
  next: Record<string, any>
): Record<string, any> {
  const output: Record<string, any> = {}

  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])

  for (const key of keys) {
    const prevValue = prev[key]
    const nextValue = next[key]

    if (!isDeepEqual(prevValue, nextValue)) {
      // 🔑 关键：递归 diff，生成嵌套路径
      assignNestedDiff(prevValue, nextValue, key, output)
    }
  }

  return output
}

function assignNestedDiff(
  prev: any,
  next: any,
  path: string, // 路径：'user' -> 'user.name' -> 'user.name.first'
  output: Record<string, any>
) {
  if (isPlainObject(prev) && isPlainObject(next)) {
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)])

    keys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(next, key)) {
        output[`${path}.${key}`] = null // 🎯 删除属性
        return
      }

      // 🔑 递归，生成嵌套路径
      assignNestedDiff(
        prev[key],
        next[key],
        `${path}.${key}`, // 🎯 路径拼接
        output
      )
    })
  }
  else {
    output[path] = normalizeSetDataValue(next) // 🎯 最终路径
  }
}
```

**示例：**

```typescript
// 初始状态
const prev = {
  user: {
    profile: {
      name: 'Alice',
      age: 25
    },
    settings: {
      theme: 'dark'
    }
  },
  items: [1, 2, 3]
}

// 修改后
const next = {
  user: {
    profile: {
      name: 'Bob', // ← 改了
      age: 25
    },
    settings: {
      theme: 'dark'
    }
  },
  items: [1, 2, 3, 4] // ← 加了一个
}

// diff 结果（小程序 setData 格式）
const diff = {
  'user.profile.name': 'Bob',
  'items[3]': 4,
}

// 调用小程序 API
this.setData({
  'user.profile.name': 'Bob',
  'items[3]': 4
})
```

**对比 Vue 3：**

```typescript
// Vue 3 的 Virtual DOM diff

const prevVNode = {
  type: 'div',
  props: { className: 'container' },
  children: [
    { type: 'span', children: 'Hello' }
  ]
}

const nextVNode = {
  type: 'div',
  props: { className: 'wrapper' }, // ← 改了
  children: [
    { type: 'span', children: 'Hello' }
  ]
}

// diff 结果：DOM 操作列表
const operations = [
  { op: 'setAttribute', name: 'className', value: 'wrapper' },
]

// 调用 Web API
el.setAttribute('className', 'wrapper')
```

### 4. 双向绑定适配 (bindModel.ts)

**小程序的双向绑定事件**

```vue
<!-- Web Vue 3 -->
<input v-model="username" />

<!-- 编译为 -->
<input
  :value="username"
  @input="username = $event.target.value"
/>
```

```vue
<!-- 小程序 -->
<input model:value="{{username}}" bind:input="handleInput" />

<!-- 需要手动处理 -->
Page({
  data: { username: '' },

  handleInput(e) {
    this.setData({
      username: e.detail.value  // 🎯 小程序的事件格式不同
    })
  }
})
```

**wevu 的适配方案：**

```typescript
// 文件：packages/wevu/src/runtime/bindModel.ts

// 🎯 解析小程序事件
export function defaultParser(event: any) {
  if (event == null) {
    return event
  }

  if (typeof event === 'object') {
    // 🔑 关键：从小程序事件中提取值
    if ('detail' in event && event.detail && 'value' in event.detail) {
      return event.detail.value // 🎯 大多数小程序组件
    }
    if ('target' in event && event.target && 'value' in event.target) {
      return event.target.value // 🎯 某些特殊组件
    }
  }

  return event
}

// 创建 model 绑定
export function createBindModel(
  publicInstance: Record<string, any>,
  state: Record<string, any>,
  computedRefs: Record<string, ComputedRef<any>>,
  computedSetters: Record<string, (value: any) => void>,
) {
  return function bindModel<T = any>(path: string, options?: ModelBindingOptions<T>) {
    const segments = toPathSegments(path)

    const resolveValue = () => getFromPath(publicInstance, segments)
    const assignValue = (value: T) => {
      setByPath(state, computedRefs, computedSetters, segments, value)
    }

    return {
      value: resolveValue,
      update: assignValue,

      // 🎯 生成小程序事件绑定
      model(modelOptions?: ModelBindingOptions<T>) {
        const handlerKey = `on${capitalize(event)}`
        return {
          [valueProp]: formatter(resolveValue()), // 绑定值
          [handlerKey]: (event: any) => { // 绑定事件
            const parsed = parser(event) // 解析事件
            assignValue(parsed) // 更新值
          }
        }
      }
    }
  }
}
```

**使用示例：**

```typescript
// 组件 setup
import { bindModel, ref } from 'wevu'

export default {
  setup() {
    const username = ref('')

    // 创建 model 绑定
    const usernameModel = bindModel(this, 'username')

    // 生成小程序事件绑定
    const inputBinding = usernameModel.model({
      event: 'input',
      valueProp: 'value'
    })
    // → { value: 'Bob', onInput: fn }

    return {
      username,
      inputBinding
    }
  }
}
```

```vue
<!-- 模板中使用 -->
<input model:value="{{username}}" bind:input="handleInput" />
```

---

## 生命周期映射

### Vue 3 vs 小程序生命周期

```typescript
// 文件：packages/wevu/src/runtime/hooks.ts

// Vue 3 生命周期 → 小程序生命周期映射

export function onMounted(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onMounted() must be called synchronously inside setup()')
  }
  // 🎯 映射到小程序 onReady
  pushHook(__currentInstance, 'onReady', handler)
}

export function onUnmounted(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onUnmounted() must be called synchronously inside setup()')
  }
  // 🎯 映射到小程序 onUnload (Page) 或 detached (Component)
  pushHook(__currentInstance, 'onUnmounted', handler)
}

export function onActivated(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onActivated() must be called synchronously inside setup()')
  }
  // 🎯 映射到小程序 onShow
  pushHook(__currentInstance, 'onShow', handler)
}

export function onDeactivated(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onDeactivated() must be called synchronously inside setup()')
  }
  // 🎯 映射到小程序 onHide
  pushHook(__currentInstance, 'onHide', handler)
}
```

### 生命周期对比表

| Vue 3             | Page       | Component              | 说明                           |
| ----------------- | ---------- | ---------------------- | ------------------------------ |
| `onBeforeMount`   | -          | -                      | 立即执行（小程序无挂载前钩子） |
| `onMounted`       | `onReady`  | `ready`                | 页面/组件就绪                  |
| `onBeforeUpdate`  | -          | -                      | setData 前立即执行             |
| `onUpdated`       | -          | -                      | setData 后执行（自定义）       |
| `onBeforeUnmount` | -          | -                      | 立即执行（小程序无卸载前钩子） |
| `onUnmounted`     | `onUnload` | `detached`             | 页面卸载/组件移除              |
| `onActivated`     | `onShow`   | `show` (pageLifetimes) | 页面/组件显示                  |
| `onDeactivated`   | `onHide`   | `hide` (pageLifetimes) | 页面/组件隐藏                  |
| `onErrorCaptured` | `onError`  | `error`                | 错误捕获                       |

---

## 双向绑定

### Web Vue 3 的 v-model

```vue
<script setup lang="ts">
import { ref } from 'vue'

const username = ref('')
const message = ref('')
const selected = ref('a')
</script>

<template>
  <input v-model="username">
  <textarea v-model="message" />
  <select v-model="selected">
    <option value="a">
      A
    </option>
    <option value="b">
      B
    </option>
  </select>
</template>
```

**编译后：**

```vue
<!-- 简化版 -->
<input
  :value="username"
  @input="username = $event.target.value"
/>

<textarea
  :value="message"
  @input="message = $event.target.value"
></textarea>

<select
  :value="selected"
  @change="selected = $event.target.value"
>
  <option value="a">A</option>
  <option value="b">B</option>
</select>
```

### 小程序的 model

```vue
<!-- 小程序原生写法 -->
<input model:value="{{username}}" bind:input="handleInput" />

<textarea model:value="{{message}}" bind:input="handleInput"></textarea>

<picker model:value="{{selected}}" bind:change="handleChange">
  <view>A</view>
  <view>B</view>
</picker>
```

```typescript
Page({
  data: {
    username: '',
    message: '',
    selected: 'a'
  },

  handleInput(e) {
    this.setData({
      username: e.detail.value
    })
  },

  handleChange(e) {
    this.setData({
      selected: e.detail.value
    })
  }
})
```

### wevu 的 bindModel

```typescript
// 文件：packages/wevu/src/runtime/bindModel.ts

// 创建 model 绑定
const model = bindModel(publicInstance, 'form.username')

// 生成小程序属性
const inputProps = model.model({
  event: 'input',
  valueProp: 'value'
})

// 结果：
// {
//   value: 'Bob',
//   onInput: (e) => {
//     const value = defaultParser(e)  // e.detail.value
//     setByPath(state, ['form', 'username'], value)
//   }
// }
```

**使用示例：**

```vue
<script>
import { ref } from 'wevu'
import { bindModel } from 'wevu/runtime'

export default {
  setup() {
    const username = ref('')
    const message = ref('')

    return {
      username,
      message
    }
  },

  // bindModel 会自动生成这些方法
  methods: {
    handleUsernameInput(e) {
      // 自动更新 username
    },

    handleMessageInput(e) {
      // 自动更新 message
    }
  }
}
</script>

<template>
  <input model:value="{{username}}" bind:input="handleUsernameInput">
  <textarea model:value="{{message}}" bind:input="handleMessageInput" />
</template>
```

---

## 渲染层对比

### Vue 3 的渲染流程

```text
用户代码: state.count++
   ↓
Reactive System: 触发依赖
   ↓
Scheduler: queueJob(patch)
   ↓
微任务: 执行 patch
   ↓
Virtual DOM Diff:
  - 对比新旧 VNode 树
  - 生成最小操作列表
  [
    { type: 'PATCH', prop: 'textContent', value: '1' }
  ]
   ↓
DOM 操作:
  - el.textContent = '1'
   ↓
浏览器渲染引擎更新 DOM
```

### wevu 的渲染流程

```text
用户代码: state.count++
   ↓
Reactive System: 触发依赖
   ↓
Scheduler: queueJob(job)
   ↓
微任务: 执行 job
   ↓
收集快照:
  {
    count: 1,
    user: { name: 'Alice' }
  }
   ↓
Diff 算法:
  - 深度对比新旧快照
  - 生成 setData 路径
  {
    'count': 1
  }
   ↓
小程序 setData:
  this.setData({ count: 1 })
   ↓
小程序原生渲染引擎更新视图
```

---

## 总结

### 核心差异

| 维度           | Vue 3               | wevu                | 是否相同    |
| -------------- | ------------------- | ------------------- | ----------- |
| **响应式系统** | Proxy + effect      | Proxy + effect      | ✅ 完全相同 |
| **调度器**     | queueJob + nextTick | queueJob + nextTick | ✅ 几乎相同 |
| **数据模型**   | Virtual DOM         | Data Snapshots      | ❌ 不同     |
| **Diff 算法**  | 树形 Diff           | 深度对象 Diff       | ❌ 不同     |
| **渲染 API**   | DOM API             | setData             | ❌ 不同     |
| **生命周期**   | Web 标准            | 小程序标准          | ❌ 不同     |
| **双向绑定**   | v-model             | bindModel           | ❌ 不同     |

### 小程序适配的关键

1. **注册层 (register.ts)**：拦截小程序生命周期，挂载 runtime
2. **Adapter (app.ts)**：桥接到小程序 setData API
3. **Diff 算法 (diff.ts)**：生成小程序兼容的 setData 路径
4. **双向绑定 (bindModel.ts)**：解析小程序事件，适配 v-model

### 为什么 wevu 更轻量？

```text
Vue 3 核心代码量：
├── reactivity/      ~5,000 行  ✅ wevu 复用
├── runtime-core/   ~10,000 行  ❌ wevu 不需要（Virtual DOM）
├── runtime-dom/    ~5,000 行  ❌ wevu 不需要（DOM 操作）
├── compiler-core/  ~15,000 行  ❌ wevu 不需要（模板编译）
└── compiler-dom/   ~5,000 行  ❌ wevu 不需要（DOM 编译）
Total: ~40,000 行

wevu 核心代码量：
├── reactivity/     ~5,000 行  ✅ 与 Vue 3 相同
├── runtime/        ~3,000 行  ⚡ 精简版（无 Virtual DOM）
├── scheduler/      ~100 行   ✅ 与 Vue 3 相同
└── diff/           ~500 行   ⚡ 小程序专用
Total: ~8,600 行

节省：~31,400 行（78%）
```

### 适配策略

| 需求           | Vue 3       | wevu        | 适配方式                 |
| -------------- | ----------- | ----------- | ------------------------ |
| **数据响应式** | Proxy       | Proxy       | 直接复用                 |
| **批量更新**   | nextTick    | nextTick    | 直接复用                 |
| **视图更新**   | DOM API     | setData     | Adapter 桥接             |
| **事件处理**   | DOM Events  | Mini Events | Parser 解析              |
| **生命周期**   | Web Hooks   | MP Hooks    | 映射转换                 |
| **模板编译**   | VNode → DOM | Vue → WXML  | 编译器处理（weapp-vite） |

---

## 参考源码

- **wevu 响应式**: `packages/wevu/src/reactivity/`
- **wevu 调度器**: `packages/wevu/src/scheduler.ts`
- **wevu 运行时**: `packages/wevu/src/runtime/app.ts`
- **小程序注册**: `packages/wevu/src/runtime/register.ts`
- **Diff 算法**: `packages/wevu/src/runtime/diff.ts`
- **双向绑定**: `packages/wevu/src/runtime/bindModel.ts`

## 相关阅读

- [wevu 工作原理](./ARCHITECTURE.md)
- [Vue 3 兼容性文档](./VUE3_COMPAT.md)
- [小程序 setData 优化](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips.html)
