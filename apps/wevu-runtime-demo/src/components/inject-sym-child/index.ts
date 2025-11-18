import { defineComponent, inject } from 'wevu'

export const COUNT_KEY = Symbol('count')
export const INCREMENT_KEY = Symbol('increment')

defineComponent({
  setup() {
    const count = inject<number>(COUNT_KEY)
    const increment = inject<() => void>(INCREMENT_KEY)
    return {
      count,
      increment,
    }
  },
})
