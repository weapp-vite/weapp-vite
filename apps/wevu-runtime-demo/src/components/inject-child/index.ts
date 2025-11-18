import { defineComponent, inject } from 'wevu'

defineComponent({
  setup() {
    const count = inject<number>('count')
    const increment = inject<() => void>('increment')
    return {
      count,
      increment,
    }
  },
})
