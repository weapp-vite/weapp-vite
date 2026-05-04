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
