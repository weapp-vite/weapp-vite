---
title: Wevu Composition API 测试
description: 使用 @wevu/test-utils 测试 Wevu Composition API、响应式逻辑、生命周期和事件。
keywords:
  - Wevu
  - Composition API
  - 测试
  - Vitest
  - '@wevu/test-utils'
---

# Wevu Composition API 测试

`@wevu/test-utils` 为不依赖 WXML 的 Wevu 逻辑提供轻量测试宿主。它直接创建真实 Wevu runtime 实例，因此 `ref`、`computed`、`watch`、`provide/inject`、setup 上下文和生命周期仍然走 Wevu 的实现，也可以挂载真实 Vue SFC 的逻辑层。

## 什么时候使用

- 测试纯 Composition API 或可复用 composable。
- 验证响应式状态、watch 回调和 `nextTick` 更新。
- 验证 `onMounted`、`onUnmounted` 等已接入小程序生命周期的 hook。
- 验证 `emit` 事件、插件安装和全局 provide。
- 使用 `wevuSfc()` 转换 `.vue`，验证 `<script setup>`、Options API、props、emits 和组件生命周期。

需要测试编译后的页面/组件、逻辑 WXML 树、选择器查询、用户交互或微信宿主 mock 时，使用 [`@mpcore/test`](/packages/mpcore-test)。两者是互补关系，不是两套不同的渲染器。

## 基础用法

```ts
import { mountComposable } from '@wevu/test-utils'
import { computed, onMounted, ref } from 'wevu'

const wrapper = mountComposable((props, { emit }) => {
  const count = ref(props.initial)

  onMounted(() => emit('ready'))

  return {
    count,
    doubled: computed(() => count.value * 2),
    increment() {
      count.value += 1
    },
  }
}, {
  props: { initial: 1 },
})

expect(wrapper.vm.count.value).toBe(1)
expect(wrapper.emitted('ready')).toEqual([[undefined]])

wrapper.vm.increment()
await wrapper.nextTick()
expect(wrapper.vm.doubled.value).toBe(4)

wrapper.unmount()
```

## Vue SFC 逻辑测试

SFC 测试需要显式配置 `@wevu/test-utils/vitest`：

```ts
import { wevuSfc } from '@wevu/test-utils/vitest'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [wevuSfc()],
})
```

默认页面判定会拒绝 `app.vue` 和 `pages/**` 下的页面文件，同时允许 `pages/**/components/**` 中的普通组件。自定义路由目录可通过同步或异步 `isPage(filename)` 覆盖页面判定；回调收到的文件名已移除查询参数并统一为 `/` 分隔符：

```ts
export default defineConfig({
  plugins: [wevuSfc({
    isPage: filename => filename.includes('/routes/'),
  })],
})
```

```ts
import { mountComponent } from '@wevu/test-utils'
import Counter from './Counter.vue'

const wrapper = mountComponent(Counter, { props: { initial: 1 } })
expect(wrapper.vm.$props.initial).toBe(1)
wrapper.vm.increment()
await wrapper.nextTick()
expect(wrapper.emitted('change')).toEqual([[2]])
wrapper.unmount()
```

`wevuSfc()` 只把 `@wevu/compiler` 生成的 script 交给 Vitest，保留 source map，并把 `virtual:weapp-vite/runtime`、`/reactivity`、`/template` 映射到 Wevu internal runtime。它不使用 `@vitejs/plugin-vue`，不渲染模板、WXML、CSS 或 DOM。

`mountComponent()` 可接收编译后的 SFC 默认导出、`DefineComponentOptions` 或 Wevu component definition。它复用组件 props 默认值、data、computed、methods、watch、setup、Options API provide/inject、emits 和生命周期，执行 `created -> attached -> ready`，卸载时调用 `detached`。每个 wrapper 都拥有独立的 Wevu app context，`global.provide`、插件、mocks、全局属性和卸载状态不会跨挂载共享。`mount()` 会自动识别组件定义；需要保持 `{ setup }` composable 的明确语义时可继续使用 `mountComposable()`。

app/page SFC、完整构建产物、逻辑 WXML、选择器、布局、宿主 mock 和真实交互不属于 `mountComponent()`；这些场景使用 [`@mpcore/test`](/packages/mpcore-test)。`onUpdated` 仍沿用 Wevu runtime 语义，本工具不会伪造生产更新。

## API

### `mountComposable(setup, options?)`

接收一个 setup 函数并返回 wrapper。`mount(setup, options?)` 是同一能力的通用别名，也接受 `{ setup }` 形式。

`options` 支持：

- `props`：传给 setup 的响应式 props。
- `data`、`computed`、`methods`、`watch`、`setData`：复用 Wevu runtime 的选项式能力。
- `global.provide`：对象或 `Map` 形式的注入值。
- `global.plugins`：插件，或 `[plugin, ...options]`。
- `global.mocks` / `global.config.globalProperties`：测试用全局属性。
- `route` / `componentName`：为依赖实例标识的逻辑提供最小宿主信息。

### wrapper

- `vm`：Wevu public instance，包含 setup 返回的绑定和方法。
- `setProps(props)`：更新 props，并等待一次 Wevu 调度。
- `setData(data)`：更新 runtime state，并等待一次 Wevu 调度。
- `emitted(name?)`：读取事件。返回值形状为 `[[detail]]`，与 Vue Test Utils 的 emitted 查询方式一致。
- `triggerHook(name, ...args)`：触发指定的小程序生命周期 hook 后等待调度。
- `nextTick()`：等待 Wevu 更新队列。
- `unmount()`：触发卸载 hook 并停止响应式副作用。

该包不提供 DOM、WXML、布局可见性或真实宿主导航断言；这些行为应在 `@mpcore/test` 或对应 IDE/headless e2e 中验证。`onUpdated` 当前只有 runtime 的注册/手动派发入口，生产更新链路尚未自动派发，本工具不会伪造这一语义。
