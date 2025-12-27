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

- `defineComponent()` - Define components
- `definePage()` - Define pages
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
- `$reset` - Reset state to initial values (Options store only)
- `$subscribe` - Subscribe to state mutations
- `$onAction` - Subscribe to action calls

**Key Difference: No Global Registration Required**

```typescript
// ❌ Pinia - Requires global registration
import { createPinia } from 'pinia'

// No createPinia(), no app.use(pinia) needed!

// ✅ wevu - Just use it directly!
import { defineStore } from 'wevu'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  return { count }
})
const pinia = createPinia()
app.use(pinia) // Must register first
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

// Usage in component
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
    // Vue 3 style: props as first argument (if component has properties)
    // Additional context properties:
    // - props: Component properties from mini-program
    // - emit: Emit events via triggerEvent
    // - expose: Expose public methods
    // - attrs: Attributes (empty for mini-programs)
    // - runtime: wevu runtime instance
    // - state: Reactive state
    // - proxy: Public instance proxy
    // - bindModel: Model binding helper
    // - watch: Watch helper
    // - instance: Internal mini-program instance
  }
})
```

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
    // props.title and props.count are available
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

    // watchEffect - auto-tracks dependencies
    watchEffect(() => {
      console.log('Count changed:', count.value)
    })

    // watch - specific source
    watch(count, (newValue, oldValue) => {
      console.log(`Count: ${oldValue} -> ${newValue}`)
    })

    // Deep watch
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

    // Destructuring while keeping reactivity
    const { count, name } = toRefs(state)

    count.value++ // Works!

    return { count, name }
  }
})
```

### Provide/Inject

```typescript
// Parent component
defineComponent({
  setup() {
    const theme = ref('dark')
    provide('theme', theme)

    return {}
  }
})

// Child component
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
    // Shallow reactive - only root level is reactive
    const state = shallowReactive({
      nested: { count: 0 }
    })

    state.nested = { count: 1 } // Triggers effect
    state.nested.count++ // Does NOT trigger effect

    // Shallow ref
    const foo = shallowRef({ bar: 1 })
    foo.value = { bar: 2 } // Triggers effect
    foo.value.bar++ // Does NOT trigger effect

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
      // classInstance will NOT be made reactive
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
