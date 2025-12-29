import { defineComponent, storeToRefs } from 'wevu'
import { useCounter } from '../../stores/counter'

defineComponent({
  setup() {
    const store = useCounter()
    const { count, double } = storeToRefs(store)

    function inc() {
      store.inc()
    }
    function dec() {
      store.dec()
    }
    function reset() {
      store.reset()
    }

    return {
      count,
      double,
      inc,
      dec,
      reset,
    }
  },
})
