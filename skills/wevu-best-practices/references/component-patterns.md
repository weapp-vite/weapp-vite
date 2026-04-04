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
