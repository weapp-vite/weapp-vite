# wevu Store Patterns

## Setup store preferred

```ts
import { computed, defineStore, ref } from 'wevu'

export const useCounter = defineStore('counter', () => {
  const count = ref(0)
  const doubled = computed(() => count.value * 2)
  const inc = () => count.value += 1
  return { count, doubled, inc }
})
```

## Consumption pattern

```ts
import { storeToRefs } from 'wevu'

const store = useCounter()
const { count, doubled } = storeToRefs(store)
```

- Destructure actions directly.
- Destructure state/getters through `storeToRefs`.
