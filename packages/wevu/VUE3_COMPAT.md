# wevu - Vue 3 Compatible Mini-Program Runtime

wevu is a Vue 3 compatible runtime designed for WeChat mini-programs. It provides a familiar Vue 3 API surface while optimizing for the mini-program environment.

## Vue 3 Compatibility

wevu strives to maintain API compatibility with Vue 3 to reduce the learning curve for Vue developers.

### ✅ Fully Compatible APIs

The following APIs work exactly like Vue 3:

#### Reactivity

- `reactive()` - Create reactive objects
- `ref()` - Create reactive refs
- `computed()` - Create computed values
- `watch()` - Watch reactive sources
- `watchEffect()` - Run side effects automatically
- `toRefs()` - Convert reactive objects to refs
- `toRef()` - Create a ref for a specific property
- `toRaw()` - Get the raw object
- `isRef()` - Check if a value is a ref
- `isReactive()` - Check if a value is reactive
- `readonly()` - Create readonly objects
- `markRaw()` - Mark objects to skip reactivity
- `isRaw()` - Check if an object is marked raw

#### Shallow Reactivity

- `shallowReactive()` - Create shallow reactive objects
- `shallowRef()` - Create shallow refs
- `isShallowReactive()` - Check if shallow reactive
- `isShallowRef()` - Check if shallow ref
- `triggerRef()` - Manually trigger ref updates

#### Lifecycle Hooks

- `onMounted()` - When component/page is ready
- `onUpdated()` - After updates (called after setData)
- `onUnmounted()` - When component/page is unloaded
- `onBeforeMount()` - Before mount (executes immediately)
- `onBeforeUpdate()` - Before updates (called before setData)
- `onBeforeUnmount()` - Before unmount (executes immediately)
- `onActivated()` - Component activated (maps to onShow)
- `onDeactivated()` - Component deactivated (maps to onHide)
- `onErrorCaptured()` - Capture errors

#### Component API

- `defineComponent()` - Define components/pages (registers via mini-program `Component()`)
- `createApp()` - Create app instances
- `getCurrentInstance()` - Get current instance
- `nextTick()` - Execute after update

#### Dependency Injection

- `provide()` - Provide values to descendants
- `inject()` - Inject values from ancestors
- `provideGlobal()` / `injectGlobal()` - Global provide/inject (deprecated)

#### Store (Pinia Compatible)

wevu includes a Pinia-compatible store implementation that works **without global registration**:

- `defineStore()` - Define stores (Setup & Options modes)
- `storeToRefs()` - Extract reactive refs from store
- `createStore()` - Create store manager with plugin support (optional)
- `$patch` - Batch update state
- `$reset` - Reset state to initial values (Setup & Options store)
- `$subscribe` - Subscribe to state mutations
- `$onAction` - Subscribe to action calls

**Key Difference: No Global Registration Required**

```typescript
// ❌ Pinia：需要全局注册
import { createPinia } from 'pinia'

// 不需要 createPinia()，也不需要 app.use(pinia)！

// ✅ wevu：直接使用即可
import { defineStore } from 'wevu'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  return { count }
})
const pinia = createPinia()
app.use(pinia) // 必须先注册
```

**Setup Store (Recommended):**

```typescript
import { computed, defineStore, ref, storeToRefs } from 'wevu'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const doubleCount = computed(() => count.value * 2)

  function increment() {
    count.value++
  }

  return { count, doubleCount, increment }
})

// 在组件中使用
const counterStore = useCounterStore()
const { count, doubleCount } = storeToRefs(counterStore)
const { increment } = counterStore
```

**Options Store:**

```typescript
import { defineStore } from 'wevu'

export const useUserStore = defineStore('user', {
  state: () => ({
    name: '',
    age: 0
  }),

  getters: {
    label(state): string {
      return `${state.name}: ${this.age}`
    }
  },

  actions: {
    grow() {
      this.age++
    }
  }
})
```

See [store documentation](./store/README.md) for details.

### ⚠️ Partially Compatible / Different APIs

#### Setup Context

The `setup()` function receives an enhanced context:

```typescript
defineComponent({
  setup(props, { emit, expose, attrs }) {
    // Vue 3 风格：props 作为第一个参数（当组件定义了 properties 时）
    // 额外的 context 字段：
    // - props: 组件 properties（来自小程序）
    // - emit: 通过小程序 triggerEvent(eventName, detail?, options?) 派发事件
    // - expose: 暴露公共方法
    // - attrs: attrs（小程序场景为空对象）
    // - runtime: wevu 运行时实例
    // - state: 响应式状态
    // - proxy: 公开实例代理
    // - bindModel: 双向绑定辅助方法
    // - watch: watch 辅助方法
    // - instance: 小程序内部实例
  }
})
```

`emit` is a thin wrapper around the mini-program `triggerEvent` API:

- `emit(eventName, detail?, options?)`
- `options.bubbles` (default: `false`): whether the event bubbles
- `options.composed` (default: `false`): whether the event can cross component boundaries
- `options.capturePhase` (default: `false`): whether the event has a capture phase

This differs from Vue 3 `emit(event, ...args)`: mini-program events carry a single `detail` payload.

#### Lifecycle Differences

Mini-programs have different lifecycles than web:

- `onMounted()` maps to `onReady`
- `onUnmounted()` maps to `onUnload` (pages) or `detached` (components)
- `onActivated()` maps to `onShow`
- `onDeactivated()` maps to `onHide`
- `onBeforeMount()` / `onBeforeUnmount()` execute immediately in mini-programs

### ❌ Not Applicable for Mini-Programs

These Vue 3 APIs don't apply to mini-programs:

- `h()` / `createElement()` - No virtual DOM in mini-programs
- `Transition`, `KeepAlive`, `Teleport` - Built-in components
- `onServerPrefetch()` - No server-side rendering
- `onRenderTracked()` / `onRenderTriggered()` - No render tracking

## Usage Examples

### Basic Component

```typescript
import { computed, defineComponent, onMounted, ref } from 'wevu'

defineComponent({
  data: () => ({ count: 0 }),

  setup(props, { emit }) {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    onMounted(() => {
      console.log('Component mounted!')
    })

    function increment() {
      count.value++
      emit('update', count.value)
    }

    return { count, doubled, increment }
  }
})
```

### Using Props

```typescript
defineComponent({
  properties: {
    title: String,
    count: Number
  },

  setup(props) {
    // 可直接访问 props.title 和 props.count
    console.log('Received title:', props.title)

    return {}
  }
})
```

### Watch and WatchEffect

```typescript
import { ref, watch, watchEffect } from 'wevu'

defineComponent({
  setup() {
    const count = ref(0)

    // watchEffect：自动追踪依赖
    watchEffect(() => {
      console.log('Count changed:', count.value)
    })

    // watch：监听指定 source
    watch(count, (newValue, oldValue) => {
      console.log(`Count: ${oldValue} -> ${newValue}`)
    })

    // 深度 watch
    watch(
      () => state.nested,
      val => console.log('Nested changed', val),
      { deep: true }
    )

    return { count }
  }
})
```

### toRefs for Destructuring

```typescript
import { reactive, toRefs } from 'wevu'

defineComponent({
  setup() {
    const state = reactive({
      count: 0,
      name: 'wevu'
    })

    // 解构同时保持响应式
    const { count, name } = toRefs(state)

    count.value++ // 可用

    return { count, name }
  }
})
```

### Provide/Inject

```typescript
// 父组件
defineComponent({
  setup() {
    const theme = ref('dark')
    provide('theme', theme)

    return {}
  }
})

// 子组件
defineComponent({
  setup() {
    const theme = inject('theme', 'light')

    return { theme }
  }
})
```

### Shallow Reactivity

```typescript
import { shallowReactive, shallowRef } from 'wevu'

defineComponent({
  setup() {
    // shallowReactive：只有根层是响应式
    const state = shallowReactive({
      nested: { count: 0 }
    })

    state.nested = { count: 1 } // 会触发 effect
    state.nested.count++ // 不会触发 effect

    // shallowRef
    const foo = shallowRef({ bar: 1 })
    foo.value = { bar: 2 } // 会触发 effect
    foo.value.bar++ // 不会触发 effect

    return { state, foo }
  }
})
```

### markRaw

```typescript
import { markRaw, reactive } from 'wevu'

defineComponent({
  setup() {
    const classInstance = markRaw(new MyClass())

    const state = reactive({
      // classInstance 不会被转换为响应式
      instance: classInstance
    })

    return { state }
  }
})
```

## API Reference

See the [TypeScript definitions](./dist/index.d.ts) for complete API documentation.

## Migration from Vue 3

To migrate from Vue 3 to wevu:

1. **Replace imports**: Change `from 'vue'` to `from 'wevu'`

2. **Lifecycle mappings**:
   - No changes needed for most lifecycles
   - Remember `onBeforeMount` and `onBeforeUnmount` execute immediately

3. **Template differences**:
   - Use WXML syntax instead of HTML
   - Use `bindModel()` for two-way binding instead of `v-model`

4. **Component registration**:
   - wevu components auto-register (unless disabled)
   - Component definitions can be reused

## TypeScript Support

wevu is fully typed with TypeScript. All types are exported for use in your projects:

```typescript
import type {
  ComponentPublicInstance,
  ComputedRef,
  ReactiveEffect,
  Ref,
  SetupContext
} from 'wevu'
```

## License

MIT
