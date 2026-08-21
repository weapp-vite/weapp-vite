# @wevu/test-utils

用于测试 Wevu 逻辑的轻量工具。它会创建真实的 Wevu runtime 实例，提供 `mount`、`mountComposable`、`mountComponent`、`wrapper.vm`、`setProps`、`setData`、`emitted`、生命周期触发和卸载能力。

该包只负责逻辑层测试，不模拟 WXML 查询、布局或完整微信宿主。需要测试编译产物、页面/组件树和用户交互时，请使用 `@mpcore/test`。

```ts
import { mountComposable } from '@wevu/test-utils'
import { computed, onMounted, onUnmounted, ref } from 'wevu'

const wrapper = mountComposable((props, { emit }) => {
  const count = ref(props.initial)
  const doubled = computed(() => count.value * 2)

  onMounted(() => emit('ready'))
  onUnmounted(() => emit('closed'))

  return {
    count,
    doubled,
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
expect(wrapper.emitted('closed')).toEqual([[undefined]])
```

## 测试真实 Vue SFC

在 Vitest 配置中显式加入 `wevuSfc()`，它会调用 `@wevu/compiler` 编译 `.vue` 的 script，保留 source map，并将 Wevu 的三个虚拟 runtime 入口映射到 `wevu/internal-*`。该入口不会使用 `@vitejs/plugin-vue`，也不会渲染模板、WXML、CSS 或 DOM。

```ts
import { wevuSfc } from '@wevu/test-utils/vitest'
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [wevuSfc()],
})
```

默认情况下，`wevuSfc()` 会拒绝 `app.vue` 和 `pages/**` 下的页面文件，但允许 `pages/**/components/**` 中的普通组件。项目使用自定义页面目录时，可传入同步或异步的 `isPage(filename)` 判定；回调收到的是移除查询参数并统一为 `/` 分隔符的文件名：

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

const wrapper = mountComponent(Counter, {
  props: { initial: 1 },
  global: {
    provide: { token: 'test-value' },
    mocks: { $feature: true },
  },
})

wrapper.vm.increment()
await wrapper.nextTick()
expect(wrapper.vm.count.value).toBe(2)
wrapper.unmount()
```

`mountComponent()` 接收编译后的 SFC 默认导出、组件选项或 Wevu component definition，不接收源码路径或字符串。它复用组件自身的 props 默认值、data、computed、methods、watch、setup、Options API provide/inject、emits 和生命周期，挂载顺序为 `created -> attached -> ready`，卸载时调用 `detached`。每次挂载都会创建独立的 Wevu app context，因此 `global.provide`、插件、mocks、全局属性和卸载状态不会在 wrapper 之间共享。

`app.vue` 和页面组件不属于该入口的测试对象；需要验证完整编译产物、WXML 查询、组件树、宿主 mock 或交互时，请使用 `@mpcore/test`。

`@mpcore/test` 与本包的边界是明确的：前者验证真实编译产物和逻辑 WXML 树，后者验证不依赖模板的组合式逻辑与生命周期。`onUpdated` 目前只有 runtime 注册和手动派发入口，生产更新链路尚未自动派发，因此不由本包伪造该语义。
