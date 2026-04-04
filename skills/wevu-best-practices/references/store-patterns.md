# wevu Store Patterns

## Setup store 优先

```ts
import { computed, defineStore, ref } from 'wevu'

export const useCounter = defineStore('counter', () => {
  const count = ref(0)
  const doubled = computed(() => count.value * 2)
  const inc = () => count.value += 1
  return { count, doubled, inc }
})
```

## 消费模式

```ts
import { storeToRefs } from 'wevu'

const store = useCounter()
const { count, doubled } = storeToRefs(store)
```

- actions 直接解构
- state/getters 通过 `storeToRefs`
