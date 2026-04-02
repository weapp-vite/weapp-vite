# wevu 工作原理深度解析

> 深入理解 wevu 的响应式系统、调度机制和小程序 setData 优化

## 目录

1. [核心问题：ref 赋值何时触发 setData？](#核心问题)
2. [响应式系统原理](#响应式系统)
3. [调度器与批量更新](#调度器)
4. [Diff 算法与 setData 优化](#diff-算法)
5. [完整流程图](#完整流程)
6. [性能优化策略](#性能优化策略)
7. [常见问题](#常见问题)

---

## 核心问题

### 简短回答

**ref 赋值不会立即触发 setData**，而是：

1. ✅ **立即响应**：触发依赖追踪，通知相关 effect
2. ⏳ **调度更新**：将更新 job 加入队列
3. 🔄 **微任务执行**：在下一个微任务批量执行所有更新
4. 📊 **Diff 算法**：计算最小变更集
5. 🚀 **调用 setData**：只传递变化的数据给小程序

### 时间线示意

```text
用户代码: count.value++
   ↓ (立即)
响应式系统: 触发依赖，标记 effect
   ↓ (立即)
调度器: queueJob(job) - 加入队列
   ↓ (微任务)
job 执行: 收集快照 → diff → setData
   ↓
小程序: 更新视图
```

---

## 响应式系统

### 1. ref 的工作原理

```typescript
// 文件：packages-runtime/wevu/src/reactivity/ref.ts

class RefImpl<T> {
  private _value: T
  public dep: Dep | undefined // 依赖集合

  get value(): T {
    // 📖 依赖收集
    if (!this.dep) {
      this.dep = new Set()
    }
    trackEffects(this.dep) // 告诉当前 effect："我依赖这个 ref"
    return this._value
  }

  set value(newValue: T) {
    if (!Object.is(newValue, this._rawValue)) {
      this._rawValue = newValue
      this._value = convertToReactive(newValue)

      // 🚨 触发更新
      if (this.dep) {
        triggerEffects(this.dep) // 通知所有依赖这个 ref 的 effect
      }
    }
  }
}
```

**关键点：**

- **get 时**：收集依赖（`trackEffects`）
- **set 时**：触发更新（`triggerEffects`）
- 使用 `Object.is` 检测真正的变化

### 2. effect 的作用

effect 是响应式系统的"执行单元"：

```typescript
// 文件：packages-runtime/wevu/src/reactivity/core.ts

export function effect<T = any>(fn: () => T, options: EffectOptions = {}): ReactiveEffect<T> {
  const _effect = createReactiveEffect(fn, options)
  if (!options.lazy) {
    _effect() // 立即执行一次
  }
  return _effect
}

function createReactiveEffect<T>(fn: () => T, options: EffectOptions = {}): ReactiveEffect<T> {
  const effect = function reactiveEffect() {
    if (!effect.active) {
      return fn()
    }

    // 防止循环依赖
    if (effectStack.includes(effect)) {
      return fn()
    }

    // 清理旧的依赖关系
    cleanupEffect(effect)

    try {
      effectStack.push(effect)
      activeEffect = effect // 🎯 设置为当前活跃的 effect
      return fn() // 📖 执行函数，会触发 ref 的 getter，收集依赖
    }
    finally {
      effectStack.pop()
      activeEffect = effectStack.at(-1) ?? null
    }
  }

  effect.deps = []
  effect.scheduler = options.scheduler // 📅 调度器
  effect.active = true

  return effect
}
```

**依赖收集过程：**

```typescript
// 1. effect 开始执行
activeEffect = myEffect
effectStack.push(myEffect)

// 2. 访问 ref.value
const value = count.value
// → trackEffects(count.dep)
// → count.dep.add(myEffect)
// → myEffect.deps.push(count.dep)

// 3. effect 执行完成
activeEffect = null
```

**依赖触发过程：**

```typescript
// 1. 修改 ref.value
count.value = 100

// 2. RefImpl.set value 调用
triggerEffects(count.dep)

// 3. 遍历所有依赖的 effect
count.dep.forEach((effect) => {
  if (effect.scheduler) {
    effect.scheduler() // 📅 有调度器，调用调度器
  }
  else {
    effect() // 无调度器，立即执行
  }
})
```

---

## 调度器

### 1. queueJob 的实现

```typescript
// 文件：packages-runtime/wevu/src/scheduler.ts

const resolvedPromise: Promise<void> = Promise.resolve()
const jobQueue = new Set<Job>() // 使用 Set 去重
let isFlushing = false

function flushJobs() {
  isFlushing = true
  try {
    jobQueue.forEach(job => job()) // 批量执行所有 job
  }
  finally {
    jobQueue.clear()
    isFlushing = false
  }
}

export function queueJob(job: Job) {
  jobQueue.add(job) // 去重：同一个 job 只会加入一次

  if (!isFlushing) {
    // 🎯 关键：使用 Promise.then 在微任务中执行
    resolvedPromise.then(flushJobs)
  }
}
```

**为什么使用 Promise.then？**

1. **微任务执行**：在当前宏任务完成后、下一个宏任务前执行
2. **批量更新**：同一微任务内的多次修改会被合并
3. **避免重复**：使用 Set 自动去重

### 2. 在 wevu 中的应用

```typescript
// 文件：packages-runtime/wevu/src/runtime/app.ts

function job() {
  if (!mounted) {
    return
  }

  // 1. 收集当前快照
  const snapshot = collectSnapshot()

  // 2. 与上一次快照 diff
  const diff = diffSnapshots(latestSnapshot, snapshot)
  latestSnapshot = snapshot

  // 3. 如果没有变化，直接返回
  if (!Object.keys(diff).length) {
    return
  }

  // 4. 调用小程序 setData
  if (typeof currentAdapter.setData === 'function') {
    const result = currentAdapter.setData(diff)
    if (result && typeof result.then === 'function') {
      result.catch(() => {})
    }
  }
}

// 📅 创建 effect，使用调度器
const tracker = effect(
  () => {
    // 追踪所有 state 和 computed 的变化
    touchReactive(state as any)
    Object.keys(computedRefs).forEach(key => computedRefs[key].value)
  },
  {
    scheduler: () => queueJob(job) // 🎯 关键：使用 queueJob 调度
  }
)
```

---

## Diff 算法

### 1. 数据收集

```typescript
// 文件：packages-runtime/wevu/src/runtime/app.ts

function collectSnapshot(): Record<string, any> {
  const plain = toPlain(state) // 响应式对象转普通对象

  // 合并 computed 的值
  Object.keys(computedRefs).forEach((key) => {
    plain[key] = toPlain(computedRefs[key].value)
  })

  return plain
}
```

**toPlain 的作用：**

```typescript
// 文件：packages-runtime/wevu/src/runtime/diff.ts

export function toPlain(value: any, seen = new WeakMap<object, any>()): any {
  const unwrapped = unref(value) // 解包 ref

  if (typeof unwrapped !== 'object' || unwrapped === null) {
    return unwrapped // 基本类型直接返回
  }

  const raw = isReactive(unwrapped) ? toRaw(unwrapped) : unwrapped

  // 处理循环引用
  if (seen.has(raw)) {
    return seen.get(raw)
  }

  // 处理数组
  if (Array.isArray(raw)) {
    const arr: any[] = []
    seen.set(raw, arr)
    raw.forEach((item, index) => {
      arr[index] = toPlain(item, seen) // 递归处理
    })
    return arr
  }

  // 处理对象
  const output: Record<string, any> = {}
  seen.set(raw, output)
  Object.keys(raw).forEach((key) => {
    output[key] = toPlain((raw as any)[key], seen) // 递归处理
  })

  return output
}
```

### 2. 差异计算

```typescript
// 文件：packages-runtime/wevu/src/runtime/diff.ts

export function diffSnapshots(
  prev: Record<string, any>,
  next: Record<string, any>
): Record<string, any> {
  const output: Record<string, any> = {}

  // 遍历所有 key
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])

  for (const key of keys) {
    const prevValue = prev[key]
    const nextValue = next[key]

    if (!Object.hasOwn(next, key)) {
      // key 在 next 中不存在 → 删除
      output[key] = null
    }
    else if (!Object.hasOwn(prev, key)) {
      // key 在 prev 中不存在 → 新增
      output[key] = normalizeSetDataValue(nextValue)
    }
    else if (!isDeepEqual(prevValue, nextValue)) {
      // key 存在于两者，但值不同 → 递归 diff
      assignNestedDiff(prevValue, nextValue, key, output)
    }
  }

  return output
}

function assignNestedDiff(
  prev: any,
  next: any,
  path: string,
  output: Record<string, any>
) {
  if (isDeepEqual(prev, next)) {
    return // 值相同，跳过
  }

  if (isPlainObject(prev) && isPlainObject(next)) {
    // 两个都是对象，递归 diff
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)])

    keys.forEach((key) => {
      if (!Object.hasOwn(next, key)) {
        output[`${path}.${key}`] = null // 删除嵌套属性
        return
      }

      assignNestedDiff(prev[key], next[key], `${path}.${key}`, output)
    })
  }
  else {
    // 基本类型或类型不同，直接设置
    output[path] = normalizeSetDataValue(next)
  }
}
```

**Diff 策略：**

| 场景     | 处理方式    | 示例                                                                 |
| -------- | ----------- | -------------------------------------------------------------------- |
| 新增 key | 直接设置    | `{ a: 1 }` → `{ a: 1, b: 2 }` → `{ b: 2 }`                           |
| 删除 key | 设置为 null | `{ a: 1, b: 2 }` → `{ a: 1 }` → `{ b: null }`                        |
| 修改 key | 深度比较    | `{ a: { x: 1 } }` → `{ a: { x: 2 } }` → `{ a.x: 2 }`                 |
| 嵌套对象 | 路径 diff   | `{ a: { b: { c: 1 } } }` → `{ a: { b: { c: 2 } } }` → `{ a.b.c: 2 }` |

### 3. 小程序 setData 路径

小程序支持嵌套路径的 setData：

```javascript
// 小程序 setData 支持
this.setData({
  'a.b.c': 2,
  'user.name': 'Alice',
  'items[0].done': true
})
```

wevu 的 diff 算法生成的路径完全兼容小程序的 setData：

```typescript
// wevu diff 输出
const diff = {
  'a.b.c': 2,
  'user.name': 'Alice',
  'items[0].done': true,
}
```

---

## 完整流程

### 场景：点击按钮增加计数

```typescript
// 组件代码
export default {
  setup() {
    const count = ref(0)

    function increment() {
      count.value++ // ← 用户操作
    }

    return { count, increment }
  }
}
```

### 执行流程

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. 用户点击按钮，调用 increment()                            │
│    count.value++                                            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. RefImpl.set value 执行                                    │
│    - 检测到值变化：0 → 1                                     │
│    - 调用 triggerEffects(this.dep)                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 遍历依赖这个 ref 的所有 effects                           │
│    for (effect of this.dep) {                               │
│      if (effect.scheduler) {                               │
│        effect.scheduler()  ← 调用 queueJob(job)            │
│      }                                                       │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. queueJob(job)                                            │
│    - 将 job 加入 jobQueue (Set)                              │
│    - resolvedPromise.then(flushJobs)                        │
│    - job 还未执行！只是在队列中等待                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 同步代码继续执行                                          │
│    如果有多次修改：                                          │
│    count.value++  → jobQueue.add(job)                       │
│    count.value++  → jobQueue.add(job)  (Set 自动去重)       │
│    count.value++  → jobQueue.add(job)                       │
│    → 队列中只有 1 个 job！                                   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. 当前宏任务结束，开始执行微任务                             │
│    resolvedPromise.then(flushJobs) 被执行                   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. flushJobs() 执行                                          │
│    - isFlushing = true                                      │
│    - jobQueue.forEach(job => job())                         │
│    - 执行 job 函数                                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. job() 函数执行                                            │
│    a) collectSnapshot()                                     │
│       - 收集当前所有 state 和 computed 的值                   │
│       - 转换为普通对象 (toPlain)                             │
│                                                               │
│    b) diffSnapshots(latestSnapshot, snapshot)               │
│       - 深度对比新旧快照                                     │
│       - 生成最小变更集                                       │
│       - 例如: { count: 3 }                                   │
│                                                               │
│    c) adapter.setData(diff)                                  │
│       - 调用小程序 setData                                   │
│       - 传递最小变更集                                       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. 小程序 setData 执行                                        │
│    Component({                                              │
│      methods: {                                             │
│        $wevuSetData(payload) {                              │
│          this.setData(payload)  ← 真正的小程序 API          │
│        }                                                     │
│      }                                                       │
│    })                                                       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. 小程序渲染引擎更新视图                                    │
│     - 虚拟 DOM diff                                         │
│     - 更新真实 DOM                                          │
│     - 用户看到界面变化                                       │
└─────────────────────────────────────────────────────────────┘
```

### 时序图

```text
用户代码      Ref         Effect       Scheduler    微任务队列    setData
  |            |            |             |            |            |
  |-- count.value++ -->
  |            |            |             |            |            |
  |            |-- trigger -->            |            |            |
  |            |            |-- scheduler --> queueJob  |            |
  |            |            |             |            |            |
  |            |            |             |-- add job --> [job]     |
  |            |            |             |            |            |
  |-- count.value++ -->
  |            |            |             |            |            |
  |            |-- trigger -->            |            |            |
  |            |            |-- scheduler --> queueJob  |            |
  |            |            |             |-- (duplicate, ignored) |
  |            |            |             |            |            |
  |<---------------------------------------------------- execute --|
  |            |            |             |            |            |
  |            |            |             |            |-- flushJobs|
  |            |            |             |            |-- collectSnapshot
  |            |            |             |            |-- diff
  |            |            |             |            |-- setData(diff) -->
  |            |            |             |            |            |
  |<-----------------------------------------------------------------|
  |            |            |             |            |            |
```

---

## 性能优化策略

### 1. 批量更新

**问题**：连续多次修改会触发多次 setData 吗？

**答案**：不会！得益于 queueJob 的批量处理

```typescript
// ❌ 不会触发 3 次 setData
count.value++ // job 加入队列
count.value++ // job 已在队列，Set 自动去重
count.value++ // job 已在队列，忽略

// 微任务执行时，只执行一次 job
// diff 结果: { count: 3 }
// setData({ count: 3 })  ← 只调用一次！
```

### 2. 最小化数据传输

**Diff 算法确保只传递变化的数据**

```typescript
// 初始状态
const state = reactive({
  user: { name: 'Alice', age: 25, address: { city: 'Beijing' } },
  items: [1, 2, 3]
})

// 修改部分数据
state.user.name = 'Bob'
state.items.push(4)

// diff 结果 (只传递变化的部分)
const diff = {
  'user.name': 'Bob',
  'items[3]': 4,
}

// setData 调用
this.setData({
  'user.name': 'Bob',
  'items[3]': 4
})
```

**没有变化的数据不会传递**

```typescript
const count = ref(0)

count.value = 0 // 值相同，不会触发任何 effect
count.value = 0 // Object.is(0, 0) === true，直接返回
```

### 3. 计算属性的缓存

```typescript
const count = ref(0)
const double = computed(() => count.value * 2)

count.value++ // → double 重新计算
count.value++ // → double 再次重新计算

// 但如果 count 没有变化，double 不会重新计算
const doubleValue = double.value // 访问时才计算
```

### 4. 深度响应式的优化

```typescript
// 只在根层级追踪变化
const state = shallowReactive({
  nested: { count: 0 }
})

// 这样修改不会触发更新
state.nested.count++ // ❌ 不会触发 effect

// 必须替换整个对象
state.nested = { count: 1 } // ✅ 触发 effect
```

---

## 常见问题

### Q1: 为什么修改数据后立即读取，还是旧值？

```typescript
const count = ref(0)
console.log(count.value) // 0

count.value++
console.log(count.value) // 1 ← 已更新！

// 但 setData 还未执行，小程序视图未更新
```

**答案**：

- ✅ **响应式对象立即更新**：`count.value` 已经是 1
- ⏳ **小程序 setData 未执行**：视图还没更新
- 📅 **微任务后 setData**：在下一个微任务才调用 setData

**如果需要在 setData 后执行代码：**

```typescript
import { nextTick } from 'wevu'

count.value++
await nextTick() // 等待 setData 完成
console.log('视图已更新')
```

### Q2: 为什么 watch 的回调没有立即执行？

```typescript
watch(count, (newValue, oldValue) => {
  console.log(newValue, oldValue)
})

count.value++ // watch 回调何时执行？
```

**答案**：watch 回调也是通过 scheduler 调度的，会在微任务中执行。

```typescript
// 同步代码
count.value++ // 1
count.value++ // 2
count.value++ // 3

// 微任务中
// watch 回调执行， newValue = 3, oldValue = 0
```

**如果需要立即执行：**

```typescript
watch(count, (newValue, oldValue) => {
  console.log(newValue, oldValue)
}, { immediate: true }) // 立即执行一次
```

### Q3: setData 失败了怎么办？

```typescript
function job() {
  const diff = diffSnapshots(latestSnapshot, snapshot)

  if (typeof currentAdapter.setData === 'function') {
    const result = currentAdapter.setData(diff)
    if (result && typeof result.then === 'function') {
      result.catch(() => {}) // ← 捕获错误，避免中断
    }
  }
}
```

**答案**：wevu 自动捕获 setData 错误，不会中断后续代码。

**如何监听 setData 错误：**

```typescript
const runtime = app.mount({
  setData(payload) {
    return this.setData(payload).catch((error) => {
      console.error('setData error:', error)
      // 可以在这里处理错误，比如上报到监控系统
    })
  }
})
```

### Q4: 如何避免不必要的 setData？

**策略 1：使用 shallowReactive**

```typescript
// 大对象，只关心整体变化
const config = shallowReactive({
  // ... 大量配置
})

// 只有整体替换才会触发更新
config = newConfig // ✅
config.key = value // ❌ 不会触发
```

**策略 2：使用 markRaw**

```typescript
import { markRaw, reactive } from 'wevu'

const classInstance = markRaw(new MyClass())

const state = reactive({
  instance: classInstance // instance 不会被转为响应式
})

state.instance.value++ // ❌ 不会触发 effect
```

**策略 3：防抖**

```typescript
import { debounce } from 'lodash-es'

const job = debounce(() => {
  // diff + setData
}, 100)

const tracker = effect(
  () => {
    touchReactive(state)
  },
  {
    scheduler: () => job() // 使用防抖的 job
  }
)
```

### Q5: 为什么 computed 的值没有更新？

```typescript
const count = ref(0)
const double = computed(() => count.value * 2)

console.log(double.value) // 0

count.value = 5
console.log(double.value) // ?
```

**答案**：computed 是懒执行的，只有访问时才计算。

```typescript
count.value = 5
// double 被标记为 dirty，但还未重新计算

console.log(double.value) // 10 ← 访问时才计算
```

---

## 总结

### wevu 的核心设计

1. **响应式系统**：基于 Proxy 和 effect，精确追踪依赖
2. **调度器**：使用微任务批量更新，避免重复执行
3. **Diff 算法**：深度对比快照，生成最小变更集
4. **setData 优化**：只传递变化的数据，最小化通信开销

### ref 赋值的完整流程

```text
ref.value++ → 触发依赖 → queueJob → 微任务 → diff → setData
  (立即)      (立即)     (微任务)   (微任务)  (微任务)  (微任务)
```

### 性能优势

| 优化点   | 传统方式              | wevu             |
| -------- | --------------------- | ---------------- |
| 批量更新 | ❌ 每次修改都 setData | ✅ 微任务批量    |
| 数据传输 | ❌ 传递整个 data      | ✅ diff 最小集   |
| 计算属性 | ❌ 每次都重新计算     | ✅ 懒执行 + 缓存 |
| 深度响应 | ❌ 总是深度响应       | ✅ shallow 选项  |

### 最佳实践

1. ✅ **使用 ref/reactive**：让 wevu 自动管理响应式
2. ✅ **信任调度器**：不要手动调用 setData
3. ✅ **合理使用 computed**：缓存计算结果
4. ✅ **善用 watch**：监听特定数据变化
5. ⚠️ **避免直接操作 this.data**：绕过响应式系统

---

## 参考源码

- **响应式核心**: `packages-runtime/wevu/src/reactivity/`
- **调度器**: `packages-runtime/wevu/src/scheduler.ts`
- **运行时**: `packages-runtime/wevu/src/runtime/app.ts`
- **Diff 算法**: `packages-runtime/wevu/src/runtime/diff.ts`
- **组件注册**: `packages-runtime/wevu/src/runtime/register.ts`

## 相关阅读

- [Vue 3 Reactivity 原理](https://vuejs.org/guide/extras/reactivity-in-depth.html)
- [小程序 setData 优化](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips.html)
- [wevu API 文档](./VUE3_COMPAT.md)
