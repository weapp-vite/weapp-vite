---
title: wevu 的 Vue 3 兼容性说明
---

# wevu 的 Vue 3 兼容性说明

`wevu` 是一个面向小程序（以微信小程序为主）的 Vue 3 风格运行时：尽量提供熟悉的 Vue 3 API 形态，同时针对小程序运行环境进行适配与约束。

本文用于帮助你快速判断：

- 哪些 API 可以像 Vue 3 一样直接使用
- 哪些 API 在小程序中存在差异或仅部分兼容
- 哪些 Vue 3 能力在小程序中不适用

## Vue 3 兼容性目标

`wevu` 的核心目标是降低 Vue 开发者进入小程序的心智成本：让你可以继续用 Composition API 组织业务逻辑，并通过快照 diff 最小化 `setData` 更新。

需要注意：小程序不是浏览器环境，没有 DOM / Virtual DOM；事件系统与生命周期也与 Web 存在天然差异，因此 `wevu` 不可能做到“100% 无差别兼容 Vue 3”。

## 完全兼容的 API

以下 API 与 Vue 3 的行为一致（或在 `wevu` 中保持同等语义），可以直接按 Vue 3 的习惯使用。

### 响应式（Reactivity）

- `reactive()`：创建响应式对象
- `ref()`：创建 ref
- `computed()`：创建计算属性
- `watch()`：监听响应式源
- `watchEffect()`：自动追踪依赖的副作用
- `toRefs()`：把响应式对象转换为 refs
- `toRef()`：为指定属性创建 ref
- `toRaw()`：获取原始对象
- `isRef()`：判断是否为 ref
- `isReactive()`：判断是否为 reactive
- `readonly()`：创建只读包装
- `markRaw()`：标记对象跳过响应式转换
- `isRaw()`：判断对象是否被标记为 raw

### 浅层响应式（Shallow Reactivity）

- `shallowReactive()`：创建浅层响应式对象
- `shallowRef()`：创建浅层 ref
- `isShallowReactive()`：判断是否为 shallowReactive
- `isShallowRef()`：判断是否为 shallowRef
- `triggerRef()`：手动触发 ref 更新

### 生命周期钩子（Lifecycle Hooks）

以下钩子在 `wevu` 中提供与 Vue 3 对齐的调用方式（但其触发时机映射到小程序生命周期，具体差异见后文）：

- `onMounted()`：组件/页面已就绪
- `onUpdated()`：更新后（在 `setData` 后触发）
- `onUnmounted()`：组件/页面卸载
- `onBeforeMount()`：挂载前（在小程序里会立即执行，见后文）
- `onBeforeUpdate()`：更新前（在 `setData` 前触发）
- `onBeforeUnmount()`：卸载前（在小程序里会立即执行，见后文）
- `onActivated()`：组件激活（映射 `onShow`）
- `onDeactivated()`：组件失活（映射 `onHide`）
- `onErrorCaptured()`：错误捕获

### 组件与调度（Component API）

- `defineComponent()`：定义组件/页面（底层通过小程序 `Component()` 注册）
- `createApp()`：创建应用实例
- `getCurrentInstance()`：获取当前实例
- `nextTick()`：在下一次更新后执行回调

### 依赖注入（Dependency Injection）

- `provide()`：提供依赖
- `inject()`：注入依赖
- `provideGlobal()` / `injectGlobal()`：全局 provide/inject（已弃用，仅用于兼容/过渡）

### Store（Pinia 风格）

`wevu` 内置了 Pinia 风格 Store，并且可以做到“无需全局注册，直接使用”：

- `defineStore()`：定义 Store（Setup/Options 两种模式）
- `storeToRefs()`：从 store 提取 refs
- `createStore()`：可选的 store manager（可做插件入口）
- `$patch`：批量更新 state
- `$reset`：重置 state（仅 Options Store）
- `$subscribe`：订阅 state 变更
- `$onAction`：订阅 action 调用

**关键差异：不需要全局注册**

```ts
// ❌ Pinia：需要全局注册
import { createPinia } from 'pinia'

// wevu：直接使用即可
import { defineStore } from 'wevu'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  return { count }
})

const pinia = createPinia()
app.use(pinia) // Pinia 必须先注册
```

更多 Store 细节见：`/wevu/store`。

## 部分兼容 / 不同 API

### setup() 上下文（Setup Context）

`setup()` 会收到增强后的 context（在 Vue 3 的 `emit/expose/attrs` 基础上，补充了小程序运行时相关字段）：

```ts
defineComponent({
  setup(props, { emit, expose, attrs }) {
    // Vue 3 风格：props 作为第一个参数（当组件定义了 properties 时）
    // 额外的 context 字段：
    // - props: 组件 properties（来自小程序）
    // - emit: 通过小程序 triggerEvent(eventName, detail?, options?) 派发事件
    // - expose: 暴露公共方法（必定存在）
    // - attrs: attrs（必定存在；小程序场景为空对象）
    // - runtime: wevu 运行时实例
    // - state: 响应式状态
    // - proxy: 公开实例代理
    // - bindModel: 双向绑定辅助方法
    // - watch: watch 辅助方法
    // - instance: 小程序内部实例
  },
})
```

### emit 的差异（triggerEvent 语义）

`emit` 是对小程序 `triggerEvent` 的薄封装：

- `emit(eventName, detail?, options?)`
- `options.bubbles`（默认 `false`）：事件是否冒泡
- `options.composed`（默认 `false`）：事件是否可以穿越组件边界
- `options.capturePhase`（默认 `false`）：事件是否拥有捕获阶段

与 Vue 3 不同：小程序事件只有一个 `detail` 载荷，不支持 `emit(event, ...args)` 的多参数透传。

### 生命周期映射差异

小程序生命周期与 Web 有差异，`wevu` 会做映射：

- `onMounted()` 映射到 `onReady`
- `onUnmounted()` 映射到页面 `onUnload` / 组件 `detached`
- `onActivated()` 映射到 `onShow`
- `onDeactivated()` 映射到 `onHide`
- `onBeforeMount()` / `onBeforeUnmount()` 在小程序中会在 `setup()` 同步阶段立即执行，用于模拟语义

## ❌ 小程序不适用的 Vue 3 API

以下 API 依赖 DOM / Virtual DOM / 浏览器环境，在小程序中不适用：

- `h()` / `createElement()`：小程序没有 Virtual DOM
- `Transition` / `KeepAlive` / `Teleport`：Web 内置组件语义
- `onServerPrefetch()`：无 SSR
- `onRenderTracked()` / `onRenderTriggered()`：无渲染追踪

## 使用示例

### 基础组件

```ts
import { computed, defineComponent, onMounted, ref } from 'wevu'

defineComponent({
  data: () => ({ count: 0 }),

  setup(props, { emit }) {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    onMounted(() => {
      console.log('组件已挂载')
    })

    function increment() {
      count.value++
      emit('update', count.value)
    }

    return { count, doubled, increment }
  },
})
```

### 使用 Props

```ts
defineComponent({
  properties: {
    title: String,
    count: Number,
  },

  setup(props) {
    console.log('title:', props.title)
    console.log('count:', props.count)
    return {}
  },
})
```

### Watch 与 WatchEffect

```ts
import { ref, watch, watchEffect } from 'wevu'

defineComponent({
  setup() {
    const count = ref(0)

    watchEffect(() => {
      console.log('Count changed:', count.value)
    })

    watch(count, (newValue, oldValue) => {
      console.log(`Count: ${oldValue} -> ${newValue}`)
    })

    // watch/watchEffect 返回可调用的 stop handle，同时支持 pause / resume
    const { pause, resume, stop } = watch(count, () => {
      console.log('count changed')
    })
    pause()
    resume()
    stop()

    return { count }
  },
})
```

### toRefs：解构同时保持响应式

```ts
import { reactive, toRefs } from 'wevu'

defineComponent({
  setup() {
    const state = reactive({
      count: 0,
      name: 'wevu',
    })

    const { count, name } = toRefs(state)
    count.value++

    return { count, name }
  },
})
```

### Provide / Inject

```ts
// 父组件
defineComponent({
  setup() {
    const theme = ref('dark')
    provide('theme', theme)
    return {}
  },
})

// 子组件
defineComponent({
  setup() {
    const theme = inject('theme', 'light')
    return { theme }
  },
})
```

### 浅层响应式（Shallow）

```ts
import { shallowReactive, shallowRef } from 'wevu'

defineComponent({
  setup() {
    const state = shallowReactive({
      nested: { count: 0 },
    })

    state.nested = { count: 1 } // 会触发 effect
    state.nested.count++ // 不会触发 effect

    const foo = shallowRef({ bar: 1 })
    foo.value = { bar: 2 } // 会触发 effect
    foo.value.bar++ // 不会触发 effect

    return { state, foo }
  },
})
```

### markRaw

```ts
import { markRaw, reactive } from 'wevu'

defineComponent({
  setup() {
    const classInstance = markRaw(new MyClass())

    const state = reactive({
      // classInstance 不会被转换为响应式
      instance: classInstance,
    })

    return { state }
  },
})
```

## API 参考与 TypeScript 支持

`wevu` 提供完整的 TypeScript 类型导出，你可以在项目中直接引用需要的类型：

```ts
import type { ComponentPublicInstance, Ref, SetupContext } from 'wevu'
```

## 从 Vue 3 迁移到 wevu（迁移要点）

1. 替换导入：把 `from 'vue'` 改为 `from 'wevu'`
2. 生命周期映射：大多数钩子无需改动，但请注意 `onBeforeMount/onBeforeUnmount` 在小程序里会立即执行
3. 模板差异：使用 WXML（而非 HTML）；双向绑定建议使用 `bindModel()` 生成事件/属性绑定对象
4. 组件注册：`wevu` 组件基于小程序 `Component()`；SFC 场景一般由构建侧（如 weapp-vite）产出注册代码

## License

MIT
