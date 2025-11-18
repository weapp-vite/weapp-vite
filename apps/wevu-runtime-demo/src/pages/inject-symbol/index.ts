import { defineComponent, provide, readonly, ref } from 'wevu'
import { COUNT_KEY, INCREMENT_KEY } from '../../components/inject-sym-child/index'

defineComponent({
  setup() {
    const count = ref(0)
    function increment() {
      count.value += 1
    }
    provide(COUNT_KEY, readonly(count))
    provide(INCREMENT_KEY, increment)
    return {
      count,
      increment,
    }
  },
})
