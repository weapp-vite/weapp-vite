# wevu

Vue 3 风格的小程序运行时，复用同款响应式与调度器，通过快照 diff 最小化 `setData`，并内置 Pinia 风格的状态管理。

## 特性

- `ref`/`reactive`/`computed`/`watch` 与 `nextTick` 同源于 Vue 3 的响应式核心
- `defineComponent` + `setup` 生命周期钩子（onShow/onPageScroll/onShareAppMessage 等）自动注册微信小程序 `Component`（在微信中可用于页面/组件）
- 快照 diff + 去重调度，最小化 `setData` 体积，支持 `bindModel` 的双向绑定语法
- 插件、`app.config.globalProperties` 及小程序原生选项可自由组合
- 内置 `defineStore`/`storeToRefs`/`createStore`，支持 getters、actions、订阅与补丁
- TypeScript first，输出 ESM/CJS/types

## 安装

```bash
pnpm add wevu
# 或 npm/yarn/pnpm dlx 按需安装
```

## 快速上手：页面定义

```ts
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  onPageScroll,
  onShareAppMessage,
  ref,
} from 'wevu'

defineComponent({
  features: {
    listenPageScroll: true,
    enableShareAppMessage: true,
  },
  data: () => ({ count: 0 }),
  computed: {
    doubled() {
      return this.count * 2
    },
  },
  methods: {
    inc() {
      this.count += 1
    },
  },
  watch: {
    count(n) {
      console.log('count changed', n)
    },
  },
  setup({ state }) {
    const title = computed(() => `count: ${state.count}`)
    const local = ref(0)

    onMounted(() => {
      nextTick(() => console.log('page ready'))
    })
    onPageScroll((e) => {
      console.log('scrollTop', e?.scrollTop)
    })
    onShareAppMessage(() => ({ title: title.value }))

    return { local }
  },
})
```

- 当全局存在 `Component` 构造器时自动注册；否则可拿到 `component.__wevu_runtime` 手动挂载适配器。
- 组件场景使用 `defineComponent`，SFC 构建产物可调用 `createWevuComponent`。

## 状态管理

```ts
import { createStore, defineStore, storeToRefs } from 'wevu'

createStore() // 在小程序入口只需要调用一次，注入插件可选

export const useCounter = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: {
    doubled: state => state.count * 2,
  },
  actions: {
    inc() {
      this.count += 1
    },
  },
})

// 在页面/组件内使用
const counter = useCounter()
const { count, doubled } = storeToRefs(counter)
counter.$subscribe(({ type }) => console.log('mutation', type))
counter.inc()
```

## 事件派发（emit）

在 `setup(props, ctx)` 中可使用 `ctx.emit(eventName, detail?, options?)`，底层直接调用小程序 `triggerEvent`。

`options` 支持：

- `bubbles`：事件是否冒泡（默认 `false`）
- `composed`：事件是否可以穿越组件边界（默认 `false`）
- `capturePhase`：事件是否拥有捕获阶段（默认 `false`）

与 Vue 3 不同：小程序事件只有一个 `detail` 载荷，不支持 `emit(event, ...args)` 的多参数透传。

## 调度与适配

- 更新被批量加入微任务队列，`nextTick` 与 Vue 3 行为一致。
- 对状态做快照 diff，只把变更路径传给 `setData`，避免大对象全量下发。
- 提供 `batch`/`startBatch`/`endBatch` 用于同步更新合并触发；以及 `effectScope`/`onScopeDispose` 统一管理 effect/watch 的销毁，便于避免泄漏。

## 本地开发

```bash
# 从仓库根目录执行
pnpm dev --filter wevu
pnpm test --filter wevu
pnpm build --filter wevu
```

## 更多资料

- 架构细节：`packages/wevu/ARCHITECTURE.md`
- 与 Vue 3 对比：`packages/wevu/VUE3_VS_WEVU.md`
- 兼容性说明：`packages/wevu/VUE3_COMPAT.md`
