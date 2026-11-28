# wevu Component Patterns

## Minimal page

```ts
import { defineComponent, onShow, ref } from 'wevu'

export default defineComponent({
  setup() {
    const count = ref(0)
    onShow(() => {
      // page visible
    })
    return { count }
  },
})
```

## Minimal component

```ts
import { computed, defineComponent } from 'wevu'

export default defineComponent({
  properties: { modelValue: { type: Number, value: 0 } },
  setup(props, ctx) {
    const value = computed({
      get: () => props.modelValue ?? 0,
      set: next => ctx.emit('update:modelValue', next),
    })
    return { value }
  },
})
```

## Hook discipline

- hooks 在同步 `setup()` 中注册
- 需要唯一性的 page hook 返回值按实例隔离

## JSX / TSX ownership

- Wevu JSX/TSX 与 SFC 内 JSX/TSX 需要项目现有工具链接入对应编译器；使用 weapp-vite 的 SFC/JSX 工作流时，须显式安装 `weapp-vite`，不能把 `wevu` 运行时包当作 CLI。
- 保持小程序事件名和 class 语义，确认自定义组件 tag 输出为 kebab-case。
- 项目同时安装 `weapp-vite` 与 `@weapp-vite/react` 并启用 `weapp.react` 后，独立 `.jsx/.tsx` 归 React；React 与 Wevu 通过小程序自定义组件 bridge 互操作。

## Host composables

```ts
import { defineComponent, ref, useAsyncPullDownRefresh, useElementIntersectionObserver, usePageStack } from 'wevu'

export default defineComponent({
  setup() {
    const visible = ref(false)
    const pageStack = usePageStack()

    useElementIntersectionObserver({
      selector: '#banner',
      onObserve(result: any) {
        visible.value = Number(result?.intersectionRatio ?? 0) > 0
      },
    })

    useAsyncPullDownRefresh(async () => {
      // refresh data
    })

    return { pageStack, visible }
  },
})
```

- 查询节点优先使用 `useBoundingClientRect` / `useSelectorFields` / `useScrollOffset`
- 曝光、懒加载优先使用 `useElementIntersectionObserver`
- 自定义导航栏优先使用 `useNavigationBarMetrics`

## Layout feedback host

以下 `layout-host` 模板示例要求 `weapp-vite` 的 layout/SFC 编译链与 `wevu` 运行时；`t-toast` / `t-dialog` 还需项目已安装并注册 TDesign 小程序组件。仅使用 Wevu 原生页面时，不为这个可选模式引入构建器或 UI 库。

把 Toast、Dialog、全局反馈层这类天然属于页面壳的组件放在 layout 内，再通过 `layout-host` 暴露给页面或子组件。

```vue
<template>
  <view class="layout-default">
    <slot />
    <t-toast layout-host="layout-toast" />
    <t-dialog layout-host="layout-dialog" />
  </view>
</template>
```

页面和组件侧不要直接手写 `selectComponent()` 查找 layout 内部节点，优先封装为业务 hook：

```ts
import { getCurrentInstance, resolveLayoutHost } from 'wevu'

interface ToastHost {
  show: (options: { message: string, theme?: string }) => void
}

export function showToast(message: string) {
  const toast = resolveLayoutHost<ToastHost>('layout-toast', {
    context: getCurrentInstance(),
  })
  toast?.show({ message })
}
```

- `wevu` 只负责 `layout-host` 的注册、解析与等待。
- TDesign / Vant 等组件库的参数结构保留在模板 hook 内，不要抽进 `wevu` core。
- 宿主解析必须在页面或组件上下文中发生；store 可发起业务意图，但具体解析最好仍由页面上下文消费。
