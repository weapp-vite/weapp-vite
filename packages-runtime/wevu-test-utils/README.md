# @wevu/test-utils

用于测试 Wevu Composition API 逻辑的轻量工具。它会创建真实的 Wevu runtime 实例，提供 `mount`、`mountComposable`、`wrapper.vm`、`setProps`、`setData`、`emitted`、生命周期触发和卸载能力。

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

`@mpcore/test` 与本包的边界是明确的：前者验证真实编译产物和逻辑 WXML 树，后者验证不依赖模板的组合式逻辑与生命周期。`onUpdated` 目前只有 runtime 注册和手动派发入口，生产更新链路尚未自动派发，因此不由本包伪造该语义。
