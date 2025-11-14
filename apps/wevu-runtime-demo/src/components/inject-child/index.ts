import { defineComponent, inject } from 'wevu'

const Comp = defineComponent({
  type: 'component',
  setup() {
    const count = inject<number>('count')
    const increment = inject<() => void>('increment')
    return {
      count,
      increment,
    }
  },
})

Comp.mount()

