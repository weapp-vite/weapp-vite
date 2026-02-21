# wevu Component Patterns

## 1) Minimal page pattern

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

## 2) Minimal component pattern

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

## 3) Hook discipline

- Register hooks synchronously inside `setup()`.
- Keep return-value page hooks unique per instance where required.
