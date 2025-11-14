import { definePage } from 'wevu'
import { storeToRefs } from 'wevu/pinia'
import { useCounter } from '../../stores/counter'

const page = definePage({
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

page.mount()

